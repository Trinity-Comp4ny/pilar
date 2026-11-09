"""Biblioteca do spike do Leitor de projetos (código próprio, só para teste)."""
import re, collections
import numpy as np, cv2, pdfplumber, pypdfium2 as pdfium
from scipy import ndimage as ndi

import os
DPI = int(os.environ.get('LEITOR_DPI', '300'))


class Prancha:
    def __init__(self, pdf_path, page_no, denom=50, dpi=None):
        self.pg = pdfplumber.open(pdf_path).pages[page_no - 1]
        self.bx0, self.btop = self.pg.bbox[0], self.pg.bbox[1]
        lado_pol = max(self.pg.width, self.pg.height) / 72
        self.dpi = dpi or min(DPI, 9000 / lado_pol)          # no máximo ~9000 px no lado maior
        self.S = self.dpi / 72
        self.denom = denom
        self.mpx = 25.4 / self.dpi / 1000 * denom
        self.img = pdfium.PdfDocument(pdf_path)[page_no - 1].render(scale=self.S).to_numpy()[:, :, :3].copy()
        self.gray = cv2.cvtColor(self.img, cv2.COLOR_RGB2GRAY)
        self.H, self.W = self.gray.shape

    def px(self, x, top):
        return int((x - self.bx0) * self.S), int((top - self.btop) * self.S)

    def m(self, metros):
        return int(round(metros / self.mpx))

    # ---------- texto, inclusive girado
    def linhas(self):
        if hasattr(self, '_linhas'):
            return self._linhas
        out = []
        chars = self.pg.chars
        for group, key, order in (([c for c in chars if c.get('upright', True)], 'top', 'x0'),
                                  ([c for c in chars if not c.get('upright', True)], 'x0', 'top')):
            buckets = collections.defaultdict(list)
            for c in group:
                buckets[round(c[key] / 2)].append(c)
            for cs in buckets.values():
                cs.sort(key=lambda c: c[order])
                chunk = [cs[0]]
                for c in cs[1:]:
                    gap = c[order] - (chunk[-1]['x1'] if order == 'x0' else chunk[-1]['bottom'])
                    if gap > 4:
                        out.append(chunk); chunk = [c]
                    else:
                        chunk.append(c)
                out.append(chunk)
        res = []
        for cs in out:
            txt = ''.join(c['text'] for c in cs)
            vert = not cs[0].get('upright', True)
            base = dict(x0=min(c['x0'] for c in cs), x1=max(c['x1'] for c in cs),
                        top=min(c['top'] for c in cs), bottom=max(c['bottom'] for c in cs), vertical=vert)
            res.append(dict(base, text=txt, rev=False))
            if vert:
                res.append(dict(base, text=txt[::-1], rev=True))
        self._linhas = res
        return res

    # ---------- paredes
    def paredes(self):
        walls = None
        for t in (40, 70, 90, 110, 130):
            cand = cv2.morphologyEx((self.gray < t).astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
            if cand.sum() * self.mpx ** 2 > 10:
                walls, self.limiar = cand, t
                break
        d = ndi.distance_transform_edt(walls).astype(np.float32)
        core = (d > self.m(0.17)).astype(np.uint8)
        if core.any():
            thick = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * self.m(0.20) + 1,) * 2))
            walls = walls & (1 - thick)
        n, lab, st, _ = cv2.connectedComponentsWithStats(walls)
        walls = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 1500]).astype(np.uint8)
        return walls

    # ---------- vãos: trecho fino entre duas pontas de parede alinhadas
    def vaos(self, walls, max_m=7.6):
        res = []
        for axis in ('h', 'v'):
            k = self.m(max_m)
            kern = np.ones((1, k), np.uint8) if axis == 'h' else np.ones((k, 1), np.uint8)
            closed = cv2.morphologyEx(walls, cv2.MORPH_CLOSE, kern)
            gap = (closed == 1) & (walls == 0)
            n, lab, st, cen = cv2.connectedComponentsWithStats(gap.astype(np.uint8))
            for i in range(1, n):
                w, h = st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]
                comp, esp = (w, h) if axis == 'h' else (h, w)
                if esp > self.m(0.40) or comp < self.m(0.45) or esp < self.m(0.06):
                    continue
                res.append(dict(eixo=axis, largura=comp * self.mpx, espessura=esp * self.mpx,
                                cx=int(cen[i][0]), cy=int(cen[i][1]),
                                box=(st[i, 0], st[i, 1], w, h)))
        return res


