"""Rótulos de área em cascata, sem região escolhida à mão: texto vetorial primeiro; sem ele, OCR em blocos só onde a folha tem conteúdo.

rotulos_auto(pdf, pno) -> (fonte, rotulos, info); rotulos = [{nome, area, x, y, ...}] em pontos do PDF (origem no topo, como ocr.py).
"""
import os, re, sys, time, json, collections
os.environ.setdefault('TESSDATA_PREFIX', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tessdata'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pytesseract, pypdfium2 as pdfium, pdfplumber
from leitor import Prancha
from leitor2 import rotulos_area
from leitor4 import NOME, IGN

NUM = re.compile(r'(?<![\d,.])(\d{1,4},\d{2})(?!\d)')
PALAVRA = re.compile(r'^[A-Za-zÀ-ú][A-Za-zÀ-ú/.]{2,}$')
MIN_VETOR = 3                                        # menos que isso de rótulos no texto vetorial: o texto está em curvas ou a folha é imagem


def blocos_com_conteudo(pdf, pno, bloco_pt=700, min_obj=40):
    """Grade de blocos; mantém só os que têm desenho vetorial (linhas, curvas, retângulos) ou imagem. Margem em branco fica de fora."""
    pg = pdfplumber.open(pdf).pages[pno - 1]
    bx0, bt = pg.bbox[0], pg.bbox[1]
    cont = collections.Counter()
    for o in list(pg.lines) + list(pg.curves) + list(pg.rects):
        cont[(int((o['x0'] - bx0) // bloco_pt), int((o['top'] - bt) // bloco_pt))] += 1
    for o in pg.images:
        cont[(int((o['x0'] - bx0) // bloco_pt), int((o['top'] - bt) // bloco_pt))] += min_obj
    W, H = pg.width, pg.height
    todos = [(i, j) for j in range(int(H // bloco_pt) + 1) for i in range(int(W // bloco_pt) + 1)]
    return [b for b in todos if cont[b] >= min_obj], len(todos), (W, H)


def blocos_por_parede(pdf, pno, bloco_pt=700, frac_min=0.15, min_pares=50):
    """Blocos onde há parede desenhada como par de linhas paralelas (espessura 0,6 a 8 pt no papel, sobreposição >= 20 pt).
    Mantém o bloco se o seu nº de pares for >= frac_min do melhor bloco. Sem vetor suficiente (escaneada), devolve None."""
    from leitor4 import segmentos, pares
    pg = pdfplumber.open(pdf).pages[pno - 1]
    bx0, bt = pg.bbox[0], pg.bbox[1]
    H_, V_ = segmentos(pg, 20.0)
    cont = collections.Counter()
    for c1, c2, a, b in pares(H_, 0.6, 8.0, 20.0):
        cont[(int(((a + b) / 2 - bx0) // bloco_pt), int((c1 - bt) // bloco_pt))] += 1
    for c1, c2, a, b in pares(V_, 0.6, 8.0, 20.0):
        cont[(int((c1 - bx0) // bloco_pt), int(((a + b) / 2 - bt) // bloco_pt))] += 1
    if sum(cont.values()) < min_pares:
        return None
    melhor = max(cont.values())
    W, H = pg.width, pg.height
    todos = [(i, j) for j in range(int(H // bloco_pt) + 1) for i in range(int(W // bloco_pt) + 1)]
    return [b for b in todos if cont[b] >= frac_min * melhor], len(todos), (W, H)


def _rotulos_do_bloco(d, giro, W, H, x0, y0, dpi):
    """Pareia nome (maiúsculas, acima) com número no quadro girado e devolve o número em pontos da folha."""
    esc = 72 / dpi
    ws = []
    for i, t in enumerate(d['text']):
        t = t.strip()
        if t and float(d['conf'][i]) > 30:
            ws.append(dict(t=t, x=d['left'][i] * esc, y=d['top'][i] * esc, w=d['width'][i] * esc, h=d['height'][i] * esc, conf=float(d['conf'][i])))
    nums = []
    for w in ws:
        m = NUM.search(w['t'])
        if m and float(m.group(1).replace(',', '.')) >= 1.0:
            nums.append((w, float(m.group(1).replace(',', '.'))))
    palavras = [w for w in ws if PALAVRA.match(w['t']) and not IGN.match(w['t'])]
    out = []
    for n, v in nums:
        acima = [o for o in palavras if 0 < n['y'] - o['y'] < 26 and abs((o['x'] + o['w'] / 2) - (n['x'] + n['w'] / 2)) < 60]
        nome = ''
        if acima:
            ref = min(acima, key=lambda o: n['y'] - o['y'])             # linha mais próxima acima do número
            linha = sorted((o for o in acima if abs(o['y'] - ref['y']) < 5), key=lambda o: o['x'])
            nome = ' '.join(o['t'] for o in linha)
        cx, cy = n['x'] + n['w'] / 2, n['y']
        if giro == 90:                              # PIL rotate(90): (x, y) do bloco original = (W - y', x')
            sx, sy = W - cy, cx
        elif giro == 270:
            sx, sy = cy, H - cx
        else:
            sx, sy = cx, cy
        m2 = bool(re.search(r'[mM][²2]', n['t'])) or any(re.fullmatch(r'[mM][²2z?]', o['t']) and abs(o['y'] - n['y']) < 8 and 0 <= o['x'] - (n['x'] + n['w']) < 30 for o in ws)
        out.append(dict(nome=nome, area=v, x=x0 + sx, y=y0 + sy, conf=n['conf'], giro=giro, dpi=dpi, m2=m2))
    return out


def ocr_rotulos(pdf, pno, blocos, dpis=(150, 300, 400), giros=(0, 90, 270), bloco_pt=700, sobra_pt=40):
    pg = pdfium.PdfDocument(pdf)[pno - 1]
    PW, PH = pg.get_size()
    achados = []
    for (i, j) in blocos:
        x0, y0 = max(i * bloco_pt - sobra_pt, 0), max(j * bloco_pt - sobra_pt, 0)
        x1, y1 = min((i + 1) * bloco_pt + sobra_pt, PW), min((j + 1) * bloco_pt + sobra_pt, PH)
        for dpi in dpis:
            img = pg.render(scale=dpi / 72, crop=(x0, PH - y1, PW - x1, y0)).to_pil().convert('L')
            for g in giros:
                im = img if g == 0 else img.rotate(g, expand=True)
                d = pytesseract.image_to_data(im, lang='por', config='--psm 11', output_type=pytesseract.Output.DICT)
                achados += _rotulos_do_bloco(d, g, img.width * 72 / dpi, img.height * 72 / dpi, x0, y0, dpi)
    return achados


def fundir(achados, dist=10.0):
    """Mesmo valor a menos de `dist` pt = o mesmo rótulo visto em outra resolução, giro ou bloco. Junta nome e m² e conta em quantas passadas (dpi, giro) apareceu."""
    out = []
    for a in sorted(achados, key=lambda a: (not a['nome'], -a['conf'])):
        b = next((b for b in out if abs(a['area'] - b['area']) < 0.001 and abs(a['x'] - b['x']) < dist and abs(a['y'] - b['y']) < dist), None)
        if b is None:
            b = dict(a); b['_passadas'] = {(a['dpi'], a['giro'])}; out.append(b)
        else:
            b['m2'] = b['m2'] or a['m2']
            b['nome'] = b['nome'] or a['nome']
            b['_passadas'].add((a['dpi'], a['giro']))
    for b in out:
        b['n'] = len(b.pop('_passadas'))
    return out


def plano_ocr(pdf, pno):
    """Resoluções e tamanho de bloco pela própria página: com imagem raster usa o dpi nativo (e 1,5x); sem imagem, o padrão para vetor."""
    pg = pdfplumber.open(pdf).pages[pno - 1]
    nativos = [im['srcsize'][0] / (im['x1'] - im['x0']) * 72 for im in pg.images if im['x1'] - im['x0'] > 5 and im.get('srcsize')]
    if len(nativos) >= 5:                            # página que é imagem: soma o dpi nativo (e 1,5x) ao padrão, sem repetir resolução parecida
        D = sorted(nativos)[len(nativos) // 2]
        dpis = [150, 300, 400]
        for d in (D, 1.5 * D):
            if all(d / k > 1.15 or k / d > 1.15 for k in dpis):
                dpis.append(int(d))
        dpis = tuple(sorted(dpis))
        return dpis, int(min(700, 6000 / dpis[-1] * 72))
    return (150, 300, 400), 700


def rotulos_auto(pdf, pno, min_vetor=MIN_VETOR, forcar_ocr=False, criterio='conteudo'):
    t0 = time.time()
    P = Prancha(pdf, pno, denom=50)
    vet = rotulos_area(P)
    info = dict(vetor=len(vet), t_vetor=round(time.time() - t0, 1))
    if len(vet) >= min_vetor and not forcar_ocr:
        return 'vetor', vet, info
    dpis, bloco_pt = plano_ocr(pdf, pno)
    sel = blocos_por_parede(pdf, pno, bloco_pt=bloco_pt) if criterio == 'parede' else None
    blocos, total, (W, H) = sel if sel else blocos_com_conteudo(pdf, pno, bloco_pt=bloco_pt)
    info['criterio'] = 'parede' if sel else 'conteudo'
    t1 = time.time()
    rot = fundir(ocr_rotulos(pdf, pno, blocos, dpis=dpis, bloco_pt=bloco_pt))
    info.update(dpis=dpis, bloco_pt=bloco_pt, blocos=f"{len(blocos)}/{total}", t_ocr=round(time.time() - t1, 1), ocr=len(rot), com_m2=sum(1 for r in rot if r['m2']), com_m2_e_nome=sum(1 for r in rot if r['m2'] and r['nome']))
    return 'ocr', rot, info


if __name__ == '__main__':
    from bancada3 import CASOS
    from bancada4 import EXTRA
    caso = sys.argv[1]
    pdf, pno, _ = CASOS[caso] if caso in CASOS else EXTRA[caso]
    forcar = len(sys.argv) > 2 and sys.argv[2] == 'ocr'
    crit = sys.argv[3] if len(sys.argv) > 3 else 'conteudo'
    fonte, rot, info = rotulos_auto(pdf, pno, forcar_ocr=forcar, criterio=crit)
    if forcar:                                       # pontua o OCR contra o texto vetorial: acerto por valor, e quantos dos acertos e dos extras têm nome
        ref = sorted(r['area'] for r in rotulos_area(Prancha(pdf, pno, denom=50)))
        livres = list(rot); ok = ok_nome = ok_m2 = 0
        for v in ref:
            j = next((i for i, g in enumerate(livres) if abs(g['area'] - v) <= 0.011), None)
            if j is not None:
                ok += 1; ok_nome += bool(livres[j]['nome']); ok_m2 += bool(livres[j]['m2']); livres.pop(j)
        info.update(recuperou=f"{ok}/{len(ref)}", recuperou_com_nome=f"{ok_nome}/{len(ref)}", recuperou_com_m2=f"{ok_m2}/{len(ref)}", sobras=len(livres), sobras_com_nome=sum(1 for g in livres if g['nome']), sobras_com_m2=sum(1 for g in livres if g['m2']))
    print(caso, fonte, info, flush=True)
    json.dump(rot, open(f'../dados/spike/ocr_{caso}.json', 'w'), ensure_ascii=False)
    for r in rot[:40]:
        print(f"   {r['nome'][:22]:22} {r['area']:8.2f}")
