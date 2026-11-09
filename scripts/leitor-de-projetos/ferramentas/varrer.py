"""Varre PDFs e diz, só pelo texto (sem renderizar), quais páginas têm gabarito de área e qual a escala impressa."""
import sys, os, re, glob
sys.path.insert(0, os.path.dirname(__file__))
import pdfplumber, pypdfium2 as pdfium
from leitor import Prancha
from leitor2 import rotulos_area

class Leve:                      # só o que rotulos_area usa do Prancha: linhas() do texto
    def __init__(self, pg):
        self.pg = pg
    from leitor import Prancha as _P
    linhas = _P.linhas
for f in sorted(glob.glob(sys.argv[1])):
    d = pdfium.PdfDocument(f); m = d.get_metadata_dict()
    print(f"\n### {os.path.basename(f)[:58]}  págs={len(d)} {tuple(round(v*25.4/72) for v in d[0].get_size())}mm  produtor={m.get('Producer','')[:28]!r} criador={m.get('Creator','')[:26]!r}", flush=True)
    with pdfplumber.open(f) as pdf:
        for i, pg in enumerate(pdf.pages[:int(sys.argv[2]) if len(sys.argv) > 2 else 6]):
            txt = ' '.join(w['text'] for w in pg.extract_words())
            esc = sorted(set(int(x) for x in re.findall(r'ESC[A-Z]*\.?\s*:?\s*1\s*[:/]\s*(\d{2,3})\b', txt, re.I)))
            L = Leve(pg)
            try:
                rot = rotulos_area(L)
            except Exception as e:
                rot = []
            print(f"  p{i+1}: chars={len(pg.chars)} imgs={len(pg.images)} escalas={esc} rótulos de área={len(rot)}  {[ (r['nome'][:10], r['area']) for r in rot[:4]]}", flush=True)
