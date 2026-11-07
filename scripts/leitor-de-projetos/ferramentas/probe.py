import sys, collections, re, pdfplumber
pdf=pdfplumber.open(sys.argv[1]); pg=pdf.pages[int(sys.argv[2])-1]
print('bbox',pg.bbox)
c=collections.Counter()
for kind in ('rects','curves','lines'):
    for o in getattr(pg,kind):
        c[(kind, bool(o.get('fill')), str(o.get('non_stroking_color'))[:28], str(o.get('stroking_color'))[:20])]+=1
for k,v in c.most_common(18): print(v,k)
words=pg.extract_words(keep_blank_chars=True, use_text_flow=False, extra_attrs=['upright','size'])
for w in words:
    t=w['text']
    if re.search(r'A\s*=|Planta|ESC|m²|Quadro|QUADRO|TOTAL|TÉRREO|SUPERIOR',t): print(round(w['x0']),round(w['top']),w['upright'],round(w['size'],1),t[:60])
