"""Compatibilização entre IFCs: referencial comum e interferências (elemento de instalação atravessando parede/laje).

Uso: python compat_ifc.py <arquitetura.ifc> <instalacao.ifc> [saida.json]
Método: caixa envolvente (AABB) de cada elemento no referencial do mundo; índice em grade; interferência = interseção real
de caixas com volume mínimo, descontando vãos (porta/janela abertos na parede) e o contato de borda.
"""
import sys, json, collections, itertools
import numpy as np
import ifcopenshell, ifcopenshell.geom as G, ifcopenshell.util.element as U

S = G.settings()
S.set('use-world-coords', True)


def caixas(path, classes):
    m = ifcopenshell.open(path)
    out = []
    for c in classes:
        for e in m.by_type(c):
            try:
                v = np.array(G.create_shape(S, e).geometry.verts).reshape(-1, 3)
            except Exception:
                continue
            if len(v):
                out.append(dict(guid=e.GlobalId, classe=e.is_a(), nome=(e.Name or '')[:40], lo=v.min(axis=0), hi=v.max(axis=0)))
    return m, out


def uniao(cs):
    lo = np.min([c['lo'] for c in cs], axis=0); hi = np.max([c['hi'] for c in cs], axis=0)
    return lo, hi


def grade(cs, passo=1.0):
    g = collections.defaultdict(list)
    for i, c in enumerate(cs):
        a = np.floor(c['lo'][:2] / passo).astype(int); b = np.floor(c['hi'][:2] / passo).astype(int)
        for x in range(a[0], b[0] + 1):
            for y in range(a[1], b[1] + 1):
                g[(x, y)].append(i)
    return g


def interseccao(a, b):
    lo = np.maximum(a['lo'], b['lo']); hi = np.minimum(a['hi'], b['hi'])
    d = hi - lo
    return d if np.all(d > 0) else None


def main(arq, inst, saida=None):
    ma, A = caixas(arq, ['IfcWall', 'IfcSlab', 'IfcBeam', 'IfcColumn'])
    mi, I = caixas(inst, ['IfcFlowSegment', 'IfcFlowFitting', 'IfcFlowTerminal', 'IfcFlowController', 'IfcBuildingElementProxy'])
    rel = dict(arquitetura=arq.split('/')[-1], instalacao=inst.split('/')[-1], n_arq=len(A), n_inst=len(I))
    if not A or not I:
        print('sem elementos suficientes', rel); return rel
    la, ha = uniao(A); li, hi_ = uniao(I)
    sobre = np.maximum(0, np.minimum(ha, hi_) - np.maximum(la, li))
    area_u = np.prod(np.maximum(ha - la, 1e-9)[:2]); area_i = np.prod(np.maximum(hi_ - li, 1e-9)[:2])
    rel.update(caixa_arq=[np.round(la, 2).tolist(), np.round(ha, 2).tolist()], caixa_inst=[np.round(li, 2).tolist(), np.round(hi_, 2).tolist()],
               sobreposicao_planta=round(float(sobre[0] * sobre[1] / min(area_u, area_i)), 3))
    print(f"{rel['arquitetura']} x {rel['instalacao']}: {len(A)} elementos de arquitetura, {len(I)} de instalação")
    print(f"  caixa arq {rel['caixa_arq']} | caixa inst {rel['caixa_inst']}")
    print(f"  sobreposição em planta das duas caixas: {rel['sobreposicao_planta']*100:.0f}% (100% = mesmo referencial)")
    g = grade(A)
    cont = collections.Counter(); ex = collections.defaultdict(list)
    for j, e in enumerate(I):
        vistos = set()
        a0 = np.floor(e['lo'][:2]).astype(int); b0 = np.floor(e['hi'][:2]).astype(int)
        dim_e = e['hi'] - e['lo']
        eixo_e = int(np.argmax(dim_e))                           # eixo do trecho (maior dimensão da caixa)
        for x in range(a0[0], b0[0] + 1):
            for y in range(a0[1], b0[1] + 1):
                for i in g.get((x, y), []):
                    if i in vistos:
                        continue
                    vistos.add(i)
                    d = interseccao(A[i], e)
                    if d is None:
                        continue
                    vol = float(np.prod(d))
                    if vol < 1e-5 or np.sort(d)[0] < 0.01:
                        continue
                    dim_a = A[i]['hi'] - A[i]['lo']
                    eixo_esp = int(np.argmin(dim_a)) if A[i]['classe'] != 'IfcSlab' else 2   # eixo da espessura (laje: vertical)
                    esp = float(dim_a[eixo_esp])
                    if e['classe'] in ('IfcFlowTerminal', 'IfcFlowController', 'IfcBuildingElementProxy', 'IfcFlowFitting'):
                        classe = 'embutido (esperado)'
                    else:
                        comp_dentro = float(d[eixo_e])
                        perpendicular = (eixo_e == eixo_esp)
                        if perpendicular and comp_dentro <= esp * 1.5:
                            classe = 'travessia (furação)'
                        elif comp_dentro > 0.6 and not perpendicular:
                            classe = 'embutimento longo (rasgo ou shaft)'
                        else:
                            classe = 'contato (verificar)'
                    chave = (classe, A[i]['classe'].replace('IfcWallStandardCase', 'IfcWall'))
                    cont[chave] += 1
                    if len(ex[classe]) < 3:
                        ex[classe].append(f"{A[i]['nome'][:34]} x {e['nome'][:26]} | dentro {np.round(d, 2).tolist()} m")
    rel['classificacao'] = {f"{c} | {el}": n for (c, el), n in cont.most_common()}
    rel['por_classe'] = dict(collections.Counter({k: sum(v for (c, _), v in cont.items() if c == k) for k in {c for c, _ in cont}}))
    print('  por classe:', rel['por_classe'])
    for c, lst in ex.items():
        if c != 'embutido (esperado)':
            for t in lst: print(f"   [{c}] {t}")
    if saida:
        json.dump(rel, open(saida, 'w'), ensure_ascii=False, indent=1, default=str)
    return rel


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
