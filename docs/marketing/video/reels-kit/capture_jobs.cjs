// Renderiza quadros de uma página 3D a partir de um JSON de trabalho: {url, w, h, frames:[{name, t, o}]}
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = __dirname; const [,, jobFile, outDir] = process.argv;
const job = JSON.parse(fs.readFileSync(jobFile));
const srv = http.createServer((q, r) => { const p = path.resolve(root, '.' + path.posix.normalize('/' + decodeURIComponent(q.url.split('?')[0]))); if (!p.startsWith(root + path.sep)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); });
srv.listen(0, '127.0.0.1', async () => {
  const port = srv.address().port;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: job.w, height: job.h } });
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.goto(`http://localhost:${port}/${job.url}`); await pg.waitForFunction(() => window.ready, null, { timeout: 120000 });
  fs.mkdirSync(outDir, { recursive: true }); const t0 = Date.now();
  const prontos = new Set(fs.readdirSync(outDir)); // retoma um lote interrompido sem refazer quadros
  for (let i = 0; i < job.frames.length; i++) { const f = job.frames[i]; if (prontos.has(f.name + '.jpg')) continue; const out = path.join(outDir, f.name + '.jpg');
    const url = await pg.evaluate(([t, o]) => window.grab(t, 0.93, o), [f.t, f.o || {}]);
    try { fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'), { flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    if (i % 30 === 0) console.log(job.url, 'frame', i, '/', job.frames.length, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  await b.close(); srv.close();
});
