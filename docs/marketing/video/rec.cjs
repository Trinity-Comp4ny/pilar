// Records product takes from the local app for the marketing videos.
// Each take: CDP screencast at DPR 2, a drawn cursor, eased mouse moves, encoded to H.264.
// Usage: node rec.cjs [takeName ...]   (no args = all takes)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const BASE = 'http://localhost:8090';
const OUT = path.join(__dirname, 'takes');
const STATE = path.join(__dirname, '.auth.json');
const OBRA = '/obras/a1000000-0000-0000-0000-000000000a01';
const RETROFIT = '/projetos/a1000000-0000-0000-0000-000000000406';

const CURSOR = `(() => {
  if (window.__cur) return; window.__cur = 1;
  const add = () => {
    if (!document.body || document.getElementById('__cur')) return;
    const s = document.createElement('style');
    s.textContent = '#__cur{position:fixed;left:0;top:0;width:28px;height:28px;z-index:2147483647;pointer-events:none;transform:translate(-80px,-80px);filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))}' +
      '.__rip{position:fixed;z-index:2147483646;pointer-events:none;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:rgba(164,236,134,.45);border:2px solid #366B1F;animation:__r .5s ease-out forwards}' +
      '@keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.3);opacity:0}} *{cursor:none!important}';
    document.head.appendChild(s);
    const c = document.createElement('div'); c.id = '__cur';
    c.innerHTML = '<svg viewBox="0 0 28 28" width="28" height="28"><path d="M6 3.5 L6 22.5 L10.6 18.2 L13.7 25 L16.9 23.6 L13.9 16.9 L20.2 16.9 Z" fill="#1A1A1A" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const p = window.__p || { x: -80, y: -80 };
    c.style.transform = 'translate(' + (p.x - 6) + 'px,' + (p.y - 4) + 'px)';
    addEventListener('mousemove', (e) => { window.__p = { x: e.clientX, y: e.clientY }; c.style.transform = 'translate(' + (e.clientX - 6) + 'px,' + (e.clientY - 4) + 'px)'; }, true);
    addEventListener('mousedown', (e) => { const r = document.createElement('div'); r.className = '__rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 600); }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add); else add();
  new MutationObserver(add).observe(document.documentElement, { childList: true });
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function recorder(page) {
  let pos = { x: 1200, y: 700 };
  let cdp;
  let frames = [];
  let dir;
  const move = async (x, y, ms = 800) => {
    const steps = Math.max(8, Math.round(ms / 16));
    const from = { ...pos };
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      await page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
      await sleep(16);
    }
    pos = { x, y };
  };
  const click = async (x, y) => { await move(x, y); await sleep(150); await page.mouse.down(); await sleep(90); await page.mouse.up(); await sleep(250); };
  const clickOn = async (locator) => {
    const b = await locator.first().boundingBox();
    if (!b) throw new Error('element not found for click');
    await click(b.x + b.width / 2, b.y + b.height / 2);
  };
  const hoverOn = async (locator, ms = 800) => {
    const b = await locator.first().boundingBox();
    if (!b) return;
    await move(b.x + b.width / 2, b.y + b.height / 2, ms);
  };
  const scroll = async (dy, ms = 900) => {
    const steps = Math.round(ms / 16);
    for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await sleep(16); }
  };
  const start = async (name) => {
    dir = path.join(OUT, `${name}_frames`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    frames = [];
    cdp = await page.context().newCDPSession(page);
    cdp.on('Page.screencastFrame', async (f) => {
      const file = path.join(dir, `${String(frames.length).padStart(5, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      frames.push({ file, t: f.metadata.timestamp });
      try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  };
  const stop = async (name) => {
    await sleep(300);
    await cdp.send('Page.stopScreencast');
    await sleep(200);
    // variable frame times -> concat list with durations, rendered at constant 30 fps
    const lines = [];
    for (let i = 0; i < frames.length; i++) {
      const dur = i < frames.length - 1 ? Math.max(0.001, frames[i + 1].t - frames[i].t) : 0.5;
      lines.push(`file '${frames[i].file}'`, `duration ${dur.toFixed(4)}`);
    }
    lines.push(`file '${frames[frames.length - 1].file}'`);
    const list = path.join(dir, 'list.txt');
    fs.writeFileSync(list, lines.join('\n'));
    const out = path.join(OUT, `${name}.mp4`);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', 'scale=2880:1800:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', out]);
    const d = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
    console.log(`take ${name}: ${frames.length} frames, ${d}s`);
  };
  return { move, click, clickOn, hoverOn, scroll, start, stop, pos: () => pos };
}

async function goto(page, route, settle = 2500) {
  await page.goto(BASE + route);
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(settle);
}

