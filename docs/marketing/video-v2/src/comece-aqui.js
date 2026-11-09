// Comece aqui: a Pilar inteira em 49 s (9:16, 1080x1920).
// Dado fictício da empresa de vídeo (Atrium Engenharia), telas reais do app.
import {
  tl, W, el, pos, icon, scene, headline, textIn, textOut, popIn, fadeOut, appWindow, lift, cursor,
  counter, brl, typer, readingRing, mark, lockup, background, cue, finalize, EXPO, QUINT,
} from "./engine.js";

const BG = background({
  glows: [
    [180, 300, 900, "rgba(164,236,134,.35)"],
    [950, 1500, 1000, "rgba(120,200,160,.25)"],
  ],
});
// o brilho deriva devagar o vídeo inteiro
tl.fromTo(BG.glows[0], { opacity: 0.25, x: -80, y: 0 }, { opacity: 0.45, x: 160, y: 220, duration: 49, ease: "sine.inOut" }, 0);
tl.fromTo(BG.glows[1], { opacity: 0.2, x: 60, y: 0 }, { opacity: 0.35, x: -200, y: -300, duration: 49, ease: "sine.inOut" }, 0);

/* =============== 1. Gancho: o mesmo número em quatro lugares (0 a 3,5 s) =============== */
{
  const s = scene("hook", 0, 3.5);
  const h1 = headline(s, "Proposta no Word.|Controle no Excel.|Obra no *WhatsApp*.", { y: 250, size: 80 });
  textIn(h1, 0.05, { stagger: 0.07 });
  textOut(h1, 1.95);
  const h2 = headline(s, "O mesmo número,|digitado *4_vezes*.", { y: 290, size: 92 });
  textIn(h2, 2.1);

  const files = [
    ["file-type", "Proposta_Residencia_v3_FINAL.docx", "Valor do contrato", -2.2],
    ["file-spreadsheet", "Controle de horas (2).xlsx", "Orçado", 1.6],
    ["message-circle", "Grupo Obra Toledo · 128 novas", "Mensagem fixada", -1.2],
    ["file-spreadsheet", "Financeiro_2026.xlsx", "Parcela 1 de 3", 2.0],
  ];
  files.forEach(([ic, name, field, rot], i) => {
    const c = el("div", "card", s);
    const x = i % 2 ? 150 : 70;
    pos(c, x, 650 + i * 200, 860, 170);
    c.style.transform = `rotate(${rot}deg)`;
    c.innerHTML = `
      <div style="display:flex;align-items:center;gap:20px;padding:26px 30px 0">
        <div style="width:56px;height:56px;border-radius:14px;background:#f0f0f0;display:grid;place-items:center">${icon(ic, "ico i28")}</div>
        <div style="font:600 27px Inter;letter-spacing:-.01em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
        <div class="badge" style="font:700 26px Geist;color:#fff;background:var(--red-500);border-radius:999px;padding:6px 16px;opacity:0">${i + 1}×</div>
      </div>
      <div style="display:flex;align-items:center;gap:16px;padding:20px 30px 0 106px">
        <span style="font:500 22px Inter;color:var(--gray-500)">${field}</span>
        <span class="val" style="font:600 30px Inter;color:var(--ink-900);border-bottom:2px solid #e5e5e5;min-width:250px;padding-bottom:2px"></span>
      </div>`;
    popIn(c, 0.25 + i * 0.16, { y: 120, scale: 0.9, sound: "whoosh" });
    const tt = 1.0 + i * 0.42;
    typer(c.querySelector(".val"), tt, "R$ 158.000,00", 34);
    const b = c.querySelector(".badge");
    tl.fromTo(b, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: QUINT }, tt + 0.38);
    cue("tick", tt + 0.38);
    tl.to(c, { opacity: 0, y: -40, duration: 0.25, ease: "power2.in" }, 3.25 + i * 0.03);
  });
  textOut(h2, 3.25);
}

