"""Leitor v3: prancha com QUADRO NUMERADO + marcadores na planta + cor de parede aprendida pela legenda."""
import re, sys, os, collections
import numpy as np, cv2, pdfplumber
sys.path.insert(0, os.path.dirname(__file__))
from leitor import Prancha, vaos_por_pontas, juntar_vaos
from leitor2 import escalas, rotulos_area, avaliar


def cor_parede_legenda(pg):
    """Cor do preenchimento ao lado do texto 'Parede...' na legenda (tupla RGB 0-1) ou None."""
    ws = pg.extract_words()
    for w in ws:
        if re.match(r'^Parede', w['text'], re.I):
            near = [o for o in list(pg.rects) + list(pg.curves) if o.get('fill') and abs((o['top'] + o['bottom']) / 2 - (w['top'] + w['bottom']) / 2) < 8
                    and 0 < w['x0'] - o['x1'] < 60 and isinstance(o.get('non_stroking_color'), (tuple, list))]
            if near:
                return tuple(round(c, 3) for c in near[0]['non_stroking_color'])
    return None


def paredes_por_cor(P, cor, tol=0.03):
    """Rasteriza os polígonos vetoriais preenchidos com a cor da legenda."""
    mask = np.zeros(P.gray.shape, np.uint8)
    n = 0
    for o in list(P.pg.curves) + list(P.pg.rects):
        c = o.get('non_stroking_color')
        if not o.get('fill') or not isinstance(c, (tuple, list)) or len(c) != 3 or max(abs(a - b) for a, b in zip(c, cor)) > tol:
            continue
        pts = o.get('pts') or [(o['x0'], o['top']), (o['x1'], o['top']), (o['x1'], o['bottom']), (o['x0'], o['bottom'])]
        poly = np.array([P.px(x, y) for x, y in pts], np.int32)
        if len(poly) >= 3:
            cv2.fillPoly(mask, [poly], 1)
            n += 1
    return mask, n


def marcadores(P, idxs, x_min_tabela):
    """Texto de 1-2 dígitos, claro (branco) e pequeno, fora da tabela = número do ambiente dentro da bolinha."""
    out = {}
    for w in P.pg.extract_words(extra_attrs=['non_stroking_color', 'size']):
        t = w['text']
        c = w.get('non_stroking_color')
        claro = isinstance(c, (tuple, list)) and len(c) == 3 and min(c) > 0.9
        if re.fullmatch(r'\d{1,2}', t) and t.zfill(2) in idxs and claro and w['x0'] > x_min_tabela and 6 <= w['size'] <= 12:
            out.setdefault(t.zfill(2), []).append(((w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2))
    return {k: v[0] for k, v in out.items()}


def ler_pagina(pdf, pno):
    P = Prancha(pdf, pno, denom=50)
    esc = escalas(P)
    den = collections.Counter(e['den'] for e in esc).most_common(1)[0][0] if esc else 50
    P = Prancha(pdf, pno, denom=den)
    linhas = [r for r in rotulos_area(P) if r.get('idx')]
    if not linhas:
        return dict(nota='sem quadro numerado nesta página')
    xs = sorted(r['x'] for r in linhas)
    x_med = xs[len(xs) // 2]
    tab = {}
    for r in sorted(linhas, key=lambda r: r['y']):                  # coluna principal do quadro; 1ª ocorrência de cada número
        if abs(r['x'] - x_med) <= 60:
            tab.setdefault(r['idx'].zfill(2), r)
    x_tab = x_med + 80
    mk = marcadores(P, set(tab), x_tab)
    cor = cor_parede_legenda(P.pg)
    if not cor:
        return dict(nota='legenda de parede não encontrada', quadro=len(tab), marcadores=len(mk))
    walls, nobj = paredes_por_cor(P, cor)
    vaos = juntar_vaos(vaos_por_pontas(P, walls), P.vaos(walls))
    rot = [dict(nome=f"{k} {tab[k]['nome']}", area=tab[k]['area'], x=x, y=y, pe_direito=tab[k]['pe_direito']) for k, (x, y) in mk.items()]
    res = avaliar(P, walls, rot, esc, den, vaos)
    return dict(escala=den, cor_parede=cor, objetos_parede=nobj, quadro=len(tab), marcadores=len(mk), pe_direito_lido=sum(1 for r in tab.values() if r['pe_direito']), resultado=res)


if __name__ == '__main__':
    pdf = sys.argv[1]
    for pno in range(1, min(len(pdfplumber.open(pdf).pages), int(sys.argv[2]) if len(sys.argv) > 2 else 3) + 1):
        r = ler_pagina(pdf, pno)
        print(f"\n== página {pno}")
        if 'resultado' not in r:
            print(r); continue
        res = r.pop('resultado')
        print({k: v for k, v in r.items()})
        ok = sum(abs(x['erro']) <= 5 for x in res)
        print(f"ambientes dentro de 5%: {ok}/{len(res)}")
        for x in sorted(res, key=lambda x: x['nome']):
            print(f"  {'ok' if abs(x['erro']) <= 5 else ('~' if abs(x['erro']) <= 15 else 'X ')} {x['nome'][:24]:24} tabela {x['rotulo']:6.2f}  planta {x['calc']:6.2f}  {x['erro']:+6.1f}%")
