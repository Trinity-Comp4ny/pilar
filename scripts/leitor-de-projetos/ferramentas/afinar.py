import sys, os, json, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from leitor import Prancha
from leitor2 import rotulos_area
from bancada3 import CASOS
from bancada4 import EXTRA
from verificar import ESCANEADA

casos = ['caso_a', 'caso_b_p1', 'caso_b_p2', 'caso_c_p1', 'caso_e', 'caso_f', 'caso_g', 'escaneada']
refs = {}
for c in casos:
    if c == 'escaneada':
        refs[c] = ESCANEADA
    else:
        pdf, pno, _ = CASOS[c] if c in CASOS else EXTRA[c]
        refs[c] = sorted(r['area'] for r in rotulos_area(Prancha(pdf, pno, denom=50)))
json.dump(refs, open('../dados/spike/refs.json', 'w'))
