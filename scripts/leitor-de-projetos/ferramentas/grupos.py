"""Verificação por GRUPO de ambientes: região livre conexa (portas fechadas) com k rótulos dentro.
k=1  -> ambiente fechado: área da região contra o rótulo.
k>=2 -> conjunto aberto (estar/jantar/cozinha): soma dos rótulos contra a área da região.
Região muito maior que a soma -> 'vaza' (abre para o exterior). Muito menor -> 'cortada' (parede a mais ou rótulo fora)."""
import numpy as np, cv2


def avaliar_grupos(P, walls, vaos, rot, den, tol=0.05):
    H, W = walls.shape
    bound = walls.copy()
    for v in vaos:
        x, y, w, h = v['box']
        cv2.rectangle(bound, (x, y), (x + max(w, 1), y + max(h, 1)), 1, -1)
    n, lab = cv2.connectedComponents((bound == 0).astype(np.uint8), connectivity=4)
    mpx = 25.4 / P.dpi / 1000 * den
    areas = np.bincount(lab.ravel(), minlength=n).astype(np.float64) * mpx ** 2
    sem = []
    grupos = {}
    for i, r in enumerate(rot):
        x, y = P.px(r['x'], r['y'])
        x, y = min(max(x, 0), W - 1), min(max(y, 0), H - 1)
        l = int(lab[y, x])
        if bound[y, x]:                                           # semente caiu em cima de parede/vão: busca o vizinho livre mais próximo
            R = P.m(0.6)
            win = lab[max(0, y - R):y + R, max(0, x - R):x + R]
            vals = win[win > 0]
            l = int(np.bincount(vals).argmax()) if len(vals) else 0
        if l == 0:
            sem.append(r['nome']); continue
        grupos.setdefault(l, []).append(r)
    ext = lab[0, 0]
    res = []
    for l, rs in grupos.items():
        soma = sum(r['area'] for r in rs)
        a = float(areas[l])
        erro = (a - soma) / soma * 100
        toca = bool((lab[0, :] == l).any() or (lab[-1, :] == l).any() or (lab[:, 0] == l).any() or (lab[:, -1] == l).any())
        if toca or erro > 20:
            estado = 'vaza'
        elif abs(erro) <= tol * 100:
            estado = 'confere'
        elif erro < -20:
            estado = 'cortada'
        else:
            estado = 'diverge'
        res.append(dict(k=len(rs), nomes=[r['nome'][:14] for r in rs], soma_rotulos=round(soma, 2), area_regiao=round(a, 2), erro=round(erro, 1), estado=estado))
    return res, sem
