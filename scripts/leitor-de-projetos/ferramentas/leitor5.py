"""Leitor v5: calibração automática da escala real pelas cotas escritas (consenso) e seletor de detector de parede."""
import re, sys, os, collections, bisect
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))

COTA = re.compile(r'^\d{1,3}[.,]\d{2}$')


def _juntar(segs, gap):
    """Une segmentos colineares separados por menos de 'gap' pontos (a linha de cota é cortada pelo texto)."""
    segs = sorted(segs)
    out = []
    for c, a, b in segs:
        if out and abs(out[-1][0] - c) < 0.35 and a - out[-1][2] <= gap:
            out[-1] = (out[-1][0], out[-1][1], max(out[-1][2], b))
        else:
            out.append((c, a, b))
    return out


def calibrar_por_cotas(pg, escalas_impressas=(), comp_min_pt=14, palavras_extra=()):
    """Escala real pelas cotas escritas, por consenso ponderado.
    Peso 3 se a linha de cota tem traço/extensão nas duas pontas, 1 se não. Só aceita fator de plotagem entre 0,5x e 2x das escalas impressas."""
    H, V, TODOS = [], [], []
    def add(x0, y0, x1, y1):
        TODOS.append((x0, y0, x1, y1))
        if abs(y1 - y0) < 0.3 and abs(x1 - x0) >= comp_min_pt:
            H.append(((y0 + y1) / 2, min(x0, x1), max(x0, x1)))
        elif abs(x1 - x0) < 0.3 and abs(y1 - y0) >= comp_min_pt:
            V.append(((x0 + x1) / 2, min(y0, y1), max(y0, y1)))
    for o in pg.lines:
        add(o['x0'], o['top'], o['x1'], o['bottom'])
    for o in list(pg.curves) + list(pg.rects):
        pts = o.get('pts') or []
        for (a_, b_), (c_, d_) in zip(pts, pts[1:]):
            add(a_, b_, c_, d_)
    H = sorted(set(H) | set(_juntar(H, 40))); V = sorted(set(V) | set(_juntar(V, 40)))   # trecho individual E trecho unido (cota cortada pelo texto)
    hc = [s_[0] for s_ in H]; vc = [s_[0] for s_ in V]
    # índice de extremidades de qualquer segmento, em grade de 3 pt, para achar traço/extensão nas pontas da cota
    grade = collections.defaultdict(int)
    for x0, y0, x1, y1 in TODOS:
        grade[(int(x0 // 3), int(y0 // 3))] += 1
        grade[(int(x1 // 3), int(y1 // 3))] += 1
    def ponta(x, y):
        return any(grade.get((int(x // 3) + dx, int(y // 3) + dy)) for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    cand = []                                              # (m_por_pt, peso)
    for w in list(pg.extract_words(extra_attrs=['upright', 'size'])) + list(palavras_extra):
        t = w['text']
        if not COTA.match(t):
            continue
        v = float(t.replace(',', '.'))
        if not 0.4 <= v <= 80:
            continue
        cx, cy = (w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2
        tol = max(w['size'] * 1.6, 4)
        if w.get('upright', True):
            i = bisect.bisect_left(hc, cy - tol)
            while i < len(H) and H[i][0] <= cy + tol:
                c, a_, b_ = H[i]
                if a_ - 1 <= cx <= b_ + 1 and b_ - a_ >= comp_min_pt:
                    cand.append((v / (b_ - a_), 3 if (ponta(a_, c) and ponta(b_, c)) else 1))
                i += 1
        else:
            i = bisect.bisect_left(vc, cx - tol)
            while i < len(V) and V[i][0] <= cx + tol:
                c, a_, b_ = V[i]
                if a_ - 1 <= cy <= b_ + 1 and b_ - a_ >= comp_min_pt:
                    cand.append((v / (b_ - a_), 3 if (ponta(c, a_) and ponta(c, b_)) else 1))
                i += 1
    um_m_pt = 0.0254 / 72                                  # metros reais por pt de papel em 1:1
    if escalas_impressas:
        cand = [(m, w_) for m, w_ in cand if any(0.5 <= (m / um_m_pt) / e <= 2.0 for e in escalas_impressas)]
    if len(cand) < 3:
        return None
    cand.sort()
    ms = np.array([c[0] for c in cand]); ws_ = np.array([c[1] for c in cand], float)
    usado = np.zeros(len(ms), bool)
    grupos = []
    for _ in range(3):
        best_w, best = 0.0, None
        for i in range(len(ms)):
            if usado[i]:
                continue
            j = int(np.searchsorted(ms, ms[i] * 1.02, side='right'))
            idx = [k for k in range(i, j) if not usado[k]]
            w_ = ws_[idx].sum() if idx else 0
            if w_ > best_w:
                best_w, best = w_, idx
        if not best or best_w < 6:
            break
        usado[best] = True
        m_pt = float(np.median(ms[best]))
        esc = round(m_pt / um_m_pt)
        g = dict(m_por_pt=m_pt, cluster=len(best), peso=float(best_w), escala_equivalente=esc)
        if escalas_impressas:
            prox = min(escalas_impressas, key=lambda e: abs(e - esc))
            g.update(escala_impressa_proxima=prox, fator_plotagem=round(esc / prox, 3), confirmar=not 0.85 <= esc / prox <= 1.2)
        grupos.append(g)
    if not grupos:
        return None
    res = dict(grupos[0]); res.update(total=len(cand), grupos=grupos)
    return res


ESCALAS_PADRAO = (10, 20, 25, 30, 40, 50, 75, 100, 125, 150, 200, 250, 500)


def encaixar_escala(den, tol=0.04):
    """Escalas de desenho são números padrão. Se a calibrada está a menos de 4% de uma, usa a padrão."""
    prox = min(ESCALAS_PADRAO, key=lambda e: abs(e - den))
    return (float(prox), True) if abs(prox - den) / prox <= tol else (float(den), False)
