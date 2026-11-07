import sys, zipfile, os
for z in sys.argv[1:]:
    with zipfile.ZipFile(z) as zf:
        print(f"\n### {os.path.basename(z)}")
        for i in zf.infolist():
            if not i.is_dir(): print(f"  {i.file_size/1e6:8.1f} MB  {i.filename}")
