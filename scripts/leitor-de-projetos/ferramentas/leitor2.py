"""Leitor v2: escala do desenho, rótulos de área em vários formatos, parede por linha dupla."""
import re, collections
import numpy as np, cv2
from scipy import ndimage as ndi
from skimage.segmentation import watershed
from leitor import Prancha, vaos_por_pontas, juntar_vaos

ESC = re.compile(r'ESC[A-Z]*\.?\s*:?\s*1\s*[:/]\s*(\d{2,3})\b', re.I)
RUIM = re.compile(r'^(terreno|total|constru|[aá]rea|folhas?\b|\(|perme|cobertura|taxa|coef|lote|projeção|piscina$|prainha|fire|spa$|jardim)', re.I)
GENERICO = re.compile(r'^[aá]rea\.?:?$', re.I)
AREA = re.compile(r'^(?P<nome>.*?)\s*(?:A\s*=\s*)?(?P<area>\d{1,4}(?:\.\d{3})*,\d{1,2})\s*m\s*[²2z]?\s*$', re.I)


def escalas(P):
    """Posição e valor de cada 'ESC 1:nn' na prancha (em pontos)."""
    out = []
    for l in P.linhas():
        if l['vertical'] and not l['rev']:
            continue
        m = ESC.search(l['text'])
        if m:
            out.append(dict(den=int(m.group(1)), x=(l['x0'] + l['x1']) / 2, y=(l['top'] + l['bottom']) / 2))
    return out


def denom_para(esc, x, y, padrao):
    if not esc:
        return padrao
    d = min(esc, key=lambda e: (e['x'] - x) ** 2 + (e['y'] - y) ** 2)
    return d['den']


def rotulos_area(P):
    """[{nome, area, x, y, vertical}] de qualquer linha tipo 'SALÃO 183,66 m²' ou 'A= 12,74 m²' com nome logo acima."""
    L = P.linhas()
    res, seen = [], set()
    for l in L:
        if l['vertical'] and not l['rev']:
            continue
        t = l['text'].strip()
        if re.match(r'^(Pd|P\.?\s?D\.?|p[ée]\s*direito)\s*[:=]', t, re.I):          # pé-direito, não é área
            continue
        if '..' in t:                                   # linha de quadro de áreas "TERRENO.....264,00"
            continue
        m = AREA.match(t)
        if not m:
            continue
        area = float(m.group('area').replace('.', '').replace(',', '.'))
        if not 0.4 <= area <= 3000:
            continue
        key = (round(l['x0']), round(l['top']))
        if key in seen:
            continue
        seen.add(key)
        nome = m.group('nome').strip(' :-')
        cx, cy = (l['x0'] + l['x1']) / 2, (l['top'] + l['bottom']) / 2
        if not re.search(r'[A-Za-zÀ-ú]{3,}', nome):
            if l['vertical']:
                c = [o for o in L if o['vertical'] and o['rev'] and 0 < l['x0'] - o['x1'] < 14 and abs((o['top'] + o['bottom']) / 2 - cy) < 40]
            else:
                c = [o for o in L if not o['vertical'] and 0 < l['top'] - o['bottom'] < 14 and abs((o['x0'] + o['x1']) / 2 - cx) < 45]
            c = [o for o in c if re.search(r'[A-Za-zÀ-ú]{3,}', o['text']) and not AREA.match(o['text'].strip())]
            nome = c[0]['text'].strip() if c else ''
            if c and not l['vertical'] and GENERICO.match(nome):               # "NOME / Área / 5,35 m²": sobe uma linha para achar o nome
                cx2 = (c[0]['x0'] + c[0]['x1']) / 2
                c2 = [o for o in L if not o['vertical'] and 0 < c[0]['top'] - o['bottom'] < 14 and abs((o['x0'] + o['x1']) / 2 - cx2) < 45
                      and re.search(r'[A-Za-zÀ-ú]{3,}', o['text']) and not AREA.match(o['text'].strip()) and not GENERICO.match(o['text'].strip())]
                if c2:
                    nome = min(c2, key=lambda o: c[0]['top'] - o['bottom'])['text'].strip()
        pd = None
        idx = None
        if not nome:                                     # linha de tabela: nome na mesma linha, à esquerda
            esq = [o for o in L if not o['vertical'] and abs((o['top'] + o['bottom']) / 2 - cy) < 3 and o['x1'] <= l['x0'] + 2
                   and l['x0'] - o['x1'] < 160 and re.search(r'[A-Za-zÀ-ú]{3,}', o['text'])]
            if esq:
                nome_l = max(esq, key=lambda o: o['x1'])
                nome = nome_l['text'].strip()
                num = [o for o in L if not o['vertical'] and abs((o['top'] + o['bottom']) / 2 - cy) < 3 and o['x1'] <= nome_l['x0'] + 2
                       and re.fullmatch(r'\d{1,2}', o['text'].strip())]
                idx = num[-1]['text'].strip() if num else None
            dir_ = [o for o in L if not o['vertical'] and abs((o['top'] + o['bottom']) / 2 - cy) < 3 and o['x0'] >= l['x1'] - 2 and o['x0'] - l['x1'] < 120]
            for o in sorted(dir_, key=lambda o: o['x0']):
                mm = re.match(r'^\s*(\d,\d{2})\s*m?\s*$', o['text'])
                if mm and 2.0 <= float(mm.group(1).replace(',', '.')) <= 6.0:
                    pd = float(mm.group(1).replace(',', '.'))
                    break
        if not nome or RUIM.match(nome):
            continue
        res.append(dict(nome=nome, area=area, x=cx, y=cy, pe_direito=pd, idx=idx))
    return res