/* =============== 2. O prejuízo aparece no fim (3,5 a 6 s) =============== */
{
  const s = scene("loss", 3.5, 6.05);
  const h = headline(s, "E o prejuízo só|aparece no ~fim~.", { y: 290, size: 92 });
  textIn(h, 3.5);
  const c = el("div", "card dark", s);
  pos(c, 70, 680, 940, 640);
  c.innerHTML = `
    <div style="padding:40px 44px 0;display:flex;justify-content:space-between;align-items:flex-start">
      <div><div class="label" style="color:rgba(255,255,255,.55)">Lucro do projeto</div>
      <div style="font:600 26px Inter;margin-top:10px;color:rgba(255,255,255,.85)">Retrofit Hotel Serra Verde</div></div>
      <div class="lv" style="font:600 76px Geist;letter-spacing:-.03em;color:var(--brand)">+18%</div>
    </div>
    <svg viewBox="0 0 860 400" style="position:absolute;left:40px;top:190px;width:860px;height:400px;overflow:visible">
      <defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ef4444" stop-opacity=".35"/><stop offset="1" stop-color="#ef4444" stop-opacity="0"/></linearGradient></defs>
      <line x1="0" x2="860" y1="200" y2="200" stroke="rgba(255,255,255,.18)" stroke-dasharray="6 8"/>
      <text x="0" y="190" fill="rgba(255,255,255,.4)" font-family="Inter" font-size="20">0%</text>
      <path class="ln" pathLength="1" d="M0 60 C120 64 200 80 300 110 S470 150 560 200 S720 300 860 330" fill="none" stroke="#A4EC86" stroke-width="7" stroke-linecap="round"/>
      <path class="ln2" pathLength="1" d="M560 200 S720 300 860 330" fill="none" stroke="#ef4444" stroke-width="7" stroke-linecap="round"/>
      <circle class="dot" cx="860" cy="330" r="14" fill="#ef4444"/>
      <circle class="dotr" cx="860" cy="330" r="14" fill="none" stroke="#ef4444" stroke-width="4"/>
      ${["Jun", "Jul", "Ago", "Set", "Out", "Nov"].map((m, i) => `<text x="${i * 168}" y="395" fill="rgba(255,255,255,.4)" font-family="Inter" font-size="20">${m}</text>`).join("")}
      <text x="860" y="290" text-anchor="end" fill="#ef4444" font-family="Inter" font-weight="600" font-size="22">entrega</text>
    </svg>`;
  popIn(c, 3.6, { y: 80 });
  const ln = c.querySelector(".ln"), ln2 = c.querySelector(".ln2");
  tl.set([ln, ln2], { strokeDasharray: "1 1", strokeDashoffset: 1 }, 0);
  tl.to(ln, { strokeDashoffset: 0, duration: 1.5, ease: "power2.inOut" }, 3.85);
  tl.to(ln2, { strokeDashoffset: 0, duration: 0.6, ease: "power2.in" }, 4.75);
  tl.fromTo(c.querySelector(".dot"), { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.3, ease: QUINT }, 5.3);
  tl.set(c.querySelector(".dotr"), { opacity: 0 }, 0);
  tl.fromTo(c.querySelector(".dotr"), { scale: 1, opacity: 1, transformOrigin: "50% 50%" }, { scale: 3.2, opacity: 0, duration: 0.8, ease: "power2.out", immediateRender: false }, 5.35);
  const lv = c.querySelector(".lv");
  counter(lv, 3.95, 18, -12, 1.4, (v) => (v >= 0 ? "+" : "−") + Math.abs(Math.round(v)) + "%");
  tl.to(lv, { color: "#ef4444", duration: 0.3 }, 4.9);
  cue("thud", 5.3);
}

/* =============== 3. A marca (6 a 10 s) =============== */
{
  const s = scene("brand", 6.0, 10.05);
  const ring = readingRing(s, { cx: 540, cy: 860, size: 980, t0: 6.0, scale: 1.6 });
  const m = mark(s, { x: 420, y: 758, w: 240, weight: 1.7 });
  m.draw(6.3);
  m.green(6.95);
  // o símbolo assenta no logotipo
  tl.to(m.el, { x: -201, y: -12, scale: 1.048, transformOrigin: "0 0", duration: 0.7, ease: "power3.inOut" }, 7.75);
  tl.to(ring.opacity, { v: 0, duration: 0.6, ease: "power2.in" }, 7.7);
  tl.set(ring.cv, { opacity: 0 }, 8.4);
  const L = lockup(s, { x: 230, y: 760, w: 620 });
  const strokes = L.el.querySelectorAll("g path");
  const word = L.word;
  tl.set(L.el, { opacity: 0 }, 0);
  tl.set(L.el, { opacity: 1 }, 8.42);
  tl.set(m.el, { opacity: 0 }, 8.45);
  [2, 3, 4].forEach((i) => tl.set(strokes[i], { stroke: "#A4EC86" }, 0));
  tl.fromTo(word, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.7, ease: EXPO }, 8.1);
  const tag = headline(s, "Gestão com *agentes_de_IA*|para escritórios de|engenharia e arquitetura.", { y: 1010, size: 62, align: "center", x: 60, w: 960 });
  textIn(tag, 8.45, { stagger: 0.05 });
  cue("impact", 6.0);
}

