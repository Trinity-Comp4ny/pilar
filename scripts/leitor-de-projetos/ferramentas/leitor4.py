"""Leitor v4: parede de linha dupla por vetor (pares de segmentos paralelos) + rótulos por OCR."""
import re, sys, os, bisect, collections
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(__file__))
from leitor import Prancha, vaos_por_pontas, juntar_vaos
from leitor2 import avaliar
from ocr import ocr_pagina


def segmentos(pg, comp_min_pt):
    """Segmentos horizontais e verticais (linhas, curvas e retângulos) em pontos da página."""
    H, V = [], []
    def add(x0, y0, x1, y1):
        if abs(y1 - y0) < 0.3 and abs(x1 - x0) >= comp_min_pt:
            H.append((((y0 + y1) / 2), min(x0, x1), max(x0, x1)))
        elif abs(x1 - x0) < 0.3 and abs(y1 - y0) >= comp_min_pt:
            V.append((((x0 + x1) / 2), min(y0, y1), max(y0, y1)))
    for o in pg.lines:
        add(o['x0'], o['top'], o['x1'], o['bottom'])
    for o in list(pg.curves) + list(pg.rects):
        pts = o.get('pts') or []
        for (a, b), (c, d) in zip(pts, pts[1:]):
            add(a, b, c, d)
    return H, V


def pares(segs, t_min, t_max, ov_min):
    """Pares paralelos com afastamento entre t_min e t_max e sobreposição >= ov_min -> retângulos (c1, c2, ini, fim)."""
    segs = sorted(segs)
    chaves = [s[0] for s in segs]
    out = []
    for i, (c, a0, a1) in enumerate(segs):
        j = bisect.bisect_right(chaves, c + t_min)
        while j < len(segs) and segs[j][0] <= c + t_max:
            c2, b0, b1 = segs[j]
            ini, fim = max(a0, b0), min(a1, b1)
            if fim - ini >= ov_min:
                out.append((c, c2, ini, fim))
            j += 1
    return out


def paredes_linha_dupla_vetor(P, t_min_m=0.09, t_max_m=0.35, ov_min_m=0.9, comp_min_m=2.0, erodir=True):
    pt = lambda m: m / P.denom * 1000 / 25.4 * 72              # metros reais -> pontos de papel
    H, V = segmentos(P.pg, pt(ov_min_m))
    mask = np.zeros(P.gray.shape, np.uint8)
    nh = nv = 0
    for c1, c2, a, b in pares(H, pt(t_min_m), pt(t_max_m), pt(ov_min_m)):
        x0, y0 = P.px(a, c1); x1, y1 = P.px(b, c2)
        cv2.rectangle(mask, (x0, y0), (x1, y1), 1, -1); nh += 1
    for c1, c2, a, b in pares(V, pt(t_min_m), pt(t_max_m), pt(ov_min_m)):
        x0, y0 = P.px(c1, a); x1, y1 = P.px(c2, b)
        cv2.rectangle(mask, (x0, y0), (x1, y1), 1, -1); nv += 1
    # junta cantos e tira restos curtos
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask)
    keep = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > P.m(0.6) * P.m(0.1) and max(st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]) >= P.m(comp_min_m)]
    out = np.isin(lab, keep).astype(np.uint8)
    if erodir:
        out = cv2.erode(out, np.ones((3, 3), np.uint8))      # o retângulo entre as duas linhas come ~1 px de cada lado do cômodo
    return out, nh, nv


NOME = re.compile(r'^[A-ZÀ-Ú/][A-ZÀ-Ú/ .]{2,}$')
IGN = re.compile(r'^(LIMITE|FAIXA|ACESSO|PASSEIO|SOBE|DESCE|ESC|CALHA|CORTE|PLANTA|PISO|ÁRVORE|ARVORE)', re.I)


def rotulos_ocr(ws):
    """Nome (maiúsculas) com número 'NNN,NN' logo abaixo = ambiente com área. Quando o OCR perde o 'm²', o número vale mesmo assim."""
    nums = [w for w in ws if re.fullmatch(r'\d{1,4},\d{2}', w['t'])]
    nomes = [w for w in ws if NOME.match(w['t']) and not IGN.match(w['t'])]
    out = []
    for n in nums:
        v = float(n['t'].replace(',', '.'))
        if v < 1.0:
            continue
        acima = [o for o in nomes if 0 < n['y'] - o['y'] < 22 and abs((o['x'] + o['w'] / 2) - (n['x'] + n['w'] / 2)) < 40]
        if acima:
            o = min(acima, key=lambda o: n['y'] - o['y'])
            out.append(dict(nome=o['t'], area=v, x=n['x'] + n['w'] / 2, y=n['y'], conf=min(n['conf'], o['conf'])))
    return out


def rodar(pdf, regiao, den=100, dpi_ocr=600):
    ws = ocr_pagina(pdf, 1, dpi=dpi_ocr, regiao=regiao)
    rot = rotulos_ocr(ws)
    P = Prancha(pdf, 1, denom=den)
    for r in rot:                                      # coordenadas do OCR (topo-esq da folha) -> sistema do pdfplumber
        r['x'] += P.bx0; r['y'] += P.btop
    walls, nh, nv = paredes_linha_dupla_vetor(P)
    vaos = juntar_vaos(vaos_por_pontas(P, walls), P.vaos(walls))
    res = avaliar(P, walls, rot, [], den, vaos) if rot else []
    return rot, res, nh, nv, int(walls.sum()), P
