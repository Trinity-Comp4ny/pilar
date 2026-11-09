"""Spike 2: ambientes a partir da planta vetorial (bloco da arquitetura dentro do DWG).

Uso: python dwgrooms.py <dxf> <rotulos_pdf.json> <saida.png>
"""
import sys, json, re, unicodedata
import ezdxf
from ezdxf import recover, path as ezpath
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

dxf, ref_json, out_png = sys.argv[1], sys.argv[2], sys.argv[3]
doc, _ = recover.readfile(dxf)
msp = doc.modelspace()
blk = next(b for b in doc.blocks if 'TERREO_dwg' in b.name and not b.name.startswith('*'))

def polys_from(e):
    out = []
    try:
        if e.dxftype() == 'HATCH':
            for p in ezpath.from_hatch(e):
                pts = [(v.x, v.y) for v in p.flattening(0.5)]
                if len(pts) >= 3:
                    out.append(Polygon(pts).buffer(0))
        elif e.dxftype() == 'LWPOLYLINE':
            pts = [(x, y) for x, y, *_ in e.get_points()]
            if e.closed and len(pts) >= 3:
                out.append(Polygon(pts).buffer(0))
            elif len(pts) >= 2:
                out.append(LineString(pts).buffer(1.5))
        elif e.dxftype() == 'LINE':
            out.append(LineString([e.dxf.start[:2], e.dxf.end[:2]]).buffer(1.5))
        elif e.dxftype() == 'ARC':
            c = e.dxf.center
            for q in (e.start_point, e.end_point):       # dobradiça até as pontas: fecha o vão da porta
                out.append(LineString([(c.x, c.y), (q.x, q.y)]).buffer(1.5))
    except Exception:
        pass
    return out

walls, frames = [], []
for e in blk:
    if e.dxf.layer in ('PAREDES', 'PILAR'):
        walls += polys_from(e)
    elif e.dxf.layer == 'ESQUADRIAS' and e.dxftype() in ('LWPOLYLINE', 'LINE', 'ARC'):
        frames += polys_from(e)
wall_u = unary_union([g for g in walls if g.is_valid and not g.is_empty])
solid = unary_union([wall_u] + [g for g in frames if g.is_valid])
minx, miny, maxx, maxy = wall_u.bounds
env = box(minx - 50, miny - 50, maxx + 50, maxy + 50)
free = env.difference(solid)
parts = [g for g in getattr(free, 'geoms', [free]) if g.area > 0.6e4]          # > 0,6 m² (unidade: cm)
outer = max(parts, key=lambda g: g.intersection(env.exterior.buffer(60)).area)
rooms = [g for g in parts if g is not outer]

# rótulos: etiquetas de ambiente no espaço do modelo, levadas para o sistema do bloco (inserção com escala 1)
ins = [e for e in msp.query('INSERT') if e.dxf.name == blk.name]
labels = []
for t in msp.query('MTEXT[layer=="A-AREA-IDEN"]'):
    name = re.sub(r'\\[^;]*;|[{}]', '', t.plain_text()).strip().split('\n')[0]
    p = t.dxf.insert
    for i in ins:
        q = Point(p[0] - i.dxf.insert[0], p[1] - i.dxf.insert[1])
        if env.contains(q):
            labels.append((name, q))
            break

norm = lambda s: unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower().replace(' ', '').replace('.', '').replace('/', '')
ref = {norm(r['nome']): r['area_rotulo'] for r in json.load(open(ref_json)) if r['vista'].startswith('T')}

rows = []
for g in rooms:
    inside = [n for n, q in labels if g.contains(q)]
    name = inside[0] if inside else '(sem rótulo)'
    area = g.area / 1e4
    alvo = next((v for k, v in ref.items() if k and (k in norm(name) or norm(name) in k)), None)
    rows.append((name, area, alvo))

fig, ax = plt.subplots(figsize=(14, 8))
for g in getattr(wall_u, 'geoms', [wall_u]):
    ax.fill(*g.exterior.xy, color='#222', lw=0)
for (name, area, alvo), g in zip(rows, rooms):
    ax.fill(*g.exterior.xy, alpha=.45)
    c = g.representative_point()
    err = f" ({(area - alvo) / alvo * 100:+.0f}%)" if alvo else ''
    ax.text(c.x, c.y, f"{name}\n{area:.2f} m²{err}", ha='center', va='center', fontsize=7)
ax.set_aspect('equal'); ax.axis('off')
plt.savefig(out_png, dpi=140, bbox_inches='tight')

print(f"paredes {len(walls)} peças, esquadrias {len(frames)}, ambientes fechados {len(rooms)}, rótulos {len(labels)}")
for name, area, alvo in sorted(rows, key=lambda r: -r[1]):
    if alvo:
        e = (area - alvo) / alvo * 100
        flag = 'ok' if abs(e) <= 5 else ('~' if abs(e) <= 15 else 'X')
        print(f"{flag:2} {name[:22]:22} calc {area:7.2f}  arquiteto {alvo:7.2f}  {e:+6.1f}%")
    else:
        print(f"   {name[:22]:22} calc {area:7.2f}")
