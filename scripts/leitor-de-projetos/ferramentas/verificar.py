"""Camadas de confiança do OCR sem gabarito: ser rótulo de área (m², nome) x ser leitura confiável (várias passadas, soma que fecha).
verificado = não precisa de LLM; dúvida = plausível como área mas não confirmado, vai para a LLM só no bloco dele; ruído = cota e afins."""
import sys, os, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ESCANEADA = [38.11, 3.57, 48.47, 199.33, 108.18, 66.29, 174.47, 91.15, 54.27]       # conferidos a olho


def marcar_somas(rot, tol=0.011):
    """a + b = c entre candidatos (m² ou lidos em 3+ passadas). Quadro de áreas e totais fecham assim."""
    S = [r for r in rot if r['m2'] or r['n'] >= 3]
    vals = [r['area'] for r in S]
    ix = set()
    for i in range(len(vals)):
        for j in range(i + 1, len(vals)):
            t = vals[i] + vals[j]
            for k in range(len(vals)):
                if k not in (i, j) and abs(vals[k] - t) <= tol:
                    ix.update((i, j, k))
    for i, r in enumerate(S):
        r['soma'] = i in ix
    for r in rot:
        r.setdefault('soma', False)


def camada(r):
    area = r['m2'] or bool(r['nome'])
    pontos = 2 * r['m2'] + bool(r['nome']) + (min(r['n'], 4) - 1) + 2 * r['soma']
    if not area:
        return 'ruido'
    return 'verificado' if pontos >= 4 else 'duvida'


def avaliar(caso, ref):
    rot = json.load(open(f'../dados/spike/ocr_{caso}.json'))
    marcar_somas(rot)
    for r in rot:
        r['camada'] = camada(r)
    livres = list(ref)
    cont = collections.defaultdict(lambda: [0, 0])                   # camada -> [verdadeiros, falsos]
    for r in sorted(rot, key=lambda r: (r['camada'] != 'verificado', r['camada'] != 'duvida', -r['n'])):
        j = next((i for i, v in enumerate(livres) if abs(v - r['area']) <= 0.011), None)
        if j is not None:
            livres.pop(j); cont[r['camada']][0] += 1
        else:
            cont[r['camada']][1] += 1
    blocos = {(int(r['x'] // 700), int(r['y'] // 700)) for r in rot if r['camada'] == 'duvida'}
    todos = {(int(r['x'] // 700), int(r['y'] // 700)) for r in rot}
    return dict(caso=caso, ref=len(ref), verificado=cont['verificado'], duvida=cont['duvida'], ruido=cont['ruido'], nao_lidos=len(livres),
                blocos_llm=f"{len(blocos)}/{len(todos)}")


if __name__ == '__main__':
    from leitor import Prancha
    from leitor2 import rotulos_area
    from bancada3 import CASOS
    from bancada4 import EXTRA
    tot = collections.Counter()
    for caso in sys.argv[1:]:
        if caso == 'escaneada':
            ref = ESCANEADA
        else:
            pdf, pno, _ = CASOS[caso] if caso in CASOS else EXTRA[caso]
            ref = sorted(r['area'] for r in rotulos_area(Prancha(pdf, pno, denom=50)))
        r = avaliar(caso, ref)
        print(json.dumps(r, ensure_ascii=False), flush=True)
