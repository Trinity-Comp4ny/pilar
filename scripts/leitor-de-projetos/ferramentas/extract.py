import sys, zipfile, os, pathlib
dest_root = pathlib.Path(sys.argv[1])
for z in sys.argv[2:]:
    name = pathlib.Path(z).stem.split('-2026')[0].strip()
    with zipfile.ZipFile(z) as zf:
        for i in zf.infolist():
            if i.is_dir(): continue
            if os.path.splitext(i.filename)[1].lower() not in ('.pdf', '.dwg', '.dxf', '.ifc'): continue
            out = dest_root / name / pathlib.Path(i.filename).name
            out.parent.mkdir(parents=True, exist_ok=True)
            if out.resolve().parent != (dest_root / name).resolve(): raise SystemExit('caminho inesperado')
            with zf.open(i) as src, open(out, 'wb') as dst: dst.write(src.read())
            print(out.relative_to(dest_root))
