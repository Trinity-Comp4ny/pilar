import sys, re, collections, math
from ezdxf import recover
TYPES = (('luz', 'ponto de luz'), ('tomada', 'tomada'), ('interruptor', 'interruptor'), ('força', 'ponto de for'))
for f in sys.argv[1:]:
    doc, _ = recover.readfile(f); msp = doc.modelspace()
    labels = []
    for t in msp.query('MTEXT[layer=="A-AREA-IDEN"]'):
        labels.append((re.sub(r'\\[^;]*;|[{}]', '', t.plain_text()).strip().split('\n')[0], t.dxf.insert[0], t.dxf.insert[1]))
    pts, raw = {}, 0
    for e in msp.query('INSERT'):
        n = e.dxf.name.lower()
        kind = next((k for k, pat in TYPES if pat in n), None)
        if not kind:
            continue
        raw += 1
        x, y = e.dxf.insert[0], e.dxf.insert[1]
        pts.setdefault((kind, round(x / 10), round(y / 10)), (x, y))          # mesma posição (10 cm) = mesmo ponto
    per = collections.defaultdict(collections.Counter)
    for (kind, _, _), (x, y) in pts.items():
        room = min(labels, key=lambda l: math.hypot(l[1] - x, l[2] - y))[0] if labels else '?'
        per[room][kind] += 1
    tot = collections.Counter(k for k, _, _ in pts)
    print(f"\n### {f.split('/')[-1]}: {raw} inserções -> {len(pts)} pontos únicos {dict(tot)}")
    for room, c in sorted(per.items(), key=lambda r: -sum(r[1].values())):
        print(f"  {room[:20]:20} " + '  '.join(f"{k} {c[k]}" for k, _ in TYPES if c[k]))
