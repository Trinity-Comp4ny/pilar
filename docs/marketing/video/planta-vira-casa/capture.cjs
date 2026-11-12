const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = __dirname;
const [,, mode, outDir] = process.argv; // mode: "test" | "full"
const srv = http.createServer((q, r) => { const p = path.resolve(root, '.' + path.posix.normalize('/' + decodeURIComponent(q.url.split('?')[0]))); if (!p.startsWith(root + path.sep)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); });
srv.listen(8765, '127.0.0.1', async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  pg.on('console', m => console.log('page:', m.text())); pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.goto('http://localhost:8765/' + (process.env.PAGE || 'index.html')); await pg.waitForFunction(() => window.ready, null, { timeout: 120000 });
  fs.mkdirSync(outDir, { recursive: true });
  const ev = await pg.evaluate(() => window.EVENTS || null); if (ev) fs.writeFileSync(path.join(outDir, 'events.json'), JSON.stringify(ev));
  const times = mode === 'test' ? (process.env.TIMES || '0.3,1.6,2.6,3.6,4.6,5.6,6.5,7.5,8.6,9.9').split(',').map(Number) : Array.from({ length: +(process.env.N || 300) }, (_, i) => i / 30);
  const t0 = Date.now();
  for (let i = 0; i < times.length; i++) {
    const url = await pg.evaluate(t => window.grab(t), times[i]);
    fs.writeFileSync(path.join(outDir, mode === 'test' ? `t${times[i].toFixed(1)}.jpg` : `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    if (i % 30 === 0) console.log('frame', i, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  await b.close(); srv.close();
});
