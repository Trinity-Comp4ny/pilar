import sys, collections, ezdxf
from ezdxf import recover
for f in sys.argv[1:]:
    try:
        doc, aud = recover.readfile(f)
    except Exception as e:
        print('ERRO', f, e); continue
    msp = doc.modelspace()
    ents = collections.Counter(e.dxftype() for e in msp)
    layers = collections.Counter(e.dxf.layer for e in msp)
    ins = collections.Counter(e.dxf.name for e in msp.query('INSERT'))
    print(f"\n### {f.split('/')[-1]}  unidades={doc.header.get('$INSUNITS')}  entidades={sum(ents.values())}")
    print('  tipos:', ents.most_common(8))
    print('  camadas (top 15):', [(k[:28], v) for k, v in layers.most_common(15)])
    print('  blocos inseridos (top 20):', [(k[:30], v) for k, v in ins.most_common(20)])
