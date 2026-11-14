// Captura uma página de animação (window.render(t), window.DUR) em JPEG por quadro + cues.json para a trilha.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = __dirname; const [,, page, outDir, only] = process.argv;
const types = { '.js':'text/javascript', '.css':'text/css', '.woff2':'font/woff2', '.svg':'image/svg+xml', '.html':'text/html', '.png':'image/png', '.jpg':'image/jpeg' };
const srv = http.createServer((q, r) => { const p = path.resolve(root, '.' + path.posix.normalize('/' + decodeURIComponent(q.url.split('?')[0]))); if (!p.startsWith(root + path.sep)) { r.writeHead(403); return r.end(); } fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, '127.0.0.1', async () => {
  const port = srv.address().port; const b = await chromium.launch();
  const vp = page.includes('w=1920') ? { width: 1920, height: 1080 } : page.includes('h=1350') ? { width: 1080, height: 1350 } : { width: 1080, height: 1920 };
  const pg = await b.newPage({ viewport: vp }); pg.on('pageerror', e => console.log('ERR', e.message)); pg.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  await pg.goto(`http://localhost:${port}/${page}`); await pg.waitForFunction(() => window.ready, null, { timeout: 60000 });
  fs.mkdirSync(outDir, { recursive: true });
  const dur = await pg.evaluate(() => window.DUR); const n = Math.round(dur * 30);
  fs.writeFileSync(path.join(outDir, 'cues.json'), JSON.stringify(await pg.evaluate(() => ({ dur: window.DUR, cues: window.CUES }))));
  const idx = only ? only.split(',').map(Number) : Array.from({ length: n }, (_, i) => i);
  for (const i of idx) { const t = only ? i : i / 30; await pg.evaluate(t => window.render(t), t);
    await pg.screenshot({ path: path.join(outDir, only ? `s${t}.jpg` : `p${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 93 }); }
  await b.close(); srv.close();
});
