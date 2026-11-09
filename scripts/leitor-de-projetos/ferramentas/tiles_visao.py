"""Gera blocos de planta para o teste de LLM de visão: janela com mais rótulos de área, imagem <= 1500 px e gabarito (texto vetorial) à parte."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pypdfium2 as pdfium
from leitor import Prancha
from leitor2 import rotulos_area
from bancada3 import CASOS
from bancada4 import EXTRA

JW, JH = 330, 240                                   # janela em pontos
out = '../dados/spike/visao/'
gt = {}
for caso in sys.argv[1:]:
    pdf, pno, _ = CASOS[caso] if caso in CASOS else EXTRA[caso]
    P = Prancha(pdf, pno, denom=50)
    ref = rotulos_area(P)
    pts = [(r['x'] - P.bx0, r['y'] - P.btop, r) for r in ref]
    melhor = max(((sum(1 for x, y, _ in pts if x0 <= x < x0 + JW and y0 <= y < y0 + JH), x0, y0) for x, y, _ in pts for x0 in (x - 60,) for y0 in (y - 60,)), key=lambda t: t[0])
    n, x0, y0 = melhor
    pg = pdfium.PdfDocument(pdf)[pno - 1]
    W, H = pg.get_size()
    x0, y0 = max(min(x0, W - JW), 0), max(min(y0, H - JH), 0)
    dpi = 1500 / JW * 72
    im = pg.render(scale=dpi / 72, crop=(x0, H - (y0 + JH), W - (x0 + JW), y0)).to_pil().convert('RGB')
    nome = f'bloco_{caso}.png'
    im.save(out + nome)
    dentro = [dict(nome=r['nome'], area=r['area']) for x, y, r in pts if x0 <= x < x0 + JW and y0 <= y < y0 + JH]
    import re
    pl = [w for w in P.pg.extract_words() if x0 <= w['x0'] - P.bx0 < x0 + JW and y0 <= w['top'] - P.btop < y0 + JH]
    codigos = sorted(w['text'] for w in pl if re.fullmatch(r'[PJM]\d{1,2}', w['text']))
    areas = {r['area'] for r in dentro}
    cotas = sorted(w['text'] for w in pl if re.fullmatch(r'\d{1,2},\d{2}', w['text']) and float(w['text'].replace(',', '.')) not in areas)
    gt[nome] = dict(ambientes=dentro, esquadrias=codigos, cotas=cotas)
    print(caso, nome, im.size, 'rotulos', len(dentro), 'codigos', len(codigos), 'cotas', len(cotas), flush=True)
json.dump(gt, open('../dados/spike/visao_gt/gabarito.json', 'w'), ensure_ascii=False, indent=1)
