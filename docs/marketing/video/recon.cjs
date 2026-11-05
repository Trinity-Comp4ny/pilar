// Recon: log in with the local seed user and screenshot key screens.
const { chromium } = require('playwright');
const OUT = __dirname + '/recon';
const BASE = 'http://localhost:8090';
const routes = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login');
  await page.fill('input[type=email]', process.env.DEMO_USER || 'video@local.test');
  await page.fill('input[type=password]', '123456');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  for (const r of routes) {
    await page.goto(BASE + r);
    await page.waitForTimeout(3500);
    const name = r.replace(/[^a-z0-9]+/gi, '_') || 'root';
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('ok', r, page.url());
  }
  await browser.close();
})();
