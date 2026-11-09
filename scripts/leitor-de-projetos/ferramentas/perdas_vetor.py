import sys, os, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from leitor import Prancha
from leitor2 import rotulos_area
from bancada3 import CASOS
from bancada4 import EXTRA
refs = json.load(open('../dados/spike/refs.json'))
for caso in sys.argv[1:]:
    pdf, pno, _ = CASOS[caso] if caso in CASOS else EXTRA[caso]
    P = Prancha(pdf, pno, denom=50)
    L = P.linhas()
    rot = json.load(open(f'../dados/spike/ocr_{caso}.json'))
    livres = list(refs[caso]); extras = []
    for r in sorted(rot, key=lambda r: -r['n']):
        if not r['m2']: continue
        j = next((i for i, x in enumerate(livres) if abs(x - r['area']) <= 0.011), None)
        if j is not None: livres.pop(j)
        else: extras.append(r)
    print('==', caso, 'extras com m2:', len(extras))
    for r in extras[:6]:
        s = f"{r['area']:.2f}".replace('.', ',')
        achou = [l for l in L if s in l['text']]
        print(f"  {r['area']:7.2f} {r['nome'][:16]:16} | linhas no texto vetorial com '{s}':", [(l['text'][:40], 'V' if l['vertical'] else 'H') for l in achou][:3] or 'NENHUMA')
