import sys, pypdfium2 as pdfium, pathlib
pdf, out, scale = sys.argv[1], pathlib.Path(sys.argv[2]), float(sys.argv[3])
pages = [int(x) for x in sys.argv[4].split(',')]
out.mkdir(parents=True, exist_ok=True)
doc = pdfium.PdfDocument(pdf)
for p in pages:
    img = doc[p-1].render(scale=scale).to_pil()
    img.convert('RGB').save(out / f"{pathlib.Path(pdf).stem[:20]}-p{p}.jpg", quality=80)
    print(out / f"{pathlib.Path(pdf).stem[:20]}-p{p}.jpg", img.size)
