"""Bancada v3: escala calibrada pelas cotas + 3 detectores de parede + seletor sem gabarito, comparado com o gabarito.

Uso: python bancada3.py <caso>   (casos: caso_a, caso_b_p1, caso_b_p2, caso_c_p1, caso_d)
"""
import sys, os, re, json, collections
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, cv2, pdfplumber
from leitor import Prancha, vaos_por_pontas, juntar_vaos
from leitor2 import escalas, rotulos_area, avaliar, paredes_limiar
from leitor3 import cor_parede_legenda, paredes_por_cor, marcadores
from leitor4 import paredes_linha_dupla_vetor, rotulos_ocr
from leitor5 import calibrar_por_cotas, encaixar_escala
from ocr import ocr_pagina

R = '../dados/raw2/pdf/'
CASOS = {
    'caso_a': ('../dados/raw/avulsos/caso_a.pdf', 1, 'texto'),
    'caso_b_p1': (R + 'caso_b.pdf', 1, 'texto'),
    'caso_b_p2': (R + 'caso_b.pdf', 2, 'texto'),
    'caso_c_p1': (R + 'caso_c.pdf', 1, 'quadro'),
    'caso_d': (R + 'caso_d.pdf', 1, 'ocr'),
}


def recortar(mask, rot, P, margem_m=4.0):
    """Zera a máscara fora da região dos rótulos de área (a planta) mais uma margem: ignora cortes, fachada, cobertura e quadros."""
    H, W = mask.shape
    if len(rot) < 4:
        return mask                                            # com poucos rótulos a região não é confiável (sala alongada passa da margem)
    pts = [P.px(r['x'], r['y']) for r in rot]
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    maior = max((r['area'] for r in rot if r.get('area')), default=0)
    mg = P.m(max(margem_m, 0.8 * maior ** 0.5))                # com poucos rótulos de ambiente grande, 4 m decepa as paredes
    x0, x1, y0, y1 = max(min(xs) - mg, 0), min(max(xs) + mg, W), max(min(ys) - mg, 0), min(max(ys) + mg, H)
    out = np.zeros_like(mask)
    out[y0:y1, x0:x1] = mask[y0:y1, x0:x1]
    return out


def pontuar(mask, mpx):
    """Pontuação sem gabarito: ambientes fechados plausíveis (1-120 m²) menos fragmentos minúsculos; mata máscara que cobre a folha."""
    frac = mask.mean()
    if frac > 0.10 or frac < 0.0005:
        return -99.0, 0, 0
    n, lab, st, _ = cv2.connectedComponentsWithStats((mask == 0).astype(np.uint8), connectivity=4)
    H, W = mask.shape
    bom = ruido = 0
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if x == 0 or y == 0 or x + w >= W or y + h >= H:
            continue                                      # toca a borda: é o exterior
        m2 = a * mpx ** 2
        if 1.0 <= m2 <= 120:
            bom += 1
        elif m2 < 0.3:
            ruido += 1
    return bom - 0.2 * ruido, bom, ruido


def main(caso):
    pdf, pno, modo = CASOS[caso] if caso in CASOS else (caso, 1, 'texto')
    pg0 = pdfplumber.open(pdf).pages[pno - 1]
    txt = ' '.join(w['text'] for w in pg0.extract_words())
    imp = sorted(set(int(x) for x in re.findall(r'ESC[A-Z]*\.?\s*:?\s*1\s*[:/]\s*(\d{2,3})\b', txt, re.I)))
    extra = []
    if modo == 'ocr':
        reg = (0.17, 0.33, 0.29, 0.90)
        wsr = ocr_pagina(pdf, pno, dpi=600, regiao=reg)
        extra = [dict(text=w['t'], x0=w['x'] + pg0.bbox[0], x1=w['x'] + w['w'] + pg0.bbox[0], top=w['y'] + pg0.bbox[1], bottom=w['y'] + w['h'] + pg0.bbox[1], upright=True, size=w['h']) for w in wsr]
    cal = calibrar_por_cotas(pg0, imp or [50], palavras_extra=extra)
    # escala: grupo de maior peso entre os que concordam com a escala impressa mais comum; senão a impressa
    den = (imp[0] if imp else 50)
    esc_info = 'impressa'
    if cal:
        grupos = [g for g in cal['grupos']]
        if modo == 'ocr':                                   # caso_d: dois grupos (74 e 76) são a mesma escala
            vizinhos = [g for g in grupos if abs(g['escala_equivalente'] - 75) <= 3]
            if vizinhos:
                den = sum(g['escala_equivalente'] for g in vizinhos) / len(vizinhos); esc_info = f"calibrada {den:.0f}"
        else:
            den = cal['escala_equivalente']; esc_info = f"calibrada {den}"
    if esc_info.startswith('calibrada'):
        den, enc = encaixar_escala(den)
        esc_info += f" -> {'padrão' if enc else 'solta'} 1:{den:.0f}"
    P = Prancha(pdf, pno, denom=den)
    rec = dict(caso=os.path.basename(caso)[:40], escala=esc_info, den=round(den, 1), impressas=imp)
    # rótulos (gabarito)
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
    rec['rotulos'] = len(rot)
    if len(rot) < 1:
        print(json.dumps(rec, ensure_ascii=False)); return
    mascaras = {f'preenchimento<{t}': (lambda t=t: paredes_limiar(P, t)) for t in (50, 90, 130, 170)}
    mascaras['linha_dupla'] = lambda: paredes_linha_dupla_vetor(P)[0]
    cor = cor_parede_legenda(P.pg)
    if cor:
        mascaras['cor_legenda'] = lambda: paredes_por_cor(P, cor)[0]
    out = {}
    rec['rotulos_com_pe_direito'] = sum(1 for r in rot if r.get('pe_direito'))
    for nome, fn in mascaras.items():
        try:
            m = recortar(fn(), rot, P)
            vaos = juntar_vaos(vaos_por_pontas(P, m), P.vaos(m))
            fechada = m.copy()
            for v_ in vaos:
                x_, y_, w_, h_ = v_['box']
                cv2.rectangle(fechada, (x_, y_), (x_ + max(w_, 1), y_ + max(h_, 1)), 1, -1)
            sc, bom, ruido = pontuar(fechada, P.mpx)
            res = avaliar(P, m, rot, [], den, vaos)
            ok = sum(abs(r['erro']) <= 5 for r in res)
            out[nome] = dict(pontuacao=round(sc, 1), fechados=bom, ruido=ruido, dentro5=f"{ok}/{len(res)}", ok=ok, erros=[round(r['erro'], 1) for r in res], nomes=[r['nome'][:18] for r in res])
        except Exception as e:
            out[nome] = dict(erro=f"{type(e).__name__}: {str(e)[:70]}")
    escolhido = max((k for k in out if 'pontuacao' in out[k]), key=lambda k: out[k]['pontuacao'], default=None)
    melhor = max((k for k in out if 'ok' in out[k]), key=lambda k: out[k]['ok'], default=None)
    rec.update(detectores=out, escolhido_pelo_seletor=escolhido, melhor_pelo_gabarito=melhor, seletor_acertou=bool(escolhido and melhor and out[escolhido]['ok'] >= out[melhor]['ok']))
    print(json.dumps(rec, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main(sys.argv[1])
