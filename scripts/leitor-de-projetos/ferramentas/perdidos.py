"""Recorta, num painel só, os rótulos de área que o OCR em blocos não leu (posição vem do texto vetorial)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pypdfium2 as pdfium
from PIL import Image, ImageDraw
from leitor import Prancha
from leitor2 import rotulos_area
from ocr_tiles import ocr_blocos, numeros, CASOS, EXTRA

caso = sys.argv[1]; dpi = int(sys.argv[2]) if len(sys.argv) > 2 else 400
pdf, pno, _ = CASOS[caso] if caso in CASOS else EXTRA[caso]
P = Prancha(pdf, pno, denom=50)
ref = rotulos_area(P)
ws, _ = ocr_blocos(pdf, pno, dpi=dpi, giros=(0, 90, 270))
lidos = [v for v, _, _ in numeros(ws)]
perdidos = []
for r in ref:
    j = next((i for i, g in enumerate(lidos) if abs(g - r['area']) <= 0.011), None)
    if j is None:
        perdidos.append(r)
    else:
        lidos.pop(j)
print(len(perdidos), 'perdidos:', [(r['nome'][:14], r['area']) for r in perdidos])
pg = pdfium.PdfDocument(pdf)[pno - 1]
W, H = pg.get_size()
crops = []
for r in perdidos[:8]:
    x, y = r['x'] - P.bx0 if hasattr(P, 'bx0') else r['x'], r['y'] - P.btop if hasattr(P, 'btop') else r['y']
    x0, y0, x1, y1 = max(x - 30, 0), max(y - 18, 0), min(x + 90, W), min(y + 22, H)
    im = pg.render(scale=dpi / 72, crop=(x0, H - y1, W - x1, y0)).to_pil().convert('RGB')
    d = ImageDraw.Draw(im); d.text((4, 4), f"{r['nome'][:14]} = {r['area']}", fill=(255, 0, 0))
    crops.append(im)
cw = max(c.width for c in crops); ch = max(c.height for c in crops)
sheet = Image.new('RGB', (cw * 2, ch * ((len(crops) + 1) // 2)), 'white')
for i, c in enumerate(crops):
    sheet.paste(c, ((i % 2) * cw, (i // 2) * ch))
sheet.thumbnail((1500, 1500))
sheet.save(f'../dados/spike/perdidos_{caso}.png')
print('ok', sheet.size)
