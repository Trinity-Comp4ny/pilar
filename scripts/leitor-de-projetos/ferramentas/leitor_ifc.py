"""Leitor de IFC de arquitetura -> modelo do Pilar (pavimento, ambiente, parede com faces, vão, esquadria).

Uso: python leitor_ifc.py <arquivo.ifc> [saida.json]
Tudo em metros. Cada elemento leva 'origem' (ifc), 'guid' e o pavimento. Faces de parede: ambientes que encostam na parede.
"""
import sys, json, collections, math
import numpy as np
import ifcopenshell, ifcopenshell.geom as G, ifcopenshell.util.element as U, ifcopenshell.util.unit as UN
from shapely.geometry import Polygon, MultiPolygon, MultiPoint, box
from shapely.ops import unary_union


def pegar(m, cls):
    out = []
    for c in ([cls] if isinstance(cls, str) else cls):
        out += m.by_type(c)
    return out


def footprint(settings, el):
    """Contorno em planta (união dos triângulos da base) e faixa de cotas z, em metros."""
    sh = G.create_shape(settings, el)
    v = np.array(sh.geometry.verts).reshape(-1, 3)
    f = np.array(sh.geometry.faces).reshape(-1, 3)
    zmin, zmax = v[:, 2].min(), v[:, 2].max()
    tris = []
    for a, b, c in f:
        tri = v[[a, b, c]]
        n = np.cross(tri[1] - tri[0], tri[2] - tri[0])
        nn = np.linalg.norm(n)
        if nn < 1e-9 or n[2] / nn > -0.95:            # só triângulos voltados para baixo (piso do ambiente, base da parede)
            continue
        p = Polygon(tri[:, :2])
        if p.area > 1e-6:
            tris.append(p)
    if tris:
        poly = unary_union(tris).buffer(0)
    else:
        poly = MultiPoint(v[np.isclose(v[:, 2], zmin, atol=1e-3)][:, :2]).convex_hull
    return poly, float(zmin), float(zmax)


def qto(el, *nomes):
    """Valor numérico por nome, em quantidades (Qto_*) e depois em qualquer pset (Revit grava área em PSet_Revit_Dimensions)."""
    for so_qto in (True, False):
        for ps in U.get_psets(el, qtos_only=so_qto).values():
            for n in nomes:
                for k, val in ps.items():
                    if k.lower() == n.lower() and isinstance(val, (int, float)) and not isinstance(val, bool):
                        return float(val)
    return None


def pavimento_de(el):
    """Pavimento por 'contido em' (paredes, esquadrias) ou por agregação (ambientes do Revit)."""
    c = U.get_container(el) or U.get_aggregate(el)
    for _ in range(6):
        if c is None or c.is_a('IfcBuildingStorey'):
            break
        c = U.get_container(c) or U.get_aggregate(c)
    return c.Name if c is not None and c.is_a('IfcBuildingStorey') else None