/* =============== 4. O fluxo (10 a 13,5 s) =============== */
{
  const s = scene("flow", 10.0, 13.55);
  const h = headline(s, "Do primeiro contato|ao *dinheiro_na_conta*.", { y: 270, size: 82 });
  textIn(h, 10.05);
  const nodes = [
    ["user-round", "Lead", "Helena Castro · R$ 120 mil"],
    ["file-text", "Proposta", "Estrutural e MEP · enviada"],
    ["folder-kanban", "Projeto", "Disciplinas, prazos e donos"],
    ["hard-hat", "Obra", "Cronograma, diário e clima"],
    ["wallet", "Financeiro", "Parcelas e lucro do projeto"],
  ];
  const X = 110, Y0 = 600, STEP = 168;
  const line = el("div", "", s);
  pos(line, X + 54, Y0 + 60, 4, STEP * 4);
  Object.assign(line.style, { position: "absolute", background: "linear-gradient(#A4EC86,#A4EC86)", transformOrigin: "50% 0", borderRadius: "4px" });
  const base = el("div", "", s);
  pos(base, X + 54, Y0 + 60, 4, STEP * 4);
  Object.assign(base.style, { position: "absolute", background: "rgba(255,255,255,.12)" });
  s.appendChild(line);
  tl.fromTo(line, { scaleY: 0 }, { scaleY: 1, duration: 1.9, ease: "power1.inOut" }, 10.55);
  nodes.forEach(([ic, t1, t2], i) => {
    const n = el("div", "card dark", s);
    pos(n, X, Y0 + i * STEP, 860, 120);
    n.innerHTML = `<div style="display:flex;align-items:center;gap:28px;height:100%;padding:0 26px">
      <div class="ib" style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.08);display:grid;place-items:center;flex:none">${icon(ic, "ico i30")}</div>
      <div><div style="font:600 34px Geist;letter-spacing:-.02em">${t1}</div><div style="font:400 24px Inter;color:rgba(255,255,255,.6);margin-top:4px">${t2}</div></div>
      <div class="ok" style="margin-left:auto;width:44px;height:44px;border-radius:50%;background:var(--brand);display:grid;place-items:center;opacity:0">${icon("check", "ico i24 ink")}</div></div>`;
    popIn(n, 10.2 + i * 0.09, { y: 60, sound: i === 0 ? "whoosh" : null });
    const at = 10.55 + i * 0.47;
    tl.to(n.querySelector(".ib"), { backgroundColor: "#A4EC86", duration: 0.25 }, at);
    tl.to(n.querySelector(".ib svg"), { stroke: "#1A1A1A", duration: 0.25 }, at);
    tl.to(n, { boxShadow: "0 0 0 2px rgba(164,236,134,.8), 0 30px 80px -10px rgba(0,0,0,.65)", duration: 0.3 }, at);
    tl.fromTo(n.querySelector(".ok"), { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.35, ease: QUINT }, at + 0.1);
    cue("tick", at);
  });
  const ai = el("div", "chip", s, `${icon("sparkles")} Agentes de IA em cada etapa`);
  pos(ai, 110, 1470);
  popIn(ai, 12.75);
  tl.to(s.children, { opacity: 0, duration: 0.25 }, 13.3);
}

