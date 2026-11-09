"""Bancada automática: todo PDF com rótulo de área vira teste (o arquiteto escreveu a resposta).

Uso: python bancada2.py <pdf> [max_paginas]   -> uma linha JSON por página
Cada página é avaliada com dois detectores de parede (preenchimento escuro e linha dupla), separados,
para ver quando cada um funciona. A escolha automática entre eles fica para depois.
"""
import sys, os, json, collections
sys.path.insert(0, os.path.dirname(__file__))
import pdfplumber
from leitor import Prancha, vaos_por_pontas, juntar_vaos
from leitor2 import escalas, rotulos_area, paredes_duplas, avaliar

pdf = sys.argv[1]
maxp = int(sys.argv[2]) if len(sys.argv) > 2 else 6
npag = len(pdfplumber.open(pdf).pages)
for pno in range(1, min(npag, maxp) + 1):
    rec = dict(arquivo=os.path.basename(pdf)[:48], pagina=pno)
    try:
        P0 = Prancha(pdf, pno, denom=50)
        esc = escalas(P0)
        rot = rotulos_area(P0)
        rec.update(escalas=sorted(set(e['den'] for e in esc)), rotulos=len(rot), pe_direito_lido=sum(1 for r in rot if r.get('pe_direito')))
        if len(rot) < 2:
            rec['nota'] = 'menos de 2 rótulos de área: sem gabarito nesta página'
            print(json.dumps(rec, ensure_ascii=False), flush=True)
            continue
        padrao = collections.Counter(e['den'] for e in esc).most_common(1)[0][0] if esc else 50
        rec['escala_padrao'] = padrao
        for nome, fn in (('preenchimento', lambda P: P.paredes()),):
            try:
                P = Prancha(pdf, pno, denom=padrao)
                walls = fn(P)
                vaos = juntar_vaos(vaos_por_pontas(P, walls), P.vaos(walls)) if nome == 'preenchimento' else ()
                res = avaliar(P, walls, rot, esc, padrao, vaos)
                dentro = sum(abs(r['erro']) <= 5 for r in res)
                rec[nome] = dict(dentro_5pct=f"{dentro}/{len(res)}", mediana_erro=round(sorted(abs(r['erro']) for r in res)[len(res) // 2], 1),
                                 piores=[f"{r['nome'][:14]} {r['erro']:+.0f}%" for r in sorted(res, key=lambda r: -abs(r['erro']))[:3]])
                del P, walls
            except Exception as e:
                rec[nome] = dict(erro=f"{type(e).__name__}: {str(e)[:80]}")
    except Exception as e:
        rec['erro'] = f"{type(e).__name__}: {str(e)[:100]}"
    print(json.dumps(rec, ensure_ascii=False), flush=True)
