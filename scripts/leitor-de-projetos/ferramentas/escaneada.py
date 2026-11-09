import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pypdfium2 as pdfium
from texto_auto import rotulos_auto
pdf = '../dados/raw4/pdf/caso_h_escaneada.pdf'
pg = pdfium.PdfDocument(pdf)[0]
pg.render(scale=1500 / pg.get_size()[1]).to_pil().convert('RGB').save('../dados/spike/visao/escaneada_pagina.png')
fonte, rot, info = rotulos_auto(pdf, 1)
print('FONTE', fonte, info, flush=True)
json.dump(rot, open('../dados/spike/visao/escaneada_ocr.json', 'w'), ensure_ascii=False); json.dump(rot, open('../dados/spike/ocr_escaneada.json', 'w'), ensure_ascii=False)
for r in sorted(rot, key=lambda r: (not r['nome'], r['y']))[:60]:
    print(f"   {r['nome'][:24]:24} {r['area']:8.2f}  x={r['x']:.0f} y={r['y']:.0f} conf={r['conf']:.0f}")