/* =============== 5 a 11. Os módulos, numa janela só (13,5 a 39 s) =============== */
const WIN = { x: 40, y: 660, w: 1000, h: 740 };
const app = appWindow(document.getElementById("stage"), WIN);
tl.set(app.el, { opacity: 0 }, 0);
tl.fromTo(app.el, { opacity: 0, y: 140, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: EXPO }, 13.45);
cue("whoosh", 13.45);
tl.to(app.el, { opacity: 0, y: 200, scale: 0.94, duration: 0.45, ease: "power3.in" }, 38.6);

const R = {
  content: { x: 280, y: 0, w: 1160, h: 820 },
  leadsKpi: { x: 300, y: 140, w: 1110, h: 470 },
  propostas: { x: 300, y: 140, w: 1110, h: 400 },
  galpao: { x: 312, y: 430, w: 1088, h: 70 },
  projetoTop: { x: 290, y: 110, w: 1130, h: 600 },
  projetoKpi: { x: 300, y: 120, w: 1110, h: 300 },
  margem: { x: 1198, y: 196, w: 206, h: 90 },
  pend: { x: 470, y: 280, w: 770, h: 340 },
  aditivo: { x: 488, y: 365, w: 738, h: 212 },
  obra: { x: 300, y: 60, w: 1110, h: 700 },
  obraAlert: { x: 300, y: 120, w: 1110, h: 240 },
  alert: { x: 312, y: 190, w: 1090, h: 130 },
  diario: { x: 300, y: 300, w: 1000, h: 500 },
  resumo: { x: 518, y: 440, w: 676, h: 112 },
  fin: { x: 300, y: 100, w: 1110, h: 700 },
  finKpi: { x: 300, y: 220, w: 1110, h: 260 },
  inicio: { x: 300, y: 50, w: 1110, h: 700 },
  banner: { x: 312, y: 75, w: 1090, h: 178 },
  numeros: { x: 312, y: 265, w: 1090, h: 180 },
};

// capítulo: chip + título, com troca entre módulos
let lastChip, lastHead;
function chapter(n, ic, name, text, t, size = 74) {
  if (lastChip) fadeOut(lastChip, t - 0.3, { dur: 0.25, y: -20 });
  if (lastHead) textOut(lastHead, t - 0.32, { dur: 0.28 });
  const c = el("div", "chip");
  c.innerHTML = `<span class="num">${String(n).padStart(2, "0")}</span>${icon(ic)}${name}`;
  pos(c, 70, 250);
  tl.set(c, { opacity: 0 }, 0);
  popIn(c, t, { y: 30, sound: null });
  const h = headline(document.getElementById("stage"), text, { y: 345, size });
  textIn(h, t + 0.08);
  lastChip = c;
  lastHead = h;
  return h;
}
const overlay = (t0, t1) => scene("ov" + t0, t0, t1);

/* 01 Comercial (13,5 a 17) */
{
  chapter(1, "users", "Comercial", "O funil inteiro, com|*valor* em cada etapa.", 13.5);
  app.show("leads", 13.45, R.content, { fade: 0.01 });
  app.move("leads", 13.9, R.leadsKpi, 1.6);
  const s = overlay(13.5, 17.0);
  const k = el("div", "card", s);
  pos(k, 520, 1250, 500, 230);
  k.innerHTML = `<div style="padding:30px 34px"><div class="label">Valor no funil</div>
    <div class="big v" style="color:var(--green-700);margin-top:12px">R$ 0</div>
    <div style="font:500 22px Inter;color:var(--gray-500);margin-top:6px">6 leads ativos · 4 etapas</div></div>`;
  popIn(k, 14.4);
  counter(k.querySelector(".v"), 14.5, 0, 839000, 1.1, brl);
  app.show("propostas", 15.55, R.propostas);
  app.dim(15.55, 0, 0.01);
  tl.to(k, { opacity: 0, y: 40, duration: 0.25 }, 15.45);
  const p = app.toStage(R.propostas, R.galpao.x, R.galpao.y);
  const p2 = app.toStage(R.propostas, R.galpao.x + R.galpao.w, R.galpao.y + R.galpao.h);
  const rg = el("div", "ring", s);
  pos(rg, p.x - 6, p.y - 4, p2.x - p.x + 12, p2.y - p.y + 8);
  tl.fromTo(rg, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.45, ease: EXPO }, 16.0);
  const tag = el("div", "chip", s, `${icon("check")} Aceita, vira projeto ${icon("arrow-right")}`);
  pos(tag, 380, 1300);
  tag.style.background = "#A4EC86";
  tag.style.color = "#1A1A1A";
  tag.querySelectorAll("svg").forEach((v) => (v.style.stroke = "#1A1A1A"));
  popIn(tag, 16.15);
}

