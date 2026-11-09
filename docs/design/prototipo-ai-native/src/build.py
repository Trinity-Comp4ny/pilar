import pathlib, re
d = pathlib.Path(__file__).parent
base = (d.parent / 'index.v1.html').read_text(encoding='utf-8')
css = (d / 'extra.css').read_text(encoding='utf-8')
js = '\n'.join((d / f).read_text(encoding='utf-8') for f in ['1-core.js', '2-gestao.js', '3-obra.js', '4-resto.js'])
head, rest = base.split('</style>', 1)
html = head + css + '</style>' + rest
start = html.index('<script>\n/* ============ ícones ============ */')
end = html.index('</script>\n</body>')
html = html[:start] + '<script>\n' + js + '\n' + html[end:]
html = html.replace('dado fictício · 04/11/2026', 'v2 · dado fictício · 04/11/2026')
(d.parent / 'index.html').write_text(html, encoding='utf-8')
print(len(html))
