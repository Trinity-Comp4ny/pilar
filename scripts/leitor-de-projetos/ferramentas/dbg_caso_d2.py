import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2, pdfplumber
from leitor import Prancha, vaos_por_pontas, juntar_vaos
from leitor4 import paredes_linha_dupla_vetor, rotulos_ocr
from ocr import ocr_pagina
from bancada3 import recortar
pdf = '../dados/raw2/pdf/caso_d.pdf'
cache = '../dados/spike/caso_d_ws.json'
if os.path.exists(cache):
    wsr = json.load(open(cache))
else:
    wsr = ocr_pagina(pdf, 1, dpi=600, regiao=(0.17, 0.33, 0.29, 0.90)); json.dump(wsr, open(cache, 'w'))
for den in (75.0,):
    P = Prancha(pdf, 1, denom=den)
    rot = rotulos_ocr(wsr)
    for r in rot: r['x'] += P.bx0; r['y'] += P.btop
    sx, sy = P.px(rot[0]['x'], rot[0]['y'])
    for er in (True,):
        m, nh, nv = paredes_linha_dupla_vetor(P, erodir=er)
        print('bbox rot', sx, sy, 'mask', m.shape, 'P.m(11)=', P.m(11), flush=True)
        m = recortar(m, rot, P)
        vaos = juntar_vaos(vaos_por_pontas(P, m), P.vaos(m))
        f = m.copy()
        for v in vaos:
            x, y, w, h = v['box']; cv2.rectangle(f, (x, y), (x + max(w, 1), y + max(h, 1)), 1, -1)
        n, lab, st, _ = cv2.connectedComponentsWithStats((f == 0).astype(np.uint8), connectivity=4)
        c = lab[sy, sx]
        a = st[c, cv2.CC_STAT_AREA] * P.mpx ** 2 if c else -1
        print(f"den={den} erodir={er} pares h/v={nh}/{nv} parede_px={int(m.sum())} vaos={len(vaos)} seed=({sx},{sy}) comp={c} area_livre={a:.1f} m2 (rotulo {rot[0]['area']})", flush=True)