def vaos_por_pontas(P, walls, max_m=7.6, min_m=0.5):
    """Vãos a partir das pontas de parede: anda da ponta na direção da parede até achar outra parede."""
    from skimage.morphology import skeletonize
    sk = skeletonize(walls.astype(bool))
    nb = cv2.filter2D(sk.astype(np.uint8), -1, np.ones((3, 3), np.uint8)) * sk
    ends = np.argwhere(nb == 2)                       # pixel do esqueleto com 1 vizinho = ponta
    dist = ndi.distance_transform_edt(walls).astype(np.float32)
    H, W = walls.shape
    maxpx, minpx = P.m(max_m), P.m(min_m)
    res, vistos = [], set()
    for y, x in ends:
        # direção: do pixel 12 passos atrás no esqueleto até a ponta
        path, cur, prev = [(y, x)], (y, x), None
        for _ in range(12):
            yy, xx = cur
            nxt = [(yy + dy, xx + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                   if (dy or dx) and 0 <= yy + dy < H and 0 <= xx + dx < W and sk[yy + dy, xx + dx] and (yy + dy, xx + dx) != prev and (yy + dy, xx + dx) not in path]
            if not nxt:
                break
            prev, cur = cur, nxt[0]; path.append(cur)
        dy, dx = y - path[-1][0], x - path[-1][1]
        if abs(dx) < 4 and abs(dy) < 4:
            continue
        sx, sy = (np.sign(dx), 0) if abs(dx) >= abs(dy) else (0, np.sign(dy))   # paredes ortogonais
        esp = dist[y, x] * 2
        # sai da parede, atravessa o vão, entra na próxima parede
        px, py, i = x, y, 0
        while 0 <= px < W and 0 <= py < H and walls[py, px] and i < P.m(1):
            px += sx; py += sy; i += 1
        x0, y0, n = px, py, 0
        while 0 <= px < W and 0 <= py < H and not walls[py, px] and n < maxpx:
            px += sx; py += sy; n += 1
        if not (0 <= px < W and 0 <= py < H) or n >= maxpx or n < minpx:
            continue
        key = (min(x0, px) // 20, min(y0, py) // 20, max(x0, px) // 20, max(y0, py) // 20)
        if key in vistos:
            continue
        vistos.add(key)
        res.append(dict(eixo='h' if sx else 'v', largura=n * P.mpx, espessura=esp * P.mpx,
                        cx=int((x0 + px) / 2), cy=int((y0 + py) / 2),
                        box=(int(min(x0, px)), int(min(y0, py) - (esp / 2 if sx else 0)), int(abs(px - x0)) or int(esp), int(esp) if sx else int(abs(py - y0)))))
    return res


def ambientes(P, walls, vaos=(), semente_m=0.5):
    """Watershed semeado nos rótulos "A= x m²"; paredes + vãos (portas, vidros) como divisa."""
    from skimage.segmentation import watershed
    bound = walls.copy()
    for v in vaos:
        x, y, w, h = v['box']
        cv2.rectangle(bound, (x, y), (x + max(w, 1), y + max(h, 1)), 1, -1)
    AREA = re.compile(r'A\s*=\s*([\d.]+,\d+)\s*m')
    L = P.linhas()
    titles = [l for l in L if re.match(r'Planta baixa', l['text'])]
    labels, seen = [], set()
    for l in L:
        m = AREA.search(l['text'])
        if not m or (l['vertical'] and not l['rev']):
            continue
        key = (round(l['x0']), round(l['top']))
        if key in seen:
            continue
        seen.add(key)
        cx, cy = (l['x0'] + l['x1']) / 2, (l['top'] + l['bottom']) / 2
        if l['vertical']:
            c = [o for o in L if o['vertical'] and o['rev'] and 0 < l['x0'] - o['x1'] < 14 and abs((o['top'] + o['bottom']) / 2 - cy) < 40]
        else:
            c = [o for o in L if not o['vertical'] and 0 < l['top'] - o['bottom'] < 14 and abs((o['x0'] + o['x1']) / 2 - cx) < 45]
        c = [o for o in c if re.search(r'[A-Za-zÀ-ú]{3,}', o['text']) and not AREA.search(o['text'])]
        below = [t for t in titles if t['top'] > l['top']]
        labels.append(dict(nome=c[0]['text'].strip() if c else '?', area_rotulo=float(m.group(1).replace('.', '').replace(',', '.')),
                           vista=(min(below, key=lambda t: t['top'])['text'] if below else '?').replace('Planta baixa - ', ''),
                           px=P.px(cx, cy)))
    free = bound == 0
    dist = ndi.distance_transform_edt(free).astype(np.float32)
    markers = np.zeros(walls.shape, np.int32)
    R = P.m(semente_m)
    H, W = walls.shape
    for i, Lb in enumerate(labels, start=1):
        x, y = Lb['px']
        y0, y1, x0, x1 = max(0, y - R), min(H, y + R), max(0, x - R), min(W, x + R)
        yy, xx = np.unravel_index(np.argmax(dist[y0:y1, x0:x1]), (y1 - y0, x1 - x0))
        cv2.circle(markers, (int(x0 + xx), int(y0 + yy)), 6, i, -1)
    ext = len(labels) + 1
    markers[:4, :] = ext; markers[-4:, :] = ext; markers[:, :4] = ext; markers[:, -4:] = ext
    reg = watershed(-dist, markers, mask=free)
    for i, Lb in enumerate(labels, start=1):
        Lb['area_calc'] = round(float((reg == i).sum()) * P.mpx ** 2, 2)
        Lb['erro_pct'] = round((Lb['area_calc'] - Lb['area_rotulo']) / Lb['area_rotulo'] * 100, 1)
    return labels, reg, bound


def juntar_vaos(principal, extra, raio_px=60):
    """Une dois detectores: mantém o principal e acrescenta do extra o que não estiver perto de nenhum."""
    out = list(principal)
    for v in extra:
        if all(abs(v['cx'] - p['cx']) + abs(v['cy'] - p['cy']) > raio_px for p in out):
            out.append(dict(v, origem='fechamento'))
    return out


def classificar_vao(vao, labels, reg, P, usado=False):
    """Vão sem esquadria no quadro: passagem, acesso ao exterior ou portão, pelo que existe dos dois lados."""
    H, W = reg.shape
    d = P.m(0.7)
    cx, cy = vao['cx'], vao['cy']
    lados = [(cx, cy - d), (cx, cy + d)] if vao['eixo'] == 'h' else [(cx - d, cy), (cx + d, cy)]
    ext = len(labels) + 1
    nomes = []
    for x, y in lados:
        x, y = min(max(int(x), 0), W - 1), min(max(int(y), 0), H - 1)
        r = int(reg[y, x])
        nomes.append(None if r in (0, ext) else labels[r - 1]['nome'])
    larg = vao['largura']
    if usado:
        return dict(classe='esquadria identificada', lados=nomes)
    if None in nomes and any(nomes):
        interno = next(n for n in nomes if n)
        if larg >= 2.4:
            return dict(classe='abertura larga para o exterior (portão ou vão livre)', lados=nomes, confirmar=True)
        return dict(classe='acesso ao exterior sem esquadria listada', lados=nomes, confirmar=True)
    if all(nomes):
        return dict(classe='passagem entre ambientes (sem esquadria)', lados=nomes)
    if larg >= 2.4:
        return dict(classe='abertura larga entre áreas externas (portão, divisa)', lados=nomes, confirmar=True)
    return dict(classe='vão sem contexto (possível falso)', lados=nomes, confirmar=True)