/* 02 Projetos (17 a 20,5) */
{
  chapter(2, "folder-kanban", "Projetos", "O lucro de cada projeto,|*antes* do fim.", 17.0);
  app.show("projetos", 16.95, R.content, { fade: 0.15 });
  app.show("projeto", 17.75, R.projetoTop, { fade: 0.2 });
  app.move("projeto", 17.95, R.projetoKpi, 0.9);
  app.dim(18.6, 0.5);
  const s = overlay(17.0, 20.5);
  const from = app.toStage(R.projetoKpi, R.margem.x, R.margem.y);
  const kf = app.frame(R.projetoKpi).scale;
  const L = lift(s, "projeto", R.margem, { x: 560, y: 1130, w: 440, t: 18.6, from: { x: from.x, y: from.y, w: R.margem.w * kf } });
  const pulse = el("div", "ring", s);
  tl.set(pulse, { opacity: 0 }, 0);
  pos(pulse, 560, 1130, 440, L.h);
  pulse.style.borderColor = "#ef4444";
  tl.fromTo(pulse, { opacity: 0.9, scale: 1 }, { opacity: 0, scale: 1.25, duration: 0.9, ease: "power2.out", repeat: 1, immediateRender: false }, 19.2);
  const hrs = el("div", "card", s);
  pos(hrs, 60, 1130, 470, 230);
  hrs.innerHTML = `<div style="padding:28px 30px"><div class="label">Horas de MEP</div>
    <div style="display:flex;align-items:baseline;gap:10px;margin-top:10px"><span class="big pv" style="color:#dc2626">0%</span><span style="font:500 22px Inter;color:var(--gray-500)">do previsto</span></div>
    <div style="height:14px;border-radius:9px;background:#eee;margin-top:16px;position:relative;overflow:hidden"><div class="bar" style="position:absolute;inset:0;background:linear-gradient(90deg,#A4EC86 0 85%,#ef4444 85%);transform-origin:0 50%"></div></div></div>`;
  popIn(hrs, 18.85);
  counter(hrs.querySelector(".pv"), 18.95, 0, 117, 1.0, (v) => Math.round(v) + "%");
  tl.fromTo(hrs.querySelector(".bar"), { scaleX: 0 }, { scaleX: 1, duration: 1.0, ease: "power2.out" }, 18.95);
  tl.to(s.children, { opacity: 0, duration: 0.25 }, 20.25);
}

/* 03 Agentes (20,5 a 25,5) */
{
  chapter(3, "sparkles", "Agentes de IA", "Passou do orçamento?|O agente prepara o *aditivo*.", 20.5, 70);
  app.dim(20.45, 0, 0.2);
  app.show("pendencias", 20.45, R.pend, { fade: 0.2 });
  app.dim(21.15, 0.55);
  const s = overlay(20.5, 25.5);
  const from = app.toStage(R.pend, R.aditivo.x, R.aditivo.y);
  const kf = app.frame(R.pend).scale;
  const L = lift(s, "pendencias", R.aditivo, { x: 50, y: 1060, w: 980, t: 21.15, from: { x: from.x, y: from.y, w: R.aditivo.w * kf } });
  const k = 980 / R.aditivo.w;
  // botão Aprovar no recorte (px CSS 1168,539)
  const bx = 50 + (1168 - R.aditivo.x) * k;
  const by = 1060 + (539 - R.aditivo.y) * k;
  const steps = [
    ["sparkles", "A IA prepara"],
    ["shield-check", "O sistema confere"],
    ["check", "Você aprova"],
  ];
  steps.forEach(([ic, t], i) => {
    const c = el("div", "chip", s, `${icon(ic)}${t}`);
    pos(c, [50, 360, 715][i], 1440);
    c.style.fontSize = "25px";
    c.style.padding = "0 22px 0 16px";
    popIn(c, 22.0 + i * 0.5, { y: 30 });
    if (i === 2) {
      tl.to(c, { backgroundColor: "#A4EC86", color: "#1A1A1A", duration: 0.3 }, 24.35);
      tl.to(c.querySelector("svg"), { stroke: "#1A1A1A", duration: 0.3 }, 24.35);
    }
  });
  const cur = cursor(s);
  cur.move(23.4, bx + 4, by + 8, 0.85, { x: 760, y: 1700 });
  cur.click(24.3, bx, by);
  const ok = el("div", "", s);
  pos(ok, bx - 70, by - 30, 168, 60);
  Object.assign(ok.style, { position: "absolute", borderRadius: "999px", background: "#15803d", color: "#fff", font: "600 24px Inter", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: 0 });
  ok.innerHTML = `${icon("check", "ico i24 white")} Aprovado`;
  tl.fromTo(ok, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.35, ease: QUINT }, 24.36);
  cur.hide(25.0);
  tl.to(s.children, { opacity: 0, duration: 0.25 }, 25.25);
}

