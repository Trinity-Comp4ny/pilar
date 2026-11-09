"""OCR de prancha: renderiza, lê palavras com posição (em pontos do PDF) e procura nome + 'NNN,NN m²'."""
import os, re, sys, json
os.environ.setdefault('TESSDATA_PREFIX', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tessdata'))
import numpy as np, pytesseract, pypdfium2 as pdfium
from PIL import Image

AREA = re.compile(r'(\d{1,4}(?:\.\d{3})*[,.]\d{1,2})\s*(?:m|M)\s*[²2zZ]?$')


def ocr_pagina(pdf, pno, dpi=200, regiao=None):
    pg = pdfium.PdfDocument(pdf)[pno - 1]
    img = pg.render(scale=dpi / 72).to_pil().convert('L')
    off = (0, 0)
    if regiao:                                           # (x0,y0,x1,y1) em fração da folha
        W, H = img.size
        box = (int(regiao[0] * W), int(regiao[1] * H), int(regiao[2] * W), int(regiao[3] * H))
        img = img.crop(box); off = box[:2]
    d = pytesseract.image_to_data(img, lang='por', config='--psm 11', output_type=pytesseract.Output.DICT)
    ws = []
    for i, t in enumerate(d['text']):
        t = t.strip()
        if t and float(d['conf'][i]) > 30:
            ws.append(dict(t=t, x=(d['left'][i] + off[0]) * 72 / dpi, y=(d['top'][i] + off[1]) * 72 / dpi, w=d['width'][i] * 72 / dpi, h=d['height'][i] * 72 / dpi, conf=float(d['conf'][i])))
    return ws


def rotulos(ws):
    """Junta palavras da mesma linha e acha 'NOME NNN,NN m²' ou nome acima da área."""
    linhas = []
    for w in sorted(ws, key=lambda w: (round(w['y'] / 6), w['x'])):
        if linhas and abs(linhas[-1][-1]['y'] - w['y']) < 6 and w['x'] - (linhas[-1][-1]['x'] + linhas[-1][-1]['w']) < 14:
            linhas[-1].append(w)
        else:
            linhas.append([w])
    texto = [dict(t=' '.join(w['t'] for w in l), x=l[0]['x'], y=l[0]['y'], x1=l[-1]['x'] + l[-1]['w']) for l in linhas]
    res = []
    for i, l in enumerate(texto):
        m = AREA.search(l['t'].replace(' ', ' '))
        if not m:
            continue
        v = float(m.group(1).replace('.', '').replace(',', '.')) if ',' in m.group(1) else float(m.group(1))
        nome = l['t'][:m.start()].strip(' :-')
        if not re.search(r'[A-Za-zÀ-ú]{3,}', nome):
            acima = [o for o in texto if 0 < l['y'] - o['y'] < 24 and abs(o['x'] - l['x']) < 80 and re.search(r'[A-Za-zÀ-ú]{3,}', o['t'])]
            nome = acima[-1]['t'] if acima else ''
        res.append(dict(nome=nome, area=v, x=l['x'], y=l['y'], bruto=l['t']))
    return res


if __name__ == '__main__':
    ws = ocr_pagina(sys.argv[1], int(sys.argv[2]), dpi=int(sys.argv[3]) if len(sys.argv) > 3 else 200)
    r = rotulos(ws)
    print(f"palavras={len(ws)} rótulos de área={len(r)}")
    for x in r[:20]:
        print(f"  {x['nome'][:28]:28} {x['area']:8.2f}   <- {x['bruto'][:50]!r}")
