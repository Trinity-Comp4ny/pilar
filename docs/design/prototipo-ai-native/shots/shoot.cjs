const { chromium } = require(process.argv[2]);
const path = require('path');
const out = path.join(__dirname);
const url = 'file://' + path.resolve(__dirname, '../prototipo-ai-native/index.html');

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  const go = async id => { await page.click(`.rail .ri.desk[data-go="${id}"]`); await page.waitForTimeout(500); };
  const shot = async name => page.screenshot({ path: path.join(out, name + '.png'), fullPage: false });

  for (const id of ['plano', 'inicio', 'comercial', 'templates', 'orcamento', 'compras', 'precos', 'portal']) { await go(id); await shot(id); }

  await go('comercial'); await page.click('[data-act="waparse"]'); await page.waitForTimeout(300); await shot('comercial-parsed');
  await go('proposta');
  for (let i = 0; i < 6; i++) { await page.click(`.step:nth-child(${i + 1})`); await page.waitForTimeout(250); if (i === 2 || i === 5) await shot('proposta-' + i); }

  await go('documentos'); await page.click('[data-act="scan"]'); await page.waitForTimeout(1200); await shot('scan-reading');
  await page.waitForTimeout(4500); await shot('scan-2d');
  await page.click('[data-act="scanview"][data-arg="3d"]'); await page.waitForTimeout(1500); await shot('scan-3d');

  await go('obra'); await shot('obra'); await page.click('[data-act="clima"]'); await page.waitForTimeout(1200); await shot('obra-clima');
  await go('campo'); await page.waitForTimeout(800); await shot('campo-idle');
  await page.click('[data-act="rec"]'); await page.waitForTimeout(1200); await shot('campo-rec');
  await page.waitForTimeout(3600); await page.waitForTimeout(900); await shot('campo-reported-mid');
  await page.waitForTimeout(1800); await shot('campo-reported');
  await page.click('[data-act="confirm"]'); await page.waitForTimeout(1000); await shot('campo-confirmed');

  // estados
  for (const st of ['vazio', 'carregando', 'erro']) { await page.click(`[data-st="${st}"]`); await page.waitForTimeout(300); await shot('estado-' + st); }
  await page.click('[data-st="cheio"]');

  // celular
  await page.click('[data-dev="mobile"]'); await page.waitForTimeout(300);
  for (const id of ['inicio', 'obra', 'campo']) {
    await page.click(`.rail .ri.mob[data-go="${id}"]`); await page.waitForTimeout(900); await shot('m-' + id);
  }
  await page.click('.rail .ri.mob[data-act="sheet"]'); await page.waitForTimeout(300); await shot('m-menu');

  console.log(errors.length ? errors.join('\n') : 'NO_ERRORS');
  await browser.close();
})();