def paredes_duplas(P, espessura_max=0.40):
    """Parede desenhada como DUAS linhas finas: fecha o vazio entre elas e fica só com o que é longo e fino."""
    dark = (P.gray < 140).astype(np.uint8)
    k = P.m(espessura_max)
    k += (k + 1) % 2
    closed = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (k, 1)))
    closed = closed | cv2.morphologyEx(dark, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (1, k)))
    # massa que só existe depois do fechamento = vazio entre duas linhas
    ganho = (closed == 1) & (dark == 0)
    esp = P.m(0.08)
    ganho = cv2.morphologyEx(ganho.astype(np.uint8), cv2.MORPH_OPEN, np.ones((esp, esp), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(ganho)
    comp = P.m(0.9)
    keep = [i for i in range(1, n) if max(st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]) >= comp]
    mask = np.isin(lab, keep).astype(np.uint8)
    return cv2.dilate(mask | dark * 0, np.ones((3, 3), np.uint8)) | (dark & cv2.dilate(mask, np.ones((esp, esp), np.uint8)))


def avaliar(P, walls, rot, esc, padrao_den, vaos=()):
    """Watershed semeado nos rótulos; devolve lista com erro % de cada ambiente."""
    H, W = walls.shape
    bound = walls.copy()
    for v in vaos:
        x, y, w, h = v['box']
        cv2.rectangle(bound, (x, y), (x + max(w, 1), y + max(h, 1)), 1, -1)
    free = bound == 0
    dist = ndi.distance_transform_edt(free).astype(np.float32)
    markers = np.zeros((H, W), np.int32)
    R = P.m(0.5)
    pos = []
    for i, r in enumerate(rot, start=1):
        x, y = P.px(r['x'], r['y'])
        x, y = min(max(x, 0), W - 1), min(max(y, 0), H - 1)
        y0, y1, x0, x1 = max(0, y - R), min(H, y + R), max(0, x - R), min(W, x + R)
        yy, xx = np.unravel_index(np.argmax(dist[y0:y1, x0:x1]), (y1 - y0, x1 - x0))
        cv2.circle(markers, (int(x0 + xx), int(y0 + yy)), 4, i, -1)
        pos.append((x, y))
    ext = len(rot) + 1
    markers[:3, :] = ext; markers[-3:, :] = ext; markers[:, :3] = ext; markers[:, -3:] = ext
    reg = watershed(-dist, markers, mask=free)
    out = []
    for i, r in enumerate(rot, start=1):
        den = denom_para(esc, r['x'], r['y'], padrao_den)
        mpx = 25.4 / P.dpi / 1000 * den
        calc = float((reg == i).sum()) * mpx ** 2
        out.append(dict(nome=r['nome'], rotulo=r['area'], calc=round(calc, 2), erro=round((calc - r['area']) / r['area'] * 100, 1), den=den))
    return out


def paredes_limiar(P, t):
    """Parede por preenchimento escuro com limiar fixo (o seletor escolhe o limiar)."""
    walls = cv2.morphologyEx((P.gray < t).astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    d = ndi.distance_transform_edt(walls).astype(np.float32)
    core = (d > P.m(0.17)).astype(np.uint8)
    if core.any():
        thick = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * P.m(0.20) + 1,) * 2))
        walls = walls & (1 - thick)
    n, lab, st, _ = cv2.connectedComponentsWithStats(walls)
    keep = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 1500]
    return np.isin(lab, keep).astype(np.uint8)
