// Anatomia de um prejuízo: prancha técnica (9:16, 22 s, piano). Território "conta aberta".
// Inspiração: o croqui da marca (brand/imagery.md) e as pranchas de detalhamento. Um corte de
// edifício se desenha em traço; as cotas viram as horas que vazaram. Números de exemplo, com a
// conta conferida: orçado 420 h × R$ 95 = R$ 39.900; preço R$ 66.500 (imposto 15% e lucro 25%
// por dentro); real 550 h × R$ 95 = R$ 52.250 → lucro 66.500 − 9.975 − 52.250 = R$ 4.275.
import { tl, W, H, el, pos, icon, scene, headline, textIn, textOut, popIn, background, counter, brl, lockup, cue, finalize, EXPO } from "./engine.js";
import { assinatura } from "./fim-base.js";

const DUR = 18.6;
const INK = "#1A1A1A";
const BG = background({ glows: [[200, 300, 900, "rgba(190,235,240,.7)"], [900, 1200, 900, "rgba(164,236,134,.35)"]] });
tl.set(BG.glows, { opacity: 0.5 }, 0);

const S = scene("prancha", 0, 18.6);
// papel quadriculado de prancha
const pap = el("div", "layer", S);
pap.style.backgroundImage = "linear-gradient(rgba(26,26,26,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(26,26,26,.05) 1px, transparent 1px)";
pap.style.backgroundSize = "40px 40px";
// selo de prancha (carimbo técnico) no canto
const carimbo = el("div", "", S);
pos(carimbo, 600, 1490, 420, 120);
Object.assign(carimbo.style, { position: "absolute", border: `2px solid ${INK}`, font: "500 18px Inter", color: INK, display: "grid", gridTemplateColumns: "1fr 1fr", opacity: 0 });
carimbo.innerHTML = `<div style="grid-column:1/3;border-bottom:2px solid ${INK};padding:8px 12px;font:600 22px Geist">ANATOMIA DE UM PREJUÍZO</div>
  <div style="padding:8px 12px;border-right:2px solid ${INK}">PRANCHA 01/01</div><div style="padding:8px 12px">ESC. 1:horas</div>`;
tl.to(carimbo, { opacity: 1, duration: 0.5 }, 0.6);

const h1 = headline(S, "Anatomia de|um *prejuízo*.", { y: 150, size: 92 });

// o corte do edifício, em traço, desenhado
const svg = el("div", "", S);
pos(svg, 60, 470, 960, 900);
svg.style.position = "absolute";
const L = (d, w = 3) => `<path class="dr" pathLength="1" d="${d}" stroke="${INK}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
svg.innerHTML = `<svg viewBox="0 0 960 900" style="width:100%;height:100%;overflow:visible">
  ${L("M80 820 H880", 4)}
  ${L("M140 820 V300 M820 820 V300", 4)}
  ${L("M120 300 H840 M120 280 H840", 3)}
  ${L("M140 650 H820 M140 480 H820", 3)}
  ${[220, 380, 540, 700].map((x) => L(`M${x} 820 V300`, 1.5)).join("")}
  ${L("M100 280 L480 120 L860 280", 3)}
  ${L("M60 860 H900", 1)}
  <g class="cotas" font-family="Inter" font-size="26" fill="${INK}"></g>
