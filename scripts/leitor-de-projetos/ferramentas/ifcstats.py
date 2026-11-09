"""Inventário de um IFC: esquema, exportador, pavimentos, ambientes, paredes, esquadrias, pilares e propriedades."""
import sys, collections
import ifcopenshell, ifcopenshell.util.element as U

for f in sys.argv[1:]:
    m = ifcopenshell.open(f)
    prj = m.by_type('IfcProject')[0]
    app = m.by_type('IfcApplication')
    print(f"\n### {f.split('/')[-1]}  esquema={m.schema}  projeto={prj.Name!r}  app={[a.ApplicationFullName for a in app][:2]}")
    ents = collections.Counter(e.is_a() for e in m if e.is_a().startswith('IfcWall') or e.is_a() in (
        'IfcSpace', 'IfcDoor', 'IfcWindow', 'IfcColumn', 'IfcBeam', 'IfcSlab', 'IfcStair', 'IfcRoof', 'IfcCovering', 'IfcBuildingElementProxy',
        'IfcFurniture', 'IfcFlowTerminal', 'IfcLightFixture', 'IfcElectricAppliance', 'IfcPipeSegment', 'IfcCableCarrierSegment', 'IfcRailing',
        'IfcFooting', 'IfcPile', 'IfcOpeningElement', 'IfcCurtainWall', 'IfcBuildingStorey', 'IfcSite'))
    print('  contagem:', dict(ents))
    for st in m.by_type('IfcBuildingStorey'):
        els = [e for rel in (st.ContainsElements or []) for e in rel.RelatedElements]
        c = collections.Counter(e.is_a() for e in els)
        print(f"  pavimento {st.Name!r} cota={st.Elevation}: {dict(c)}")
    sp = m.by_type('IfcSpace')
    for s in sp[:25]:
        q = U.get_psets(s, qtos_only=True)
        area = next((v for d in q.values() for k, v in d.items() if 'Area' in k and isinstance(v, (int, float))), None)
        print(f"  ambiente {s.Name!r} longname={s.LongName!r} área={area}")
    for cls in ('IfcWall', 'IfcDoor', 'IfcWindow', 'IfcColumn'):
        els = m.by_type(cls)
        if not els:
            continue
        e = els[0]
        ps = U.get_psets(e)
        print(f"  exemplo {cls} {e.Name!r} tipo={U.get_type(e).Name if U.get_type(e) else None}: psets={ {k: list(v)[:8] for k, v in ps.items()} }")
    types = collections.Counter((U.get_type(e).Name if U.get_type(e) else e.Name) for e in m.by_type('IfcDoor') + m.by_type('IfcWindow'))
    print('  tipos de esquadria:', types.most_common(12))
