"""Spike 2: ambientes de prancha rasterizada com texto vetorial.

Uso: python rooms2.py <pdf> <pagina> <pasta_saida> <escala_denominador>
"""
import sys, re, json, pathlib, collections
import numpy as np, cv2, pdfplumber, pypdfium2 as pdfium
from scipy import ndimage as ndi
from skimage.segmentation import watershed

pdf_path, page_no, out_dir, denom = sys.argv[1], int(sys.argv[2]), pathlib.Path(sys.argv[3]), float(sys.argv[4])
out_dir.mkdir(parents=True, exist_ok=True)
DPI = 300
S = DPI / 72
MPX = 25.4 / DPI / 1000 * denom          # metros por pixel
m2px = lambda m: int(round(m / MPX))

pg = pdfplumber.open(pdf_path).pages[page_no - 1]
bx0, btop = pg.bbox[0], pg.bbox[1]
img = pdfium.PdfDocument(pdf_path)[page_no - 1].render(scale=S).to_numpy()[:, :, :3].copy()
gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
H, W = gray.shape
to_px = lambda x, top: (int((x - bx0) * S), int((top - btop) * S))

# ---------- 1. paredes: tom mais escuro com massa espessa; tira o que é grosso demais (bancada, mancha)
walls = None
for t in (40, 70, 90, 110, 130):
    cand = cv2.morphologyEx((gray < t).astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    if cand.sum() * MPX ** 2 > 10:
        walls, WALL_T = cand, t
        break
d = ndi.distance_transform_edt(walls)
core = (d > m2px(0.17)).astype(np.uint8)                       # mais de 34 cm de espessura não é parede
if core.any():
    thick = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * m2px(0.20) + 1,) * 2))
    walls = walls & (1 - thick)
n, lab, st, _ = cv2.connectedComponentsWithStats(walls)
keep = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 1500])
walls = keep.astype(np.uint8)

# ---------- 2. divisas finas: linha reta, quase horizontal ou vertical, com as duas pontas encostando em parede
thin = ((gray < 120) & (walls == 0)).astype(np.uint8) * 255
segs = cv2.HoughLinesP(thin, 1, np.pi / 180, threshold=100, minLineLength=m2px(0.6), maxLineGap=8)
near = cv2.dilate(walls, np.ones((2 * m2px(0.10) + 1,) * 2, np.uint8))
bound = walls.copy()
bridges = 0
if segs is not None:
    for x1, y1, x2, y2 in np.asarray(segs).reshape(-1, 4):
        ang = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1))) % 90
        if min(ang, 90 - ang) > 3:
            continue
        if near[min(y1, H - 1), min(x1, W - 1)] and near[min(y2, H - 1), min(x2, W - 1)]:
            cv2.line(bound, (int(x1), int(y1)), (int(x2), int(y2)), 1, 5)
            bridges += 1

# ---------- 3. rótulos (inclui texto girado) e nome do ambiente
def lines_from_chars(chars):
    """Agrupa caracteres em linhas: horizontais por 'top', verticais por coluna x."""
    out = []
    hz = [c for c in chars if c.get('upright', True)]
    vt = [c for c in chars if not c.get('upright', True)]
    for group, key, order in ((hz, 'top', 'x0'), (vt, 'x0', 'top')):
        buckets = collections.defaultdict(list)
        for c in group:
            buckets[round(c[key] / 2)].append(c)
        for cs in buckets.values():
            cs.sort(key=lambda c: c[order])
            chunk = [cs[0]]
            for c in cs[1:]:
                gap = c[order] - (chunk[-1]['x1'] if order == 'x0' else chunk[-1]['bottom'])
                if gap > 6:
                    out.append(chunk); chunk = [c]
                else:
                    chunk.append(c)
            out.append(chunk)
    res = []
    for cs in out:
        txt = ''.join(c['text'] for c in cs)
        vertical = not cs[0].get('upright', True)
        if vertical and not re.search(r'A\s*=', txt) and re.search(r'=\s*A', txt[::-1] if False else txt):
            pass
        res.append(dict(text=txt, x0=min(c['x0'] for c in cs), x1=max(c['x1'] for c in cs),
                        top=min(c['top'] for c in cs), bottom=max(c['bottom'] for c in cs), vertical=vertical))
        if vertical:
            res.append(dict(res[-1], text=txt[::-1], rev=True))   # leitura de baixo para cima
    return res