</svg>`;
const paths = svg.querySelectorAll(".dr");
tl.set(paths, { strokeDasharray: "1 1", strokeDashoffset: 1 }, 0);
paths.forEach((p, i) => tl.to(p, { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut" }, 0.4 + i * 0.12));
cue("draw", 0.4);
cue("draw", 1.2);

// as cotas: uma por vazamento de horas, com linha de chamada
const cotas = [
  { y: 760, txt: "Orçado: 420 h", sub: "Proposta aceita", c: INK, t: 2.6 },
  { y: 590, txt: "+60 h", sub: "Revisão do cliente, sem aditivo", c: "#DC2626", t: 4.4 },
  { y: 420, txt: "+40 h", sub: "Compatibilização refeita", c: "#DC2626", t: 6.0 },
  { y: 240, txt: "+30 h", sub: "Versão errada, trabalho repetido", c: "#DC2626", t: 7.6 },
];
cotas.forEach(({ y, txt, sub, c, t }) => {
  const line = el("div", "", svg);
  Object.assign(line.style, { position: "absolute", left: "150px", top: y + "px", width: "0px", height: "2px", background: c });
  tl.to(line, { width: "380px", duration: 0.5, ease: "power2.out" }, t);
  const dot = el("div", "", svg);
  Object.assign(dot.style, { position: "absolute", left: "142px", top: y - 7 + "px", width: "16px", height: "16px", borderRadius: "50%", background: c, opacity: 0 });
  tl.to(dot, { opacity: 1, duration: 0.2 }, t);
  const lab = el("div", "", svg);
  Object.assign(lab.style, { position: "absolute", left: "545px", top: y - 44 + "px", background: "#fff", border: `2px solid ${c}`, borderRadius: "14px", padding: "10px 18px", opacity: 0 });
  lab.innerHTML = `<div style="font:700 40px Geist;letter-spacing:-.02em;color:${c}">${txt}</div><div style="font:500 22px Inter;color:#3c3c3c">${sub}</div>`;
  tl.fromTo(lab, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5, ease: EXPO }, t + 0.25);
  cue("typewriter", t + 0.25, { dur: 0.35 });
});

// a conta descendo
textOut(h1, 9.6);
tl.to([svg, carimbo], { opacity: 0.12, duration: 0.5 }, 9.7);
const box = el("div", "surf", S);
pos(box, 60, 560, 880, 640);
box.innerHTML = `<div style="padding:40px 44px;font-family:Inter">
  <div class="label">Exemplo · R$ 95 por hora · preço R$ 66.500</div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:30px;font:500 32px Inter"><span>Horas orçadas</span><span style="font:600 48px Geist">420 h</span></div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:18px;font:500 32px Inter;color:#DC2626"><span>Horas reais</span><span class="hr" style="font:600 48px Geist">420 h</span></div>
  <div style="height:2px;background:var(--line);margin:34px 0"></div>
  <div style="font:500 30px Inter;color:var(--surf-soft)">Lucro do projeto</div>
  <div class="lu" style="font:600 120px Geist;letter-spacing:-.04em;margin-top:6px;color:var(--green-700)">R$ 16.625</div>
  <div class="mg" style="font:600 34px Inter;color:var(--green-700)">25% do preço</div></div>`;
const h2 = headline(S, "130 horas que|ninguém *cobrou*.", { y: 230, size: 84 });
textIn(h2, 9.9);
popIn(box, 10.0, { y: 60 });
counter(box.querySelector(".hr"), 10.8, 420, 550, 1.2, (v) => Math.round(v) + " h", { ticks: false });
counter(box.querySelector(".lu"), 11.2, 16625, 4275, 1.8, brl);
counter(box.querySelector(".mg"), 11.2, 25, 6.4, 1.8, (v) => v.toFixed(1).replace(".", ",") + "% do preço");
tl.to([box.querySelector(".lu"), box.querySelector(".mg")], { color: "#DC2626", duration: 0.5 }, 12.2);
cue("thud", 13.0);
textOut(h2, 14.0);
const h3 = headline(S, "Na Pilar, a hora real|aparece *durante*.", { y: 230, size: 76 });
textIn(h3, 14.2);
const tip = el("div", "chip on", S, `${icon("file-plus")} Passou do orçado? O aditivo vem pronto.`);
pos(tip, 60, 1240);
popIn(tip, 15.0);

// sem cartão final (08-direcao-criativa.md): acaba no conteúdo e volta em loop
assinatura(S, 0.2);

finalize(DUR, { style: "piano", hits: [13.0] });
