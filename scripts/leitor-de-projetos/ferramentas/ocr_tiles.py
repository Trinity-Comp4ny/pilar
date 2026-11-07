"""OCR em blocos: renderiza cada bloco da folha direto na resolução pedida (sem renderizar a folha inteira) e junta as palavras."""
import os, re, sys, json, time
os.environ.setdefault('TESSDATA_PREFIX', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tessdata'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pytesseract, pypdfium2 as pdfium
import pdfplumber
from leitor import Prancha
from leitor2 import rotulos_area
from bancada3 import CASOS
from bancada4 import EXTRA

NUM = re.compile(r'(\d{1,4}[,.]\d{2})(?!\d)')


def ocr_blocos(pdf, pno, dpi=600, bloco_pt=700, sobra_pt=40, giros=(0,)):
    doc = pdfium.PdfDocument(pdf); pg = doc[pno - 1]
    W, H = pg.get_size()
    ws, n = [], 0
    y = 0
    while y < H:
        x = 0
        while x < W:
            x0, y0 = max(x - sobra_pt, 0), max(y - sobra_pt, 0)
            x1, y1 = min(x + bloco_pt + sobra_pt, W), min(y + bloco_pt + sobra_pt, H)
            img = pg.render(scale=dpi / 72, crop=(x0, H - y1, W - x1, y0)).to_pil().convert('L')   # crop = (esq, baixo, dir, topo) cortados, em pontos
            for g in giros:
                im = img if g == 0 else img.rotate(g, expand=True)       # texto vertical: gira a imagem para o Tesseract ler na horizontal
                d = pytesseract.image_to_data(im, lang='por', config='--psm 11', output_type=pytesseract.Output.DICT)
                for i, t in enumerate(d['text']):
                    t = t.strip()
                    if t and float(d['conf'][i]) > 30:
                        xr, yr = d['left'][i], d['top'][i]
                        if g == 90:
                            xo, yo = img.width - yr, xr
                        elif g == 270:
                            xo, yo = yr, img.height - xr
                        else:
                            xo, yo = xr, yr
                        ws.append(dict(t=t, x=x0 + xo * 72 / dpi, y=y0 + yo * 72 / dpi, conf=float(d['conf'][i]), giro=g))
            n += 1
            x += bloco_pt
        y += bloco_pt
    return ws, n


def numeros(ws):
    out = []
    for w in ws:
        for m in NUM.finditer(w['t']):
            out.append((float(m.group(1).replace(',', '.')), w['x'], w['y']))
    out.sort(key=lambda t: (round(t[1]), round(t[2])))
    ded = []                                         # blocos se sobrepõem: mesmo valor a menos de 8 pt é o mesmo rótulo
    for v, x, y in out:
        if not any(abs(v - v2) < 0.001 and abs(x - x2) < 8 and abs(y - y2) < 8 for v2, x2, y2 in ded):
            ded.append((v, x, y))
    return ded


def casar(ref, got, tol=0.011):
    livres = list(got); ok = 0
    for v in ref:
        j = next((i for i, g in enumerate(livres) if abs(g - v) <= tol), None)
        if j is not None:
            ok += 1; livres.pop(j)
    return ok


def main(caso, dpis, giros=(0, 90, 270)):
    pdf, pno, _ = CASOS[caso] if caso in CASOS else EXTRA[caso]
    ref = sorted(r['area'] for r in rotulos_area(Prancha(pdf, pno, denom=50)))
    out = dict(caso=caso, vetor=len(ref))
    uniao = []
    for d in dpis:
        t0 = time.time()
        ws, n = ocr_blocos(pdf, pno, dpi=d, giros=giros)
        nums = [v for v, _, _ in numeros(ws)]
        uniao += nums
        out[f'blocos{d}'] = dict(recuperou=f"{casar(ref, nums)}/{len(ref)}", blocos=n, numeros_lidos=len(nums), t=round(time.time() - t0, 1))
        out['uniao'] = f"{casar(ref, uniao)}/{len(ref)}"
        print(json.dumps(out, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main(sys.argv[1], [int(x) for x in sys.argv[2:]] or [400, 600])
