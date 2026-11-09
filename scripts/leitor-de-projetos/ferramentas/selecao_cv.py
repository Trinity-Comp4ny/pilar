"""Seletor por validação cruzada: escolhe o detector pelas áreas escritas na própria prancha (metade A) e mede na outra metade (B), e vice-versa."""
import json, sys, statistics as st
def dentro(erros, tol=5): return sum(abs(e) <= tol for e in erros)
tot_sel = tot_best = tot_n = 0
casos = []
for l in open(sys.argv[1]):
    try: r = json.loads(l)
    except Exception: continue
    det = {k: v for k, v in (r.get('detectores') or {}).items() if 'erros' in v}
    if len(det) < 2: continue
    n = len(next(iter(det.values()))['erros'])
    if n < 4: continue
    A = list(range(0, n, 2)); B = list(range(1, n, 2))
    linha = {'caso': r['caso'][:30], 'n': n}
    acertos = 0; melhor_fixo = {k: 0 for k in det}; oraculo = 0
    for treino, teste in ((A, B), (B, A)):
        # escolhe pelo desempenho no treino; empate -> menor erro mediano, depois pontuação sem gabarito
        def chave(k):
            e = [det[k]['erros'][i] for i in treino]
            return (dentro(e), -st.median(abs(x) for x in e), det[k]['pontuacao'])
        k = max(det, key=chave)
        acertos += dentro([det[k]['erros'][i] for i in teste])
        for kk in det: melhor_fixo[kk] += dentro([det[kk]['erros'][i] for i in teste])
        oraculo = oraculo  # (oráculo calculado abaixo)
    o = max(melhor_fixo.values())
    pont = max(det, key=lambda k: det[k]['pontuacao'])
    # seletor antigo (pontuação sem gabarito) medido nas mesmas metades
    ant = dentro([det[pont]['erros'][i] for i in A]) + dentro([det[pont]['erros'][i] for i in B])
    linha.update(cv=acertos, melhor_fixo=o, melhor_nome=max(melhor_fixo, key=melhor_fixo.get), pontuacao_sem_gabarito=ant, ant_nome=pont)
    casos.append(linha)
    tot_sel += acertos; tot_best += o; tot_n += n
print(f"{'caso':30} {'n':>3} {'CV (gabarito da prancha)':>26} {'melhor fixo (oráculo)':>24} {'pontuação sem gabarito':>24}")
for c in casos:
    print(f"{c['caso']:30} {c['n']:>3} {c['cv']:>10}/{c['n']:<3} {'':>11} {c['melhor_fixo']:>6}/{c['n']:<3} ({c['melhor_nome'][:14]:<14}) {c['pontuacao_sem_gabarito']:>6}/{c['n']:<3} ({c['ant_nome'][:14]})")
print(f"\nTOTAL: validação cruzada {tot_sel}/{tot_n} | oráculo {tot_best}/{tot_n}")
