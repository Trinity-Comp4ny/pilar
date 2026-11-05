import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from leitor import Prancha
from leitor2 import rotulos_area
from bancada3 import CASOS
from bancada4 import EXTRA
antes = json.load(open('../dados/spike/refs.json'))
tot_a = tot_d = 0
for caso in ['caso_a', 'caso_b_p1', 'caso_b_p2', 'caso_c_p1', 'caso_e', 'caso_f', 'caso_g']:
    pdf, pno, _ = CASOS[caso] if caso in CASOS else EXTRA[caso]
    rot = rotulos_area(Prancha(pdf, pno, denom=50))
    depois = sorted(r['area'] for r in rot)
    ocr = json.load(open(f'../dados/spike/ocr_{caso}.json'))
    novos = list(depois)
    for v in antes[caso]:
        if v in novos: novos.remove(v)
    perdidos = list(antes[caso])
    for v in depois:
        if v in perdidos: perdidos.remove(v)
    conf = [v for v in novos if any(abs(o['area'] - v) < 0.011 and o['m2'] for o in ocr)]
    tot_a += len(antes[caso]); tot_d += len(depois)
    print(caso, 'antes', len(antes[caso]), 'depois', len(depois), '| novos', [(round(v, 2)) for v in novos], '(confirmados pelo OCR com m2:', len(conf), ')', '| perdidos', perdidos)
print('TOTAL antes', tot_a, 'depois', tot_d)
