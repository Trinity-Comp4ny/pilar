import sys, zipfile, collections, os
for z in sys.argv[1:]:
    with zipfile.ZipFile(z) as zf:
        infos = zf.infolist()
        ext = collections.Counter()
        size = collections.Counter()
        for i in infos:
            if i.is_dir(): continue
            e = os.path.splitext(i.filename)[1].lower() or '(sem)'
            ext[e] += 1; size[e] += i.file_size
        top = collections.Counter(i.filename.split('/')[0] + '/' + (i.filename.split('/')[1] if i.filename.count('/') > 1 else '') for i in infos if not i.is_dir())
        print(f"\n### {os.path.basename(z)}  ({len(infos)} itens)")
        print("  extensões:", ", ".join(f"{k}:{v} ({size[k]/1e6:.0f}MB)" for k, v in ext.most_common()))
        print("  pastas:", "; ".join(f"{k} [{v}]" for k, v in top.most_common(12)))