const TAKES = {
  // Início: weekly summary written by the agent, checked against the numbers
  async inicio(page, r) {
    await goto(page, '/inicio');
    await r.start('inicio');
    await sleep(600);
    await r.hoverOn(page.getByText('Semana de caixa positivo'), 1100);
    await sleep(900);
    await r.hoverOn(page.getByText('17% acima'), 900);
    await sleep(1200);
    await r.move(700, 600, 900);
    await r.scroll(380, 1300);
    await sleep(1400);
    await r.stop('inicio');
  },
  // Commercial: leads funnel, then proposals
  async comercial(page, r) {
    await goto(page, '/gestao/leads');
    await r.start('comercial');
    await sleep(500);
    await r.hoverOn(page.getByText('Márcio Pacheco'), 1000);
    await sleep(700);
    await r.hoverOn(page.getByText('Juliana Reis'), 800);
    await sleep(600);
    await r.clickOn(page.getByRole('link', { name: 'Propostas' }));
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(1200);
    await r.hoverOn(page.getByText('Galpão Anhanguera: estrutural'), 1000);
    await sleep(1500);
    await r.stop('comercial');
  },
  // Projects board, open the over-budget retrofit project
  async projetos(page, r) {
    await goto(page, '/projetos');
    await r.start('projetos');
    await sleep(500);
    await r.hoverOn(page.getByText('Edifício Alameda Jardins'), 1000);
    await sleep(600);
    await r.clickOn(page.getByText('Retrofit Hotel Serra Verde').first());
    await sleep(1600);
    await r.clickOn(page.getByText('Abrir projeto completo'));
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(1500);
    await r.hoverOn(page.getByText('Margem bruta').locator('visible=true'), 1000);
    await sleep(1500);
    await r.stop('projetos');
  },
  // Retrofit: scope tab with the add-on prepared from the expenses
  async aditivo(page, r) {
    await goto(page, RETROFIT);
    await r.start('aditivo');
    await sleep(500);
    await r.clickOn(page.getByRole('tab', { name: /Escopo/ }));
    await sleep(1800);
    await r.hoverOn(page.getByText(/novo traçado de dutos/i), 1100);
    await sleep(2000);
    await r.stop('aditivo');
  },
  // Construction site overview: weather alert, progress, S-curve
  async obra(page, r) {
    await goto(page, OBRA, 3500);
    await r.start('obra');
    await sleep(600);
    await r.hoverOn(page.getByText('Clima pode atrapalhar'), 1100);
    await sleep(1600);
    await r.hoverOn(page.getByText(/Concretagem da laje do pavimento superior/).first(), 900);
    await sleep(1600);
    await r.move(800, 700, 800);
    await r.scroll(420, 1400);
    await sleep(1500);
    await r.stop('obra');
  },
  // Schedule (Gantt) of the site
  async cronograma(page, r) {
    await goto(page, OBRA, 3000);
    await r.start('cronograma');
    await sleep(400);
    await r.clickOn(page.getByRole('tab', { name: /Cronograma/ }));
    await sleep(2200);
    await r.hoverOn(page.getByText(/Concretagem da laje do pavimento superior/).first(), 1100);
    await sleep(2000);
    await r.stop('cronograma');
  },
  // Daily log organized from the foreman's message
  async diario(page, r) {
    await goto(page, OBRA, 3000);
    await r.start('diario');
    await sleep(400);
    await r.clickOn(page.getByRole('tab', { name: /Diário/ }));
    await sleep(2000);
    await r.hoverOn(page.getByText(/Concretagem dos pilares P7 a P12/).first(), 1100);
    await sleep(2200);
    await r.stop('diario');
  },
  // Agents: the pending queue built by rules
  async pendencias(page, r) {
    await goto(page, '/agentes');
    await r.start('pendencias');
    await sleep(500);
    await r.clickOn(page.getByRole('button', { name: /Pendências/ }).or(page.getByRole('tab', { name: /Pendências/ })));
    await sleep(1800);
    await r.hoverOn(page.getByText(/Recebimento atrasado/).first(), 1000);
    await sleep(1200);
    await r.hoverOn(page.getByText(/Concretagem da laje/).first(), 900);
    await sleep(1600);
    await r.stop('pendencias');
  },
  // Finance overview
  async financeiro(page, r) {
    await goto(page, '/gestao/financeiro');
    await r.start('financeiro');
    await sleep(500);
    await r.hoverOn(page.getByText(/lucro líquido/i).locator('visible=true'), 1000);
    await sleep(1200);
    await r.hoverOn(page.getByText(/^a receber$/i).locator('visible=true'), 900);
    await sleep(1500);
    await r.stop('financeiro');
  },
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TAKES);
  const browser = await chromium.launch({ args: ['--force-device-scale-factor=2'] });
  if (!fs.existsSync(STATE)) {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await c.newPage();
    await p.goto(BASE + '/login');
    await p.fill('input[type=email]', 'video@local.test');
    await p.fill('input[type=password]', '123456');
    await p.keyboard.press('Enter');
    await p.waitForURL(/inicio|dashboard|agentes/, { timeout: 20000 }).catch(() => {});
    await sleep(2500);
    await c.storageState({ path: STATE });
    await c.close();
  }
  for (const name of names) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, storageState: STATE, locale: 'pt-BR' });
    await ctx.addInitScript(CURSOR);
    const page = await ctx.newPage();
    const r = recorder(page);
    try { await TAKES[name](page, r); } catch (err) { console.error(`take ${name} failed:`, err.message); }
    await ctx.close();
  }
  await browser.close();
})();
