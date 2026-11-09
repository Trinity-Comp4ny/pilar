"""Bancada de testes do Leitor de projetos: roda tudo nos arquivos reais e grava o placar.

Uso: python bancada.py <pasta_vrz> [nota da rodada]
Cada rodada vira uma linha em placar.jsonl; a tela mostra a diferença para a rodada anterior.
"""
import sys, os, re, json, time, collections, pathlib
sys.path.insert(0, os.path.dirname(__file__))
import pdfplumber
from leitor import Prancha, vaos_por_pontas, ambientes, juntar_vaos

V = pathlib.Path(sys.argv[1])
nota = ' '.join(sys.argv[2:]) or '-'
ARQ = V / 'raw/avulsos/caso_a.pdf'
num = lambda s: float(s.replace('.', '').replace(',', '.'))
placar, detalhes = {}, {}

# 1. ambientes (prancha de layout E01): área calculada x rótulo do arquiteto
P1 = Prancha(str(ARQ), 1)
w1 = P1.paredes()
v1 = juntar_vaos(vaos_por_pontas(P1, w1), P1.vaos(w1))
amb, _, _ = ambientes(P1, w1, v1)
placar['ambientes_5pct'] = f"{sum(abs(a['erro_pct']) <= 5 for a in amb)}/{len(amb)}"
detalhes['ambientes_fora'] = [f"{a['nome']} {a['erro_pct']:+.0f}%" for a in amb if abs(a['erro_pct']) > 5]

# 2. esquadrias (E02): tabela x rótulos x vãos (reaproveita o script)
import subprocess
r = subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'esquadrias.py'), str(ARQ), '2', str(V / 'spike/e02'), '1'],
                   capture_output=True, text=True)
m1 = re.search(r'quantidade por código certa: (\d+/\d+) \| largura medida a até 10 cm da tabela: (\d+/\d+)', r.stdout)
m0 = re.search(r'tabela: (\d+) tipos, (\d+) peças \| rótulos na planta: (\d+)', r.stdout)
placar['esquadrias_tipos'] = m1.group(1) if m1 else 'erro'
placar['esquadrias_pecas'] = f"{m0.group(3)}/{m0.group(2)}" if m0 else 'erro'
placar['esquadrias_largura_10cm'] = m1.group(2) if m1 else 'erro'
detalhes['esquadrias_falhas'] = [l.strip() for l in r.stdout.splitlines() if l.startswith('X ')]

# 3. quadro de áreas: leitura e conferência da soma
txt = ' '.join(l['text'] for l in P1.linhas())
qa = {k: num(m.group(1)) for k, pat in (('terreno', r'TERRENO\.+\s*([\d.,]+)'), ('terreo', r'P\.?A\.?V\.? T[ÉE]RREO\.+\s*([\d.,]+)'),
                                         ('superior', r'P\.?A\.?V\.? SUPERIOR\.+\s*([\d.,]+)'), ('piscina', r'PISCINA\.+\s*([\d.,]+)'),
                                         ('total', r'TOTAL\.+\s*([\d.,]+)')) if (m := re.search(pat, txt))}
soma_ok = all(k in qa for k in ('terreo', 'superior', 'piscina', 'total')) and abs(qa['terreo'] + qa['superior'] + qa['piscina'] - qa['total']) < 0.05
placar['quadro_areas'] = f"{len(qa)}/5 lidos, soma {'confere' if soma_ok else 'NÃO confere'}"
detalhes['quadro_areas'] = qa

# 4. estrutural: quantitativo (tabela) com totais conferidos
pg = pdfplumber.open(V / 'raw/R01/328 - Quantitativo [cliente A].pdf').pages[0]
rows = [r for t in pg.extract_tables() for r in t]
PAVS = ('Piscina', 'Terreo', 'Intermeidário', 'Superior', 'Cobertura', 'Ático', 'TOTAL')
conc = {r[4]: r[5] for r in rows if len(r) > 6 and r[4] in PAVS and r[5] and re.match(r'^\d+$', str(r[5]).strip())}
forma = {r[4]: r[8] for r in rows if len(r) > 8 and r[4] in PAVS and r[8] and re.match(r'^\d+$', str(r[8]).strip())}
tot_c = sum(int(v) for k, v in conc.items() if k != 'TOTAL')
tot_f = sum(int(v) for k, v in forma.items() if k != 'TOTAL')
placar['estrutural_quantitativo'] = f"concreto {conc.get('TOTAL')} m³ (soma {tot_c}), fôrma {forma.get('TOTAL')} m² (soma {tot_f})"

# 5. elétrico (DWG): contagem sem duplicata, guardada como gabarito para a leitura do PDF
dxf = {p.name: p for p in (V / 'dxf').glob('328-ELE-EX-0[12]-01-R00.dxf')}
if dxf:
    from ezdxf import recover
    tot = {}
    for name, p in sorted(dxf.items()):
        doc, _ = recover.readfile(str(p))
        pts = {}
        for e in doc.modelspace().query('INSERT'):
            n = e.dxf.name.lower()
            k = next((k for k, pat in (('luz', 'ponto de luz'), ('tomada', 'tomada'), ('interruptor', 'interruptor'), ('forca', 'ponto de for')) if pat in n), None)
            if k:
                pts.setdefault((k, round(e.dxf.insert[0] / 10), round(e.dxf.insert[1] / 10)), 1)
        tot[name[:13]] = dict(collections.Counter(k for k, _, _ in pts))
    placar['eletrico_dwg'] = tot

reg = dict(quando=time.strftime('%Y-%m-%d %H:%M'), nota=nota, placar=placar, detalhes=detalhes)
hist = V / 'placar.jsonl'
anterior = json.loads(hist.read_text().splitlines()[-1]) if hist.exists() and hist.read_text().strip() else None
with open(hist, 'a') as f:
    f.write(json.dumps(reg, ensure_ascii=False) + '\n')
print(f"\nPLACAR  {reg['quando']}  ({nota})")
for k, v in placar.items():
    antes = anterior['placar'].get(k) if anterior else None
    print(f"  {k:26} {v}" + (f"   (antes: {antes})" if antes is not None and antes != v else ''))
print('\nfalhas:')
for k, v in detalhes.items():
    if v and k != 'quadro_areas':
        print(f"  {k}: {v}")
