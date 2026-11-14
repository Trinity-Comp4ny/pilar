// Contagem para o lançamento público (9:16, 12 s, cinematográfica, escuro). Troque FALTAM e rode
// de novo para cada dia: "faltam 10", "faltam 3", "é amanhã". A data vem de DECISOES (T0 = 19/01).
import { tl, W, el, pos, scene, lockup, cue, finalize, EXPO } from "./engine.js";

let FALTAM = 10;
const DUR = 12;
const S = scene("contagem", 0, DUR, { theme: "dark" });
S.style.background = "#0C0E0C";
const grid = el("div", "layer", S);
grid.style.backgroundImage = "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)";
grid.style.backgroundSize = "90px 90px";
tl.fromTo(grid, { y: 0 }, { y: 180, duration: DUR, ease: "none" }, 0);
const k = el("div", "", S);
pos(k, 0, 300, W);
Object.assign(k.style, { position: "absolute", textAlign: "center", font: "600 34px Inter", letterSpacing: ".3em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" });
k.textContent = "Faltam";
const n = el("div", "", S);
pos(n, 0, 420, W);
Object.assign(n.style, { position: "absolute", textAlign: "center", font: "600 560px/1 Geist", letterSpacing: "-.08em", color: "#fff" });
n.textContent = String(FALTAM + 3);
const d = el("div", "", S);
pos(d, 0, 1010, W);
Object.assign(d.style, { position: "absolute", textAlign: "center", font: "600 60px Geist", letterSpacing: "-.02em", color: "#A4EC86" });
d.textContent = FALTAM === 1 ? "dia" : "dias";
tl.fromTo(k, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.2);
// o número desce até o dia certo, um tique por número
[FALTAM + 2, FALTAM + 1, FALTAM].forEach((v, i) => {
  tl.set(n, { textContent: String(v) }, 0.8 + i * 0.6);
  cue("tick-clock", 0.8 + i * 0.6);
});
tl.fromTo(n, { scale: 1.1, filter: "blur(10px)" }, { scale: 1, filter: "blur(0px)", duration: 0.5, ease: EXPO, immediateRender: false }, 2.0);
tl.fromTo(d, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO }, 2.2);
cue("braam", 2.0);
const f = el("div", "", S);
pos(f, 70, 1180, W - 140);
Object.assign(f.style, { position: "absolute", textAlign: "center", font: "500 46px/1.3 Geist", color: "#fff", opacity: 0 });
f.innerHTML = `para o lançamento público da Pilar.<br><span style="color:rgba(255,255,255,.6)">19 de janeiro.</span>`;
tl.fromTo(f, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO }, 3.2);
tl.to([k, n, d, f], { opacity: 0, duration: 0.4 }, 6.6);
const L = lockup(S, { x: 210, y: 700, w: 660, theme: "dark" });
L.draw(7.0);
const s2 = el("div", "", S);
pos(s2, 70, 1000, W - 140);
Object.assign(s2.style, { position: "absolute", textAlign: "center", font: "500 40px/1.3 Geist", color: "rgba(255,255,255,.75)", opacity: 0 });
s2.textContent = "Ative o lembrete e acompanhe a contagem.";
tl.fromTo(s2, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 8.4);
finalize(DUR, { style: "cinematic", hits: [2.0, 7.0], end: 9.0 });
