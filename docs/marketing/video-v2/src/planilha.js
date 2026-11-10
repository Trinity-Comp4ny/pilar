// Planilha: o controle em planilha desmoronando (9:16, 18 s, trilha animada + glitch).
// Inspiração: humor de escritório e o "glitch" de vídeos de produto. Interface de planilha
// genérica (sem marca de terceiro). Na virada, as células voam e viram o quadro de projetos.
import { tl, W, H, el, pos, icon, scene, headline, textIn, textOut, popIn, background, cue, finalize, EXPO, QUINT, lockup, typer } from "./engine.js";

const DUR = 18;
const SW = 10.0;
const BG = background({ glows: [[200, 300, 900, "rgba(190,235,240,.9)"], [900, 1200, 900, "rgba(164,236,134,.5)"]] });
tl.set(BG.glows, { opacity: 0.6 }, 0);

const S = scene("sheet", 0, SW + 0.2);
// a planilha ocupa a tela inteira
const sh = el("div", "", S);
pos(sh, 0, 0, W, H);
Object.assign(sh.style, { position: "absolute", background: "#fff", fontFamily: "Inter" });
const COLS = ["", "A", "B", "C", "D"];
const CW = [70, 330, 210, 230, 240];
const ROWH = 72;
const rows = [
  ["Projeto", "Contrato", "Horas", "Margem"],
  ["Retrofit Serra Verde", "158.000", "520", "-1,5%"],
  ["Clínica Pacheco", "175.000", "340", "18%"],
  ["Colégio Horizonte", "132.000", "410", "#REF!"],
  ["Galpão Anhanguera", "210.000", "#REF!", "#REF!"],
  ["Residência Toledo", "96.000", "190", "=C5/B5"],
  ["Edifício Jardins", "460.000", "#N/D", "#REF!"],
  ["TOTAL", "=SOMA(B2:B7)", "#REF!", "#REF!"],
];
sh.innerHTML = `
  <div style="height:150px;background:#F3F4F6;border-bottom:1px solid #ddd;padding:70px 30px 0;display:flex;align-items:center;gap:18px">
    ${icon("file-spreadsheet", "ico i40 gray")}<span class="fname" style="font:600 30px Inter;color:#1a1a1a">Controle_projetos.xlsx</span>
    <span class="saving" style="margin-left:auto;font:500 22px Inter;color:#888">Salvo</span></div>
  <div style="height:70px;border-bottom:1px solid #ddd;display:flex;align-items:center;padding:0 24px;gap:18px;font:500 26px 'Courier New',monospace;color:#444">
    <span style="font:italic 600 26px Inter;color:#888">fx</span><span class="fx">=C2/B2</span></div>
  <div class="grid" style="position:relative">${[COLS, ...rows.map((r, i) => [String(i + 1), ...r])]
    .map((r, ri) => `<div style="display:flex;height:${ROWH}px">${r
      .map((c, ci) => `<div class="cell c${ri}-${ci}" style="width:${CW[ci]}px;flex:none;border-right:1px solid #e3e3e3;border-bottom:1px solid #e3e3e3;display:flex;align-items:center;padding:0 14px;font:${ri === 0 || ci === 0 ? "600 22px" : ri === 1 ? "700 24px" : "400 25px"} Inter;color:${ri === 0 || ci === 0 ? "#777" : "#1a1a1a"};background:${ri === 0 || ci === 0 ? "#F3F4F6" : "#fff"};white-space:nowrap;overflow:hidden">${ri === 0 || ci === 0 || ri === 1 ? c : ""}</div>`)
      .join("")}</div>`)
    .join("")}</div>`;
// as células são digitadas; algumas quebram depois (#REF!, #N/D)
const PLAUS = { "#REF!": "18%", "#N/D": "310" };
let tt = 0.5;
rows.slice(1).forEach((r, i) => {
  r.forEach((v, j) => {
    const c = sh.querySelector(`.c${i + 2}-${j + 1}`);
    const bad = v.startsWith("#");
    c.innerHTML = `<span class="v"></span><span class="e" style="display:none;color:#DC2626;font-weight:700">${bad ? v : ""}</span>`;
    typer(c.querySelector(".v"), tt + j * 0.06, bad ? PLAUS[v] || "0" : v, 60);
    if (bad) {
      const tb = tt + 3.0 + i * 0.35;
      tl.set(c.querySelector(".v"), { display: "none" }, tb);
      tl.set(c.querySelector(".e"), { display: "inline" }, tb);
      tl.set(c, { backgroundColor: "#FEE2E2" }, tb);
      cue("error", tb);
    }
  });
  cue("type", tt, { dur: 0.25 });
  tt += 0.32;
});
// as versões se acumulam no nome do arquivo
const fname = sh.querySelector(".fname");
["Controle_projetos_v5.xlsx", "Controle_projetos_v6_rev.xlsx", "Controle_projetos_FINAL.xlsx", "Controle_projetos_FINAL_v7.xlsx", "Controle_projetos_FINAL_v7 (2).xlsx"].forEach((n, i) => {
  tl.set(fname, { textContent: n }, 2.4 + i * 0.6);
  cue("tick", 2.4 + i * 0.6);
});
// aviso de conflito
const warn = el("div", "card", S);
pos(warn, 90, 1180, 900, 220);
warn.innerHTML = `<div style="padding:30px 34px;display:flex;gap:24px;align-items:flex-start">${icon("triangle-alert", "ico i60 amber")}
  <div><div style="font:600 32px Inter">Outra pessoa está editando</div><div style="font:400 26px/1.4 Inter;color:#555;margin-top:8px">Lucas salvou uma cópia: Controle_projetos_FINAL_v7 (2) - Cópia.xlsx</div></div></div>`;
