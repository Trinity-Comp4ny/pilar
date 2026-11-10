// Hora do sócio: conta rápida (9:16, 22 s, claro, só música). Território "conta aberta".
// A conta aparece linha a linha e o resultado vem por último, maior e em cor de status
// (brand/motion.md, "conta rápida"). Números de exemplo, marcados como exemplo.
import { THEME, tl, W, el, pos, icon, scene, headline, textIn, textOut, popIn, fadeOut, counter, brl, lockup, background, cue, finalize, EXPO, QUINT } from "./engine.js";

const DUR = 22;
const BG = background({ glows: [[200, 300, 900, "rgba(190,235,240,.9)"], [900, 1200, 900, "rgba(164,236,134,.5)"]] });
tl.set(BG.glows, { opacity: 0.6 }, 0);

const S = scene("conta", 0, 18.4);
const ex = el("div", "chip", S, `${icon("calculator")} Números de exemplo`);
pos(ex, 70, 230);

// pergunta já no primeiro quadro
const h1 = headline(S, "Quanto custa uma|*hora* do sócio?", { y: 330, size: 96 });
textOut(h1, 6.3);

const row = (parent, label, value, { big = false, color = "var(--surf-fg)" } = {}) => {
  const r = el("div", "", parent);
  Object.assign(r.style, { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "26px 0", borderBottom: "2px solid var(--line)", opacity: 0 });
  r.innerHTML = `<span style="font:500 ${big ? 34 : 30}px Inter;color:var(--surf-soft)">${label}</span><span class="v" style="font:600 ${big ? 88 : 54}px Geist;letter-spacing:-.03em;color:${color}">${value}</span>`;
  return r;
};

/* 1. a hora */
const c1 = el("div", "surf", S);
pos(c1, 60, 640, 880, 520);
c1.style.padding = "20px 40px";
const r1 = row(c1, "Retirada mensal do sócio", "R$ 0");
const r2 = row(c1, "÷ Horas produtivas no mês", "0 h");
const r3 = row(c1, "= Cada hora do sócio", "R$ 0", { big: true, color: "var(--green-700)" });
r3.style.borderBottom = "0";
popIn(c1, 1.2, { y: 80 });
[r1, r2, r3].forEach((r, i) => tl.fromTo(r, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.45, ease: EXPO }, 1.6 + i * 1.3));
counter(r1.querySelector(".v"), 1.7, 0, 24000, 0.9, brl);
counter(r2.querySelector(".v"), 3.0, 0, 140, 0.8, (v) => Math.round(v) + " h");
counter(r3.querySelector(".v"), 4.3, 0, 171, 0.9, brl);
tl.to(c1, { opacity: 0, y: -40, duration: 0.3 }, 6.2);

/* 2. o retrabalho */
const h2 = headline(S, "E quantas horas vão|para *retrabalho*?", { y: 330, size: 92 });
textIn(h2, 6.5);
textOut(h2, 12.6);
const c2 = el("div", "surf", S);
pos(c2, 60, 640, 880, 790);
c2.style.padding = "20px 40px";
const items = [
  ["Redigitar proposta na planilha", "2 h"],
  ["Cobrar e responder status", "2 h"],
  ["Montar relatório à mão", "2 h"],
];
const rs = items.map(([l, v]) => row(c2, l, v));
const tot = row(c2, "Por semana", "6 h", { big: true });
const mes = row(c2, "× 4,3 semanas × R$ 171", "R$ 0", { big: true, color: "#DC2626" });
mes.style.borderBottom = "0";
popIn(c2, 6.8, { y: 80 });
[...rs, tot].forEach((r, i) => {
  tl.fromTo(r, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4, ease: EXPO }, 7.2 + i * 0.7);
  cue("tick", 7.2 + i * 0.7);
});
tl.fromTo(mes, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.45, ease: EXPO }, 10.3);
counter(mes.querySelector(".v"), 10.4, 0, 4400, 1.0, brl);
cue("thud", 11.4);
tl.to(c2, { opacity: 0, y: -40, duration: 0.3 }, 12.5);

/* 3. a comparação */
const h3 = headline(S, "Devolver 2 horas por|semana já *paga* o sistema.", { y: 330, size: 80 });
textIn(h3, 12.8);
const c3 = el("div", "surf", S);
pos(c3, 60, 640, 880, 470);
c3.innerHTML = `<div style="padding:40px">
  <div style="display:flex;justify-content:space-between;font:500 30px Inter;color:var(--surf-soft)"><span>2 h × 4,3 × R$ 171</span><span style="font:600 44px Geist;color:var(--surf-fg)">R$ 1.470/mês</span></div>
  <div style="height:40px;border-radius:12px;background:var(--soft-fill);margin:18px 0 44px;overflow:hidden"><div class="b1" style="height:100%;width:100%;background:#A4EC86;transform-origin:0 50%"></div></div>
  <div style="display:flex;justify-content:space-between;font:500 30px Inter;color:var(--surf-soft)"><span>Plano Profissional</span><span style="font:600 44px Geist;color:var(--surf-fg)">R$ 499/mês</span></div>
  <div style="height:40px;border-radius:12px;background:var(--soft-fill);margin-top:18px;overflow:hidden"><div class="b2" style="height:100%;width:34%;background:#1A1A1A;transform-origin:0 50%"></div></div></div>`;
popIn(c3, 13.1, { y: 80 });
tl.fromTo(c3.querySelector(".b1"), { scaleX: 0 }, { scaleX: 1, duration: 1.0, ease: "power3.out" }, 13.6);
tl.fromTo(c3.querySelector(".b2"), { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "power3.out" }, 14.3);
const tip = el("div", "chip", S, `${icon("users")} Usuários ilimitados em todo plano`);
pos(tip, 60, 1150);
popIn(tip, 15.2);
tl.to(S.children, { opacity: 0, duration: 0.3 }, 18.1);

/* fecho */
const F = scene("fim", 18.4, DUR);
const L = lockup(F, { x: 210, y: 620, w: 660 });
L.draw(18.5, { guides: false });
const cta = el("div", "", F);
pos(cta, 230, 940, 620, 104);
Object.assign(cta.style, { position: "absolute", borderRadius: "999px", background: "#1A1A1A", color: "#fff", font: "600 38px Geist", display: "flex", alignItems: "center", justifyContent: "center" });
cta.textContent = "Veja os planos · link na bio";
popIn(cta, 19.3, { y: 30 });
const nt = el("div", "", F);
pos(nt, 0, 1080, W);
Object.assign(nt.style, { position: "absolute", textAlign: "center", font: "500 30px Geist", color: "var(--fg-soft)" });
nt.textContent = "Faça a conta com os números do seu escritório.";
popIn(nt, 19.6, { y: 20, sound: null });

finalize(DUR, { brand: 4.3, flow: 4.6, grid: 16.4, end: 18.4 });
