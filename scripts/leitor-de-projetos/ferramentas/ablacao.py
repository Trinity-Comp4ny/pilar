import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import leitor
from leitor import Prancha, vaos_por_pontas, ambientes, juntar_vaos
pdf = sys.argv[1]
for dpi in (300, 200):
    leitor.DPI = dpi
    P = Prancha(pdf, 1); w = P.paredes()
    vp = vaos_por_pontas(P, w)
    for nome, v in (('só pontas', vp), ('pontas+fechamento', juntar_vaos(vp, P.vaos(w)))):
        labs, _, _ = ambientes(P, w, v)
        ok = sum(abs(l['erro_pct']) <= 5 for l in labs)
        print(f"{dpi} dpi  {nome:18} vãos {len(v):3}  dentro de 5%: {ok}/{len(labs)}  fora: {[l['nome'][:10] + f' {l['erro_pct']:+.0f}%' for l in labs if abs(l['erro_pct']) > 5]}")
    del P, w