/* 04 Obra (25,5 a 29) */
{
  chapter(4, "hard-hat", "Obras", "Chuva na concretagem?|Você sabe *antes*.", 25.5);
  app.dim(25.45, 0, 0.2);
  app.show("obra", 25.45, R.obra, { fade: 0.2 });
  app.move("obra", 25.6, R.obraAlert, 0.9);
  app.dim(26.4, 0.5);
  const s = overlay(25.5, 29.0);
  const w = el("div", "card", s);
  pos(w, 50, 1080, 980, 400);
  const days = [["sun", "Ter"], ["cloud-sun", "Qua"], ["cloud", "Qui"], ["cloud-drizzle", "Sex"], ["cloud-lightning", "Sáb"], ["cloud-drizzle", "Dom"], ["sun", "Seg"]];
  w.innerHTML = `<div style="display:flex;gap:30px;padding:34px 38px 0;align-items:center">
      <div style="width:110px;height:110px;border-radius:28px;background:#fef3c7;display:grid;place-items:center">${icon("cloud-lightning", "ico i60 amber")}</div>
      <div><div class="label">Concretagem da laje · Sáb 07/11</div>
      <div style="display:flex;align-items:baseline;gap:14px;margin-top:8px"><span class="big pc" style="color:#b45309">0%</span><span style="font:500 26px Inter;color:var(--ink-800)">de trovoada com granizo</span></div></div></div>
    <div style="display:flex;justify-content:space-between;padding:30px 38px 0">${days
      .map(([ic, d], i) => `<div class="day" style="width:110px;height:130px;border-radius:18px;display:grid;justify-items:center;align-content:center;gap:10px;${i === 4 ? "background:#fff7ed;box-shadow:0 0 0 3px #f59e0b" : "background:#f7f7f7"}">${icon(ic, "ico i40" + (i === 4 ? " amber" : " gray"))}<span style="font:600 22px Inter;color:${i === 4 ? "#b45309" : "#555"}">${d}</span></div>`)
      .join("")}</div>`;
  popIn(w, 26.4);
  w.querySelectorAll(".day").forEach((d, i) => tl.fromTo(d, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: EXPO }, 26.6 + i * 0.06));
  counter(w.querySelector(".pc"), 26.6, 0, 94, 0.9, (v) => Math.round(v) + "%");
  const t2 = el("div", "chip", s, `${icon("calendar-range")} Reprogramar? Quem decide é você.`);
  pos(t2, 50, 1505);
  popIn(t2, 27.6);
  tl.to(s.children, { opacity: 0, duration: 0.25 }, 28.75);
}

/* 05 Diário (29 a 32,5) */
{
  chapter(5, "notebook-pen", "Diário de obra", "O canteiro fala.|O registro chega *pronto*.", 29.0);
  app.dim(28.95, 0, 0.2);
  app.show("diario", 28.95, R.diario, { fade: 0.2 });
  app.dim(29.5, 0.5);
  const s = overlay(29.0, 32.5);
  const v = el("div", "card dark", s);
  pos(v, 50, 1060, 980, 170);
  const bars = Array.from({ length: 18 }, (_, i) => `<i style="display:block;width:8px;border-radius:4px;background:#A4EC86;height:${18 + ((i * 37) % 50)}px;transform-origin:50% 50%"></i>`).join("");
  v.innerHTML = `<div style="display:flex;align-items:center;gap:26px;height:100%;padding:0 34px">
    <div class="mic" style="width:84px;height:84px;border-radius:50%;background:#A4EC86;display:grid;place-items:center;flex:none">${icon("mic", "ico i40 ink")}</div>
    <div><div style="font:600 30px Geist;white-space:nowrap">Jorge Matos</div><div style="font:400 23px Inter;color:rgba(255,255,255,.6);margin-top:2px">mestre de obras</div><div style="font:400 23px Inter;color:rgba(255,255,255,.6);margin-top:4px">gravando o dia · 0:14</div></div>
    <div class="wave" style="margin-left:auto;display:flex;gap:6px;align-items:center;height:80px">${bars}</div></div>`;
  popIn(v, 29.5);
  v.querySelectorAll(".wave i").forEach((b, i) => tl.fromTo(b, { scaleY: 0.3 }, { scaleY: 1, duration: 0.18 + (i % 5) * 0.03, repeat: 7, yoyo: true, ease: "sine.inOut" }, 29.6 + (i % 7) * 0.02));
  tl.fromTo(v.querySelector(".mic"), { boxShadow: "0 0 0 0 rgba(164,236,134,.6)" }, { boxShadow: "0 0 0 26px rgba(164,236,134,0)", duration: 0.9, repeat: 2, ease: "power2.out" }, 29.6);
  const L = lift(s, "diario", R.resumo, { x: 50, y: 1265, w: 980, t: 30.6 });
  tl.to(s.children, { opacity: 0, duration: 0.25 }, 32.25);
}

/* 06 Financeiro (32,5 a 36) */
{
  chapter(6, "wallet", "Financeiro", "Quanto sobrou este mês?|*Está_na_tela.*", 32.5);
  app.dim(32.45, 0, 0.2);
  app.show("financeiro", 32.45, R.fin, { fade: 0.2 });
  app.move("financeiro", 32.6, R.finKpi, 1.0);
  app.dim(33.2, 0.55);
  const s = overlay(32.5, 36.0);
  const data = [
    ["Lucro líquido", 136300, "var(--green-700)", "Margem de 62,1%"],
    ["Receitas", 219500, "var(--ink-900)", "+106% vs período anterior"],
    ["A receber", 114500, "var(--ink-900)", "3 parcelas pendentes"],
  ];
  data.forEach(([lab, v, col, sub], i) => {
    const c = el("div", "card", s);
    const big = i === 0;
    pos(c, big ? 50 : i === 1 ? 50 : 545, big ? 1060 : 1300, big ? 980 : 485, big ? 220 : 200);
    c.innerHTML = `<div style="padding:28px 34px"><div class="label">${lab}</div>
      <div class="big v" style="color:${col};margin-top:10px;font-size:${big ? 84 : 54}px">R$ 0</div>
      <div style="font:500 22px Inter;color:var(--gray-500);margin-top:4px">${sub}</div></div>`;
    popIn(c, 33.2 + i * 0.18, { sound: i ? null : "pop" });
    counter(c.querySelector(".v"), 33.3 + i * 0.18, 0, v, 1.1, brl);
    if (big) {
      const sp = el("div", "", c);
      Object.assign(sp.style, { position: "absolute", right: "34px", top: "40px", display: "flex", gap: "12px", alignItems: "flex-end", height: "140px" });
      sp.innerHTML = [40, 62, 50, 88, 74, 120].map((hh, j) => `<i style="display:block;width:30px;height:${hh}px;border-radius:8px;background:${j === 5 ? "#A4EC86" : "#e8f5e1"};transform-origin:50% 100%"></i>`).join("");
      sp.querySelectorAll("i").forEach((b, j) => tl.fromTo(b, { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: EXPO }, 33.5 + j * 0.07));
    }
  });
  tl.to(s.children, { opacity: 0, duration: 0.25 }, 35.75);
}

