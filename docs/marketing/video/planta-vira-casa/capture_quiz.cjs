const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = __dirname; const [,, outDir, only] = process.argv;
const types = { '.js':'text/javascript', '.woff2':'font/woff2', '.html':'text/html' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(8767, async () => {
  const { items, seq } = JSON.parse(fs.readFileSync(path.join(root, 'quiz_seq.json')));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.goto('http://localhost:8767/quiz.html'); await pg.waitForFunction(() => window.ready);
  fs.mkdirSync(outDir, { recursive: true });
  const idx = only ? only.split(',').map(Number) : seq.map((_, i) => i);
  for (const i of idx) { await pg.evaluate(([s, it]) => window.render(s, it), [seq[i], items]);
    await pg.screenshot({ path: path.join(outDir, `q${String(i).padStart(4,'0')}.png`), omitBackground: true }); }
  await b.close(); srv.close();
});
