import sys, pathlib, json, pdfplumber, pypdfium2 as pdfium
SIZES={'A0':(841,1189),'A1':(594,841),'A2':(420,594),'A3':(297,420),'A4':(210,297)}
def fmt(w,h):
    a,b=sorted((w,h))
    for k,(x,y) in SIZES.items():
        if abs(a-x)<15 and abs(b-y)<15: return k
    return f"{a:.0f}x{b:.0f}mm"
root=pathlib.Path(sys.argv[1]); rows=[]
for p in sorted(root.rglob('*')):
    if p.suffix.lower()!='.pdf': continue
    try:
        doc=pdfium.PdfDocument(str(p))
        with pdfplumber.open(p) as pdf:
            for i,pg in enumerate(pdf.pages):
                w,h=pg.width*25.4/72, pg.height*25.4/72
                lines=len(pg.lines); rects=len(pg.rects); curves=len(pg.curves); chars=len(pg.chars); imgs=len(pg.images)
                big_img=any((im['x1']-im['x0'])*(im['bottom']-im['top'])>0.5*pg.width*pg.height for im in pg.images)
                kind='escaneado' if big_img and lines+curves<50 else ('desenho vetorial' if lines+curves+rects>500 else ('texto' if chars>500 else 'misto/leve'))
                # carimbo: texto do quadrante inferior direito
                x0,t0,x1,b1=pg.bbox; crop=pg.crop((x0+0.70*(x1-x0), t0+0.70*(b1-t0), x1, b1))
                tb=' '.join(crop.extract_text(layout=False).split())[:260] if crop else ''
                fonts=set(c.get('fontname','')[:20] for c in pg.chars[:400])
                rows.append(dict(arquivo=str(p.relative_to(root)),pag=i+1,folha=fmt(w,h),tipo=kind,linhas=lines,curvas=curves,rets=rects,chars=chars,imgs=imgs,carimbo=tb))
        ocg = 'OCProperties' in str(doc.raw) if False else None
    except Exception as e:
        rows.append(dict(arquivo=str(p.relative_to(root)),erro=str(e)[:120]))
json.dump(rows,open(sys.argv[2],'w'),ensure_ascii=False,indent=1)
for r in rows:
    if 'erro' in r: print('ERRO',r['arquivo'],r['erro']); continue
    print(f"{r['arquivo'][:55]:55} p{r['pag']:<2} {r['folha']:5} {r['tipo']:16} L{r['linhas']:<6} C{r['curvas']:<6} R{r['rets']:<5} T{r['chars']:<6} I{r['imgs']}")
