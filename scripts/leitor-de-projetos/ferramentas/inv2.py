import sys, pathlib, re, collections, pypdfium2 as pdfium, pdfplumber
p = pathlib.Path(sys.argv[1]); maxp = int(sys.argv[2]) if len(sys.argv) > 2 else 4
d = pdfium.PdfDocument(str(p)); meta = d.get_metadata_dict()
print(f"\n### {p.name[:70]}  págs={len(d)}  produtor={meta.get('Producer','')[:45]!r} criador={meta.get('Creator','')[:45]!r}", flush=True)
with pdfplumber.open(p) as pdf:
    for i, pg in enumerate(pdf.pages[:maxp]):
        w, h = pg.width * 25.4 / 72, pg.height * 25.4 / 72
        big = any((im['x1']-im['x0'])*(im['bottom']-im['top']) > 0.4*pg.width*pg.height for im in pg.images)
        words = pg.extract_words()
        txt = ' '.join(x['text'] for x in words)
        codes = collections.Counter(x['text'] for x in words if re.match(r'^[A-Z]{2,4}\d{2,3}[A-Z]?$', x['text']))
        areas = len(re.findall(r'A\s*=\s*[\d.,]+\s*m', txt))
        print(f"  p{i+1}: {w:.0f}x{h:.0f}mm linhas={len(pg.lines)} curvas={len(pg.curves)} rects={len(pg.rects)} chars={len(pg.chars)} imgs={len(pg.images)} imagem_grande={'sim' if big else 'não'} rótulos_área={areas} códigos={dict(codes.most_common(5))}", flush=True)
