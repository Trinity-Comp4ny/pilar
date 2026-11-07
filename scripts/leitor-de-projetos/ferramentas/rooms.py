"""Spike: paredes e ambientes de uma prancha rasterizada com texto vetorial.

Uso: python rooms.py <pdf> <pagina> <pasta_saida> <escala_denominador>
"""
import sys, re, json, pathlib
import numpy as np, cv2, pdfplumber, pypdfium2 as pdfium
from scipy import ndimage as ndi
from skimage.segmentation import watershed

pdf_path, page_no, out_dir, denom = sys.argv[1], int(sys.argv[2]), pathlib.Path(sys.argv[3]), float(sys.argv[4])
out_dir.mkdir(parents=True, exist_ok=True)
DPI = 300
MODE = sys.argv[5] if len(sys.argv) > 5 else 'paredes'
S = DPI / 72
M_PER_PX = 25.4 / DPI / 1000 * denom

pg = pdfplumber.open(pdf_path).pages[page_no - 1]
bx0, btop = pg.bbox[0], pg.bbox[1]
img = pdfium.PdfDocument(pdf_path)[page_no - 1].render(scale=S).to_numpy()[:, :, :3].copy()
gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
H, W = gray.shape
to_px = lambda x, top: (int((x - bx0) * S), int((top - btop) * S))

# 1. Paredes: preto cheio e espesso (linhas finas de mobiliário e cota saem na abertura morfológica)
WALL_T = None
for t in (40, 70, 90, 110, 130):
    cand = cv2.morphologyEx((gray < t).astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    if cand.sum() * M_PER_PX ** 2 > 10:
        WALL_T, walls = t, cand
        break
print('limiar de parede', WALL_T)
n, lab, stats, _ = cv2.connectedComponentsWithStats(walls)
keep = np.zeros_like(walls)
for i in range(1, n):
    if stats[i, cv2.CC_STAT_AREA] > 1500:
        keep[lab == i] = 1
walls = keep

# 2. Rótulos: "A= 45,60 m²" e o nome logo acima; título da vista abaixo do desenho
words = pg.extract_words(keep_blank_chars=True, extra_attrs=['size'])
titles = [w for w in words if re.match(r'Planta baixa', w['text'])]
labels = []
for w in words:
    m = re.search(r'A\s*=\s*([\d.]+,\d+)\s*m', w['text'])
    if not m:
        continue
    area = float(m.group(1).replace('.', '').replace(',', '.'))
    above = [o for o in words if 0 < w['top'] - o['bottom'] < 14 and abs((o['x0'] + o['x1']) / 2 - (w['x0'] + w['x1']) / 2) < 40 and 'A=' not in o['text']]
    name = above[-1]['text'] if above else '?'
    below = [t for t in titles if t['top'] > w['top']]
    vista = min(below, key=lambda t: t['top'])['text'] if below else '?'
    cx, cy = to_px((w['x0'] + w['x1']) / 2, w['top'] - 4)
    labels.append(dict(nome=name, area_rotulo=area, vista=vista, px=(cx, cy)))

# 3. Ambientes: watershed do espaço livre, semeado em cada rótulo, com a borda da folha como "exterior"
# limites finos e longos (vidro, esquadria, guarda-corpo) entram só como divisa de ambiente
thin = ((gray < 110).astype(np.uint8)) & (walls == 0).astype(np.uint8)
segs = cv2.HoughLinesP(thin * 255, 1, np.pi / 180, threshold=120, minLineLength=int(0.9 / M_PER_PX), maxLineGap=6)
bound = walls.copy()
if segs is not None:
    for x1, y1, x2, y2 in np.asarray(segs).reshape(-1, 4):
        cv2.line(bound, (int(x1), int(y1)), (int(x2), int(y2)), 1, 5)
free = (walls == 0) if MODE == 'paredes' else (bound == 0)
dist0 = ndi.distance_transform_edt(free)
markers = np.zeros((H, W), np.int32)
R = int(0.5 / M_PER_PX)
for i, L in enumerate(labels, start=1):
    x, y = L['px']
    y0, y1, x0, x1 = max(0, y - R), min(H, y + R), max(0, x - R), min(W, x + R)
    win = dist0[y0:y1, x0:x1]
    yy, xx = np.unravel_index(np.argmax(win), win.shape)
    L['seed'] = (int(x0 + xx), int(y0 + yy))
    cv2.circle(markers, L['seed'], 6, i, -1)
ext = len(labels) + 1
markers[:4, :] = ext; markers[-4:, :] = ext; markers[:, :4] = ext; markers[:, -4:] = ext
dist = dist0
regions = watershed(-dist, markers, mask=free)

rows = []
overlay = img.copy()
rng = np.random.default_rng(7)
for i, L in enumerate(labels, start=1):
    mask = regions == i
    area = float(mask.sum()) * M_PER_PX ** 2
    L['area_calc'] = round(area, 2)
    L['erro_pct'] = round((area - L['area_rotulo']) / L['area_rotulo'] * 100, 1)
    color = np.array([int(c) for c in rng.integers(60, 220, 3)])
    overlay[mask] = (0.45 * color + 0.55 * overlay[mask]).astype(np.uint8)
    rows.append(L)
overlay[walls == 1] = (0.3 * overlay[walls == 1] + 0.7 * np.array([30, 30, 30])).astype(np.uint8)
for L in rows:
    x, y = L['px']
    txt = f"{L['area_calc']:.2f} m2 ({L['erro_pct']:+.1f}%)"
    cv2.putText(overlay, txt, (x - 120, y + 46), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (180, 0, 0), 3, cv2.LINE_AA)

stem = f"p{page_no}-{MODE}"
cv2.imwrite(str(out_dir / f"{stem}-overlay.jpg"), cv2.cvtColor(cv2.resize(overlay, (W // 3, H // 3)), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 82])
json.dump(rows, open(out_dir / f"{stem}-ambientes.json", 'w'), ensure_ascii=False, indent=1)
wall_area = float(walls.sum()) * M_PER_PX ** 2
print(f"render {W}x{H}px, 1px = {M_PER_PX*1000:.2f} mm, parede (área em planta) = {wall_area:.1f} m2")
for L in rows:
    flag = 'ok' if abs(L['erro_pct']) <= 3 else ('~' if abs(L['erro_pct']) <= 10 else 'X')
    print(f"{flag:2} {L['vista'][-8:]:9} {L['nome'][:22]:22} rótulo {L['area_rotulo']:7.2f}  calculado {L['area_calc']:7.2f}  {L['erro_pct']:+6.1f}%")