/* 07 Início (36 a 39) */
{
  chapter(7, "layout-dashboard", "Início", "Toda semana, o resumo|do que *importa*.", 36.0);
  app.dim(35.95, 0, 0.2);
  app.show("inicio", 35.95, R.inicio, { fade: 0.2 });
  app.dim(36.6, 0.55);
  const s = overlay(36.0, 39.0);
  const from = app.toStage(R.inicio, R.banner.x, R.banner.y);
  const kf = app.frame(R.inicio).scale;
  lift(s, "inicio", R.banner, { x: 30, y: 1060, w: 1020, t: 36.55, from: { x: from.x, y: from.y, w: R.banner.w * kf } });
  lift(s, "inicio", R.numeros, { x: 30, y: 1260, w: 1020, t: 37.2, ring: false });
  const ai = el("div", "chip", s, `${icon("sparkles")} Escrito pelo agente, número conferido`);
  pos(ai, 30, 1470);
  popIn(ai, 37.6);
  tl.to(s.children, { opacity: 0, duration: 0.25 }, 38.6);
}
// tira o último capítulo
fadeOut(lastChip, 38.65, { dur: 0.25, y: -20 });
textOut(lastHead, 38.65, { dur: 0.28 });

/* =============== 12. Tudo o que vem junto (39 a 43 s) =============== */
{
  const s = scene("grid", 39.0, 43.05);
  const h = headline(s, "Tudo isso num|sistema *só*.", { y: 270, size: 92 });
  textIn(h, 39.0);
  const mods = [
    ["users", "Leads"], ["file-text", "Propostas"], ["handshake", "Clientes"],
    ["folder-kanban", "Projetos"], ["calendar-range", "Cronograma"], ["hard-hat", "Obras"],
    ["notebook-pen", "Diário de obra"], ["wallet", "Financeiro"], ["banknote", "Folha"],
    ["chart-column", "Relatórios"], ["globe", "Portal do cliente"], ["sparkles", "Agentes de IA"],
  ];
  mods.forEach(([ic, name], i) => {
    const c = el("div", "card dark", s);
    const col = i % 3, row = Math.floor(i / 3);
    pos(c, 60 + col * 325, 600 + row * 205, 305, 185);
    c.innerHTML = `<div style="padding:28px 26px;display:grid;gap:22px">${icon(ic, "ico i40 brand")}<div style="font:600 30px Geist;letter-spacing:-.02em">${name}</div></div>`;
    popIn(c, 39.35 + i * 0.07, { y: 40, scale: 0.9, sound: i % 3 === 0 ? "tick" : null });
    tl.to(c, { boxShadow: "0 0 0 2px rgba(164,236,134,.9), 0 30px 80px -10px rgba(0,0,0,.65)", duration: 0.2, yoyo: true, repeat: 1 }, 40.6 + i * 0.06);
  });
  tl.to(s.children, { opacity: 0, y: -30, duration: 0.3, ease: "power2.in" }, 42.75);
}

