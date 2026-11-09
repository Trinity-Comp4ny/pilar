"""Pontua a saída dos modelos de visão contra o gabarito (texto vetorial): ambientes por área, esquadrias e cotas como multiconjunto."""
import sys, json, re, collections

GT = json.load(open('../dados/spike/visao_gt/gabarito.json'))


def num(x):
    try:
        return round(float(str(x).replace(',', '.')), 2)
    except ValueError:
        return None


def casar(ref, got):
    c = collections.Counter(ref); g = collections.Counter(got)
    ok = sum(min(c[k], g[k]) for k in c)
    return ok, sum(g.values()) - ok            # acertos, excesso (lido que não está no gabarito)


def pontuar(saida):
    tot = collections.defaultdict(lambda: [0, 0, 0])
    por_bloco = {}
    for bloco, gt in GT.items():
        o = saida.get(bloco, {})
        r = {}
        tarefas = {
            'ambientes': ([a['area'] for a in gt['ambientes']], [num(a.get('area_m2')) for a in o.get('ambientes', []) if isinstance(a, dict)]),
            'esquadrias': (gt['esquadrias'], [str(x).upper() for x in o.get('esquadrias', [])]),
            'cotas': ([num(x) for x in gt['cotas']], [num(x) for x in o.get('cotas', [])]),
        }
        for t, (ref, got) in tarefas.items():
            if t == 'esquadrias' and not ref:
                continue                                    # gabarito de código vazio nesse bloco: não pontua
            got = [g for g in got if g is not None]
            ok, ex = casar(ref, got)
            r[t] = f"{ok}/{len(ref)} (+{ex})"
            tot[t][0] += ok; tot[t][1] += len(ref); tot[t][2] += ex
        por_bloco[bloco] = r
    return por_bloco, {t: f"{v[0]}/{v[1]} = {100 * v[0] / max(v[1], 1):.0f}% (+{v[2]} extras)" for t, v in tot.items()}


if __name__ == '__main__':
    for arq in sys.argv[1:]:
        por, tot = pontuar(json.load(open(arq)))
        print(arq.split('/')[-1], tot)
        for b, r in por.items():
            print('   ', b.replace('bloco_', '').replace('.png', ''), r)