lines = lines_from_chars(pg.chars)
titles = [l for l in lines if re.match(r'Planta baixa', l['text'])]
AREA = re.compile(r'A\s*=\s*([\d.]+,\d+)\s*m')
labels, seen = [], set()
for l in lines:
    m = AREA.search(l['text'])
    if not m:
        continue
    key = (round(l['x0']), round(l['top']))
    if key in seen:
        continue
    seen.add(key)
    area = float(m.group(1).replace('.', '').replace(',', '.'))
    cx_pt, cy_pt = (l['x0'] + l['x1']) / 2, (l['top'] + l['bottom']) / 2
    if l['vertical']:   # nome fica ao lado (à esquerda) na mesma coluna
        cands = [o for o in lines if o['vertical'] and o.get('rev') == l.get('rev') and 0 < l['x0'] - o['x1'] < 14 and abs((o['top'] + o['bottom']) / 2 - cy_pt) < 40]
    else:
        cands = [o for o in lines if not o['vertical'] and 0 < l['top'] - o['bottom'] < 14 and abs((o['x0'] + o['x1']) / 2 - cx_pt) < 45]
    cands = [o for o in cands if re.search(r'[A-Za-zÀ-ú]{3,}', o['text']) and not AREA.search(o['text'])]
    name = cands[0]['text'].strip() if cands else '?'
    below = [t for t in titles if t['top'] > l['top']]
    vista = min(below, key=lambda t: t['top'])['text'] if below else '?'
    labels.append(dict(nome=name, area_rotulo=area, vista=vista.replace('Planta baixa - ', ''), girado=l['vertical'], px=to_px(cx_pt, cy_pt)))

# ---------- 4. ambientes: watershed semeado nos rótulos
free = bound == 0
dist = ndi.distance_transform_edt(free)
markers = np.zeros((H, W), np.int32)
R = m2px(0.5)
for i, L in enumerate(labels, start=1):
    x, y = L['px']
    y0, y1, x0, x1 = max(0, y - R), min(H, y + R), max(0, x - R), min(W, x + R)
    yy, xx = np.unravel_index(np.argmax(dist[y0:y1, x0:x1]), (y1 - y0, x1 - x0))
    cv2.circle(markers, (int(x0 + xx), int(y0 + yy)), 6, i, -1)
ext = len(labels) + 1
markers[:4, :] = ext; markers[-4:, :] = ext; markers[:, :4] = ext; markers[:, -4:] = ext
regions = watershed(-dist, markers, mask=free)

overlay = img.copy()
rng = np.random.default_rng(3)
for i, L in enumerate(labels, start=1):
    mask = regions == i
    L['area_calc'] = round(float(mask.sum()) * MPX ** 2, 2)
    L['erro_pct'] = round((L['area_calc'] - L['area_rotulo']) / L['area_rotulo'] * 100, 1)
    col = rng.integers(70, 220, 3)
    overlay[mask] = (0.45 * col + 0.55 * overlay[mask]).astype(np.uint8)
overlay[walls == 1] = (0.25 * overlay[walls == 1] + 0.75 * np.array([25, 25, 25])).astype(np.uint8)
overlay[(bound == 1) & (walls == 0)] = (220, 40, 40)
for L in labels:
    x, y = L['px']
    cv2.putText(overlay, f"{L['area_calc']:.2f} ({L['erro_pct']:+.0f}%)", (x - 110, y + 50), cv2.FONT_HERSHEY_SIMPLEX, 0.95, (170, 0, 0), 3, cv2.LINE_AA)

stem = f"v2-p{page_no}"
cv2.imwrite(str(out_dir / f"{stem}-overlay.jpg"), cv2.cvtColor(cv2.resize(overlay, (W // 3, H // 3)), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 82])
json.dump(labels, open(out_dir / f"{stem}-ambientes.json", 'w'), ensure_ascii=False, indent=1)
ok = sum(abs(L['erro_pct']) <= 5 for L in labels)
print(f"limiar parede {WALL_T}, divisas finas {bridges}, rótulos {len(labels)} ({sum(L['girado'] for L in labels)} girados), dentro de 5%: {ok}/{len(labels)}")
for L in labels:
    flag = 'ok' if abs(L['erro_pct']) <= 5 else ('~' if abs(L['erro_pct']) <= 15 else 'X')
    print(f"{flag:2} {L['vista'][:8]:8} {L['nome'][:22]:22} {'g' if L['girado'] else ' '} rótulo {L['area_rotulo']:7.2f}  calc {L['area_calc']:7.2f}  {L['erro_pct']:+7.1f}%")