/* =============== 13. Fechamento (43 a 49 s) =============== */
{
  const s = scene("end", 43.0);
  const ring = readingRing(s, { cx: 540, cy: 760, size: 1100, t0: 43.0, scale: 1.6 });
  tl.set(ring.cv, { opacity: 0.55 }, 43.0);
  const L = lockup(s, { x: 230, y: 650, w: 620 });
  L.draw(43.15);
  L.green(43.9);
  const tag = headline(s, "Gestão com *agentes_de_IA*|para escritórios de|engenharia e arquitetura.", { y: 940, size: 60, align: "center", x: 60, w: 960 });
  textIn(tag, 43.7, { stagger: 0.04 });
  const cta = el("div", "", s);
  pos(cta, 190, 1290, 700, 112);
  Object.assign(cta.style, { position: "absolute", borderRadius: "999px", background: "#A4EC86", color: "#1A1A1A", font: "600 40px Geist", letterSpacing: "-.02em", display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" });
  cta.innerHTML = `Agende uma demonstração ${icon("arrow-right", "ico i40 ink")}`;
  popIn(cta, 44.6, { y: 40 });
  const url = el("div", "", s);
  pos(url, 0, 1440, W);
  Object.assign(url.style, { position: "absolute", textAlign: "center", font: "500 34px Geist", color: "rgba(255,255,255,.7)" });
  url.textContent = "pilarsoft.com.br";
  popIn(url, 44.9, { y: 20, sound: null });
  cue("impact-soft", 43.0);
}

finalize(49.0, { brand: 6.0, flow: 10.0, grid: 39.0, end: 43.0 });