popIn(warn, 6.2, { sound: "buzz" });
// headline por cima
const h1 = headline(S, "Seu controle de|projetos, *hoje*:", { y: 950, size: 76 });
textIn(h1, 0.4);
textOut(h1, 6.0);
const h2 = headline(S, "Qual versão|é a *certa*?", { y: 950, size: 84 });
textIn(h2, 6.3);
// glitch: cópias deslocadas em vermelho e ciano, por instantes
const gl = [];
for (const [dx, col] of [[-12, "rgba(255,0,60,.35)"], [12, "rgba(0,200,255,.35)"]]) {
  const g = el("div", "layer", S);
  g.style.background = col;
  g.style.mixBlendMode = "screen";
  g.style.opacity = 0;
  gl.push([g, dx]);
}
[7.6, 8.4, 9.1, 9.6].forEach((t, k) => {
  tl.to(sh, { x: (k % 2 ? 1 : -1) * 18, skewX: (k % 2 ? 4 : -4), duration: 0.04 }, t);
  tl.to(sh, { x: 0, skewX: 0, duration: 0.04 }, t + 0.1);
  gl.forEach(([g, dx]) => {
    tl.to(g, { opacity: 1, x: dx, clipPath: `inset(${20 + k * 15}% 0 ${50 - k * 8}% 0)`, duration: 0.02 }, t);
    tl.to(g, { opacity: 0, duration: 0.02 }, t + 0.12);
  });
  cue("glitch", t, { dur: 0.15 });
});
tl.to(sh, { filter: "blur(10px)", opacity: 0, duration: 0.4, ease: "power2.in" }, SW - 0.3);
tl.to([warn, h2], { opacity: 0, duration: 0.2 }, SW - 0.3);

// a virada: o quadro de projetos, organizado
const S2 = scene("board", SW, DUR);
const h3 = headline(S2, "Uma versão.|Na tela de *todo_mundo*.", { y: 230, size: 80 });
textIn(h3, SW + 0.05);
const cols = [
  ["Planejamento", "#F59E0B", [["Galpão Anhanguera", "R$ 210 mil", "0%"]]],
  ["Em andamento", "#3B82F6", [["Edifício Jardins", "R$ 460 mil", "14%"], ["Clínica Pacheco", "R$ 175 mil", "43%"], ["Retrofit Serra Verde", "R$ 158 mil", "−1,5%"]]],
  ["Revisão", "#8B5CF6", [["Colégio Horizonte", "R$ 132 mil", "0%"]]],
];
cols.forEach(([nome, cor, cards], ci) => {
  const x = 40 + ci * 340;
  const hd = el("div", "", S2);
  pos(hd, x, 520, 320, 50);
  Object.assign(hd.style, { position: "absolute", display: "flex", alignItems: "center", gap: "10px", font: "600 26px Geist", color: "var(--fg)", opacity: 0 });
  hd.innerHTML = `<i style="width:14px;height:14px;border-radius:50%;background:${cor}"></i>${nome}`;
  tl.to(hd, { opacity: 1, duration: 0.3 }, SW + 0.4 + ci * 0.1);
  cards.forEach(([n, v, m], k) => {
    const c = el("div", "surf", S2);
    pos(c, x, 590 + k * 200, 320, 180);
    c.innerHTML = `<div style="padding:22px 24px"><div style="font:600 26px Geist;letter-spacing:-.02em;line-height:1.15">${n}</div>
      <div class="soft" style="font:500 22px Inter;margin-top:10px">${v}</div>
      <div style="font:700 26px Inter;margin-top:10px;color:${m.startsWith("−") ? "#DC2626" : "var(--green-700)"}">${m}</div></div>`;
    const tt2 = SW + 0.6 + ci * 0.15 + k * 0.12;
    tl.fromTo(c, { opacity: 0, x: (ci - 1) * 200 + 100, y: 700, rotate: (k - 1) * 5, scale: 0.6 }, { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, duration: 0.8, ease: EXPO }, tt2);
    cue("pop", tt2);
  });
});
const tag = el("div", "chip on", S2, `${icon("check")} Margem de cada projeto, sem fórmula quebrada`);
pos(tag, 40, 1250);
popIn(tag, SW + 1.8);
const L = lockup(S2, { x: 310, y: 1330, w: 460 });
L.draw(SW + 3.0, { guides: false });
const cta = el("div", "", S2);
pos(cta, 230, 1480, 620, 96);
Object.assign(cta.style, { position: "absolute", borderRadius: "999px", background: "#1A1A1A", color: "#fff", font: "600 34px Geist", display: "flex", alignItems: "center", justifyContent: "center" });
cta.textContent = "Veja os planos · link na bio";
popIn(cta, SW + 3.8, { y: 20 });

finalize(DUR, { style: "quirky", hits: [SW], end: 16.0 });