def ler(path):
    m = ifcopenshell.open(path)
    esc = UN.calculate_unit_scale(m)                          # unidade do arquivo -> metros
    s = G.settings()
    s.set('use-world-coords', True)
    modelo = dict(arquivo=path.split('/')[-1], esquema=m.schema, ferramenta=[a.ApplicationFullName for a in m.by_type('IfcApplication')][:1],
                  pavimentos=[], ambientes=[], paredes=[], vaos=[], avisos=[])
    for st in sorted(m.by_type('IfcBuildingStorey'), key=lambda x: x.Elevation or 0):
        modelo['pavimentos'].append(dict(nome=st.Name, cota=round((st.Elevation or 0) * esc, 3), guid=st.GlobalId))

    amb = {}
    for sp in m.by_type('IfcSpace'):
        try:
            poly, z0, z1 = footprint(s, sp)
        except Exception as e:
            modelo['avisos'].append(f"ambiente {sp.Name}: sem geometria ({e})"); continue
        area_geo = poly.area
        area_ifc = qto(sp, 'NetFloorArea', 'GrossFloorArea', 'Area', 'NetArea', 'GSA BIM Area')
        pe_ifc = qto(sp, 'Unbounded Height', 'Height', 'FinishCeilingHeight')
        perim_ifc = qto(sp, 'Perimeter')
        d = dict(guid=sp.GlobalId, codigo=sp.Name, nome=sp.LongName or sp.Name, pavimento=pavimento_de(sp), z=[round(z0, 2), round(z1, 2)],
                 area_geometria=round(area_geo, 2), area_ifc=round(area_ifc, 2) if area_ifc else None, pe_direito=round(pe_ifc, 2) if pe_ifc else round(z1 - z0, 2), perimetro=round(perim_ifc, 2) if perim_ifc else None,
                 contorno=[[round(x, 3), round(y, 3)] for x, y in (poly.exterior.coords if poly.geom_type == 'Polygon' else poly.convex_hull.exterior.coords)], origem='ifc')
        amb[sp.GlobalId] = (d, poly)
        modelo['ambientes'].append(d)

    paredes = {}
    vistos = set()
    for w in m.by_type('IfcWall'):                       # inclui IfcWallStandardCase
        if w.GlobalId in vistos:
            continue
        vistos.add(w.GlobalId)
        try:
            poly, z0, z1 = footprint(s, w)
        except Exception as e:
            modelo['avisos'].append(f"parede {w.Name}: sem geometria ({e})"); continue
        rect = poly.minimum_rotated_rectangle
        xs, ys = rect.exterior.coords.xy
        lados = sorted(math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]) for i in range(4))
        esp, comp = lados[0], lados[3]
        pset = U.get_psets(w)
        externa = next((v for k, ps in pset.items() for kk, v in ps.items() if kk == 'IsExternal'), None)
        pav = pavimento_de(w)
        faces = []
        for gid, (a, ap) in amb.items():
            if a['pavimento'] == pav and ap.distance(poly) < 0.06 and ap.intersection(poly.buffer(0.08)).area > 0.02:
                faces.append(a['nome'])
        d = dict(guid=w.GlobalId, nome=w.Name, pavimento=pav, comprimento=round(comp, 3), espessura=round(esp, 3), altura=round(z1 - z0, 3),
                 externa=externa, faces=sorted(set(faces)), area_bruta=round(comp * (z1 - z0), 2), aberturas_m2=0.0, origem='ifc')
        paredes[w.GlobalId] = (d, poly)
        modelo['paredes'].append(d)

    for el in pegar(m, ['IfcDoor', 'IfcWindow']):
        try:
            poly, z0, z1 = footprint(s, el)
        except Exception:
            continue
        rect = poly.minimum_rotated_rectangle
        xs, ys = rect.exterior.coords.xy
        lados = sorted(math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]) for i in range(4))
        larg = round(lados[3], 3)
        alt = round(z1 - z0, 3)
        larg_q = qto(el, 'Width', 'OverallWidth')
        alt_q = qto(el, 'Height', 'OverallHeight')
        host = None
        for fv in (el.FillsVoids or []):
            op = fv.RelatingOpeningElement
            for vo in (op.VoidsElements or []):
                host = vo.RelatingBuildingElement.GlobalId
        tipo = U.get_type(el)
        d = dict(guid=el.GlobalId, classe='porta' if el.is_a('IfcDoor') else 'janela', tipo=tipo.Name if tipo else el.Name, pavimento=pavimento_de(el),
                 largura=round(larg_q, 3) if larg_q else larg, altura=round(alt_q, 3) if alt_q else alt, peitoril=round(z0 - (next((p['cota'] for p in modelo['pavimentos'] if p['nome'] == pavimento_de(el)), 0)), 2),
                 parede=host, origem='ifc')
        modelo['vaos'].append(d)
        if host in paredes:
            paredes[host][0]['aberturas_m2'] = round(paredes[host][0]['aberturas_m2'] + d['largura'] * d['altura'], 2)
    for d, _ in paredes.values():
        d['area_liquida'] = round(max(d['area_bruta'] - d['aberturas_m2'], 0), 2)
    return modelo


def relatorio(mod):
    print(f"\n### {mod['arquivo']}  {mod['esquema']}  {mod['ferramenta']}")
    print("  pavimentos:", [(p['nome'], p['cota']) for p in mod['pavimentos']])
    ok = 0
    comp = [a for a in mod['ambientes'] if a['area_ifc']]
    for a in mod['ambientes']:
        if a['area_ifc']:
            err = (a['area_geometria'] - a['area_ifc']) / a['area_ifc'] * 100
            ok += abs(err) <= 2
    print(f"  ambientes: {len(mod['ambientes'])} | área da geometria x área do IFC dentro de 2%: {ok}/{len(comp)}")
    por_pav = collections.defaultdict(collections.Counter)
    for w in mod['paredes']:
        por_pav[w['pavimento']]['paredes'] += 1
        por_pav[w['pavimento']]['m2 parede líquida'] += w['area_liquida']
        por_pav[w['pavimento']]['m linear'] += w['comprimento']
    for v in mod['vaos']:
        por_pav[v['pavimento']][v['classe'] + 's'] += 1
    for p, c in por_pav.items():
        print(f"  {p}: " + ', '.join(f"{k}={round(v, 1)}" for k, v in c.items()))
    sem_host = sum(1 for v in mod['vaos'] if not v['parede'])
    print(f"  vãos com parede hospedeira: {len(mod['vaos']) - sem_host}/{len(mod['vaos'])} | paredes com faces em ambientes: {sum(1 for w in mod['paredes'] if w['faces'])}/{len(mod['paredes'])}")
    dois = sum(1 for w in mod['paredes'] if len(w['faces']) >= 2)
    print(f"  paredes que servem a 2 ou mais ambientes: {dois} (ex.: {[ (w['faces']) for w in mod['paredes'] if len(w['faces']) >= 2][:3]})")
    for av in mod['avisos'][:5]:
        print('  aviso:', av)


if __name__ == '__main__':
    mod = ler(sys.argv[1])
    relatorio(mod)
    if len(sys.argv) > 2:
        json.dump(mod, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
