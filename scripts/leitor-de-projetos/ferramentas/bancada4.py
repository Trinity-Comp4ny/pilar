"""Bancada v4: mesmo melhor detector por caso, avaliado por divisão (watershed) e por grupo (soma dos rótulos)."""
import sys, os, re, json, collections
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, cv2, pdfplumber
from leitor import Prancha, vaos_por_pontas, juntar_vaos
from leitor2 import rotulos_area, avaliar, paredes_limiar
from leitor3 import cor_parede_legenda, paredes_por_cor, marcadores
from leitor4 import paredes_linha_dupla_vetor, rotulos_ocr
from leitor5 import calibrar_por_cotas, encaixar_escala
from ocr import ocr_pagina
from grupos import avaliar_grupos
from bancada3 import CASOS, recortar

R4 = '../dados/raw4/pdf/'
EXTRA = {'caso_e': (R4 + 'caso_e.pdf', 1, 'texto'), 'caso_f': (R4 + 'caso_f.pdf', 1, 'texto'),
         'caso_g': (R4 + 'caso_g.pdf', 1, 'texto')}
MELHOR = {'caso_a': 'lim50', 'caso_b_p1': 'lim90', 'caso_b_p2': 'lim50', 'caso_c_p1': 'cor', 'caso_d': 'dupla', 'caso_e': 'dupla', 'caso_f': 'dupla', 'caso_g': 'dupla'}


def rodar(caso, modo_mascara=None):
    pdf, pno, modo = CASOS[caso] if caso in CASOS else EXTRA[caso]
    pg0 = pdfplumber.open(pdf).pages[pno - 1]
    txt = ' '.join(w['text'] for w in pg0.extract_words())
    imp = sorted(set(int(x) for x in re.findall(r'ESC[A-Z]*\.?\s*:?\s*1\s*[:/]\s*(\d{2,3})\b', txt, re.I)))
    extra, wsr = [], []
    if modo == 'ocr':
        wsr = ocr_pagina(pdf, pno, dpi=600, regiao=(0.17, 0.33, 0.29, 0.90))
        extra = [dict(text=w['t'], x0=w['x'] + pg0.bbox[0], x1=w['x'] + w['w'] + pg0.bbox[0], top=w['y'] + pg0.bbox[1], bottom=w['y'] + w['h'] + pg0.bbox[1], upright=True, size=w['h']) for w in wsr]
    cal = calibrar_por_cotas(pg0, imp or [50], palavras_extra=extra)
    den = float(imp[0]) if imp else 50.0
    if cal:
        if modo == 'ocr':
            viz = [g for g in cal['grupos'] if abs(g['escala_equivalente'] - 75) <= 3]
            den = sum(g['escala_equivalente'] for g in viz) / len(viz) if viz else den
        else:
            den = float(cal['escala_equivalente'])
        den, _ = encaixar_escala(den)
    P = Prancha(pdf, pno, denom=den)
    if modo == 'texto':
        rot = rotulos_area(P)
    elif modo == 'quadro':
        linhas = [r for r in rotulos_area(P) if r.get('idx')]
        xs = sorted(r['x'] for r in linhas); xm = xs[len(xs) // 2]
        tab = {}
        for r in sorted(linhas, key=lambda r: r['y']):
            if abs(r['x'] - xm) <= 60:
                tab.setdefault(r['idx'].zfill(2), r)
        mk = marcadores(P, set(tab), xm + 80)
        rot = [dict(nome=f"{k} {tab[k]['nome']}", area=tab[k]['area'], x=x, y=y) for k, (x, y) in mk.items()]
    else:
        rot = rotulos_ocr(wsr)
        for r in rot:
            r['x'] += P.bx0; r['y'] += P.btop
    det = modo_mascara or MELHOR[caso]
    if det == 'cor':
        m = paredes_por_cor(P, cor_parede_legenda(P.pg))[0]
    elif det == 'dupla':
        m = paredes_linha_dupla_vetor(P, comp_min_m=float(os.environ.get('COMP', '2.0')), erodir=os.environ.get('ERODE', '1') == '1')[0]
    else:
        m = paredes_limiar(P, int(det[3:]))
    m = recortar(m, rot, P)
    vaos = juntar_vaos(vaos_por_pontas(P, m), P.vaos(m))
    ws_res = avaliar(P, m, rot, [], den, vaos)
    gr, sem = avaliar_grupos(P, m, vaos, rot, den)
    ok_ws = sum(abs(r['erro']) <= 5 for r in ws_res)
    ok_gr = sum(g['k'] for g in gr if g['estado'] == 'confere')
    est = collections.Counter(g['estado'] for g in gr)
    return dict(caso=caso, escala=f"1:{den:.0f}", detector=det, rotulos=len(rot), divisao_5pct=f"{ok_ws}/{len(rot)}", grupo_confere=f"{ok_gr}/{len(rot)}",
                grupos=len(gr), estados=dict(est), abertos=[g for g in gr if g['k'] >= 2][:4], vazam=[(g['nomes'], g['erro']) for g in gr if g['estado'] == 'vaza'][:4])


if __name__ == '__main__':
    for c in sys.argv[1:]:
        try:
            print(json.dumps(rodar(c), ensure_ascii=False), flush=True)
        except Exception as e:
            print(json.dumps(dict(caso=c, erro=f"{type(e).__name__}: {str(e)[:120]}")), flush=True)
