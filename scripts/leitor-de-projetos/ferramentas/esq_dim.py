"""Esquadrias sem tabela: medida escrita no rótulo x largura do vão medido na geometria.

Uso: python esq_dim.py <caso>   (caso C, caso_a, caso_g, caso_f)
"""
import sys, os, math, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, cv2, pdfplumber
from leitor import Prancha, vaos_por_pontas, juntar_vaos
from leitor2 import paredes_limiar
from leitor3 import cor_parede_legenda, paredes_por_cor
from leitor4 import paredes_linha_dupla_vetor
from biblioteca import parse_dimensao

R4 = '../dados/raw4/pdf/'; R2 = '../dados/raw2/pdf/'
CASOS = {
    'caso C': (R2 + 'caso_c.pdf', 1, 50, 'cor'),
    'caso_a': ('../dados/raw/avulsos/caso_a.pdf', 2, 50, 'limiar110'),
    'caso_g': (R4 + 'caso_g.pdf', 1, 50, 'dupla'),
    'caso_f': (R4 + 'caso_f.pdf', 1, 100, 'dupla'),
}
pdf, pno, den, modo = CASOS[sys.argv[1]]
P = Prancha(pdf, pno, denom=den)
if modo == 'cor':
    w = paredes_por_cor(P, cor_parede_legenda(P.pg))[0]
elif modo == 'dupla':
    w = paredes_linha_dupla_vetor(P)[0]
else:
    w = paredes_limiar(P, 110 if modo == 'limiar110' else 50)
vaos = juntar_vaos(vaos_por_pontas(P, w), P.vaos(w))
rot = []
for wd in P.pg.extract_words(extra_attrs=['upright']):
    r = parse_dimensao(wd['text'], permitir_invertido=not wd.get('upright', True), preferir_invertido=not wd.get('upright', True))
    if r:
        r['px'] = P.px((wd['x0'] + wd['x1']) / 2, (wd['top'] + wd['bottom']) / 2); r['txt'] = wd['text']
        rot.append(r)
usado = set(); ok = []; falhas = []
for r in sorted(rot, key=lambda r: -r['largura_m']):                     # largura maior primeiro (menos ambígua)
    x, y = r['px']
    cands = [(abs(v['largura'] - r['largura_m']), math.hypot(v['cx'] - x, v['cy'] - y), i) for i, v in enumerate(vaos)
             if i not in usado and math.hypot(v['cx'] - x, v['cy'] - y) < P.m(2.2)]
    cands.sort()
    if cands and cands[0][0] <= 0.12:
        usado.add(cands[0][2]); ok.append((r['txt'], r['largura_m'], round(vaos[cands[0][2]]['largura'], 2)))
    else:
        falhas.append((r['txt'], r['largura_m'], round(min(cands)[0], 2) if cands else None))
print(f"{sys.argv[1]}: máscara={modo} | medidas lidas={len(rot)} | vãos geométricos={len(vaos)} | medida escrita = vão medido (±12 cm): {len(ok)}/{len(rot)}")
erros = [abs(a - b) for _, a, b in ok]
if erros:
    print(f"   erro de largura nos casados: mediana {np.median(erros)*100:.0f} cm, máximo {max(erros)*100:.0f} cm")
print('   sem par:', falhas[:8])
