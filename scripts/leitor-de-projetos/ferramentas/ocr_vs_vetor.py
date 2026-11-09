"""Texto vetorial (gabarito) x OCR Tesseract na folha inteira: quantos rótulos de área o OCR recupera, a que resolução e quanto tempo gasta."""
import sys, os, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pdfplumber
from leitor import Prancha
from leitor2 import rotulos_area
from ocr import ocr_pagina, rotulos
from bancada3 import CASOS
from bancada4 import EXTRA


def casar(ref, got, tol=0.011):
    """Valores de área de ref achados em got (cada valor de got usado uma vez)."""
    livres = list(got); ok = 0
    for v in ref:
        j = next((i for i, g in enumerate(livres) if abs(g - v) <= tol), None)
        if j is not None:
            ok += 1; livres.pop(j)
    return ok, livres


def main(caso, dpis):
    pdf, pno, _ = CASOS[caso] if caso in CASOS else EXTRA[caso]
    pg = pdfplumber.open(pdf).pages[pno - 1]
    maior = max(pg.width, pg.height)
    t0 = time.time()
    ref = sorted(r['area'] for r in rotulos_area(Prancha(pdf, pno, denom=50)))
    out = dict(caso=caso, folha_pt=[round(pg.width), round(pg.height)], vetor=len(ref), t_vetor=round(time.time() - t0, 1))
    for d in dpis:
        dpi = min(d, 9000 / maior * 72)
        t0 = time.time()
        ws = ocr_pagina(pdf, pno, dpi=dpi)
        rot = rotulos(ws)
        ok, extras = casar(ref, [r['area'] for r in rot])
        out[f'ocr{d}'] = dict(dpi=round(dpi), recuperou=f"{ok}/{len(ref)}", rotulos_ocr=len(rot), extras=len(extras), palavras=len(ws), t=round(time.time() - t0, 1))
        print(json.dumps(out, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main(sys.argv[1], [int(x) for x in sys.argv[2:]] or [200, 400])
