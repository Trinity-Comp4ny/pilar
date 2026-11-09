"""Esquadrias: tabela da prancha (gabarito) x códigos na planta x vãos medidos na geometria.

Uso: python esquadrias.py <pdf> <pagina> <saida_prefixo>
"""
import sys, re, json, math, collections
import numpy as np, cv2
sys.path.insert(0, __import__('os').path.dirname(__file__))
from leitor import Prancha, vaos_por_pontas, juntar_vaos

pdf, page, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
P = Prancha(pdf, page)
L = P.linhas()
num = lambda s: float(s.replace(',', '.'))
COD = re.compile(r'^(P|J)[A-Z]{1,3}\d{2,3}[A-Z]?$')

# 1. tabela de portas e janelas (texto vetorial): código, largura, altura, quantidade
tabela = {}
words = P.pg.extract_words()
titulos = [w for w in words if w['text'] == 'Tabela']
tab_box = [1e9, 1e9, -1e9, -1e9]
for tt in titulos:
    zona = [w for w in words if tt['x0'] - 140 < w['x0'] < tt['x1'] + 260 and tt['top'] < w['top'] < tt['top'] + 260]
    for w in zona:
        if not COD.match(w['text']) or w['x0'] > tt['x0'] - 60:
            continue
        linha = sorted([o for o in zona if abs(o['top'] - w['top']) < 3 and o['x0'] >= w['x0']], key=lambda o: o['x0'])
        txt = ' '.join(o['text'] for o in linha)
        dec = re.findall(r'\d+,\d+', txt)
        if not dec:                      # descrição quebrada em 2 linhas (JCV150): números ficam na linha de cima
            linha = sorted([o for o in zona if -12 < w['top'] - o['top'] < 3 and o['x0'] > w['x1']], key=lambda o: o['x0'])
            txt = w['text'] + ' ' + ' '.join(o['text'] for o in linha)
            dec = re.findall(r'\d+,\d+', txt)
        tail = re.findall(r'\b(\d{1,2})\s*$', txt)
        tabela[w['text']] = dict(largura=num(dec[0]) if dec else None, altura=num(dec[1]) if len(dec) > 1 else None,
                                 quant=int(tail[0]) if tail else None)
        tab_box = [min(tab_box[0], w['x0']), min(tab_box[1], w['top']), max(tab_box[2], linha[-1]['x1'] if linha else w['x1']), max(tab_box[3], w['bottom'])]
# linha quebrada (JCV150) e tabela à direita: ignora rótulos que caem dentro da área da tabela
tab_x = min((l['x0'] for l in L if l['text'].startswith('Tabela de')), default=1e9)

# 2. códigos na planta (inclui girados), fora da tabela
rotulos = []
for l in L:
    t = l['text'].strip()
    dentro_tab = tab_box[0] - 10 <= l['x0'] <= tab_box[2] + 10 and tab_box[1] - 10 <= l['top'] <= tab_box[3] + 10
    if COD.match(t) and not dentro_tab and not (l['vertical'] and not l['rev']):
        rotulos.append(dict(cod=t, px=P.px((l['x0'] + l['x1']) / 2, (l['top'] + l['bottom']) / 2), girado=l['vertical']))
cont = collections.Counter(r['cod'] for r in rotulos)
print('rótulos por código:', dict(cont))

# 3. vãos na geometria e casamento rótulo -> vão mais próximo
Pw = Prancha(pdf, int(sys.argv[4])) if len(sys.argv) > 4 else P
walls = Pw.paredes()
vaos = juntar_vaos(vaos_por_pontas(Pw, walls), Pw.vaos(walls))
usados = set()
for r in sorted(rotulos, key=lambda r: -(tabela.get(r['cod'], {}).get('largura') or 0)):   # maiores primeiro
    x, y = r['px']
    alvo = tabela.get(r['cod'], {}).get('largura')
    cands = [(abs(v['largura'] - alvo) if alvo else 0, math.hypot(v['cx'] - x, v['cy'] - y), i)
             for i, v in enumerate(vaos) if i not in usados and math.hypot(v['cx'] - x, v['cy'] - y) < P.m(2.5)]
    cands.sort()
    if cands and (alvo is None or cands[0][0] <= 0.15):
        i = cands[0][2]; usados.add(i)
        r['vao'] = round(vaos[i]['largura'], 2)
# 4. relatório
print(f"tabela: {len(tabela)} tipos, {sum(v['quant'] or 0 for v in tabela.values())} peças | rótulos na planta: {len(rotulos)} | vãos geométricos: {len(vaos)} (casados {len(usados)})")
ok_q = ok_w = tot_w = 0
for cod, t in sorted(tabela.items()):
    n = cont.get(cod, 0)
    larg = [r['vao'] for r in rotulos if r['cod'] == cod and 'vao' in r]
    tipo = ('porta' if cod[0] == 'P' else 'janela') + (' de vidro' if 'V' in cod[1:4] else '')
    q = 'ok' if n == t['quant'] else 'X '
    ok_q += n == t['quant']
    det = ''
    if larg and t['largura']:
        errs = [abs(w - t['largura']) for w in larg]
        tot_w += len(errs); ok_w += sum(e <= 0.10 for e in errs)
        det = 'vão medido ' + ', '.join(f"{w:.2f}" for w in larg)
    print(f"{q} {cod:7} {tipo:16} tabela {t['quant']} x {t['largura']}  | planta {n}  {det}")
print(f"\nquantidade por código certa: {ok_q}/{len(tabela)} | largura medida a até 10 cm da tabela: {ok_w}/{tot_w}")

ov = P.img.copy()
ov[walls == 1] = (40, 40, 40)
for i, v in enumerate(vaos):
    x, y, w, h = v['box']
    cv2.rectangle(ov, (x, y), (x + w, y + h), (0, 160, 255) if i in usados else (200, 200, 0), 6)
for r in rotulos:
    cv2.putText(ov, r['cod'] + (f" {r['vao']:.2f}" if 'vao' in r else ' ?'), (r['px'][0] - 60, r['px'][1] - 20),
                cv2.FONT_HERSHEY_SIMPLEX, 1.1, (200, 0, 0), 3, cv2.LINE_AA)
cv2.imwrite(out + '-esquadrias.jpg', cv2.cvtColor(cv2.resize(ov, (P.W // 3, P.H // 3)), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 82])
json.dump(dict(tabela=tabela, rotulos=rotulos), open(out + '-esquadrias.json', 'w'), ensure_ascii=False, indent=1, default=str)
