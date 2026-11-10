// Mito × fato (9:16, 18 s, animada). Cartões que viram: o mito no escuro, riscado, e o fato no
// claro. Inspiração: formatos de "verdade ou mentira" que pedem a opinião nos comentários.
import { tl, W, el, pos, scene, cue, finalize, EXPO, QUINT } from "./engine.js";
import { fechamento } from "./fim-base.js";

const DUR = 18;
const S = scene("mf", 0, 14.4, { theme: "light" });
S.style.background = "#F7F7F7";
const tg = el("div", "", S);
pos(tg, 70, 190, W - 140);
Object.assign(tg.style, { position: "absolute", font: "600 76px/1.05 Geist", letterSpacing: "-.04em", color: "#1A1A1A" });
tg.innerHTML = `IA no escritório:<br><span style="background:#A4EC86;border-radius:.2em;padding:0 .14em;font-style:italic">mito</span> ou fato?`;
const M = [
  ["A IA vai decidir pelo engenheiro.", "A IA prepara. Você aprova. Nada grava sem o seu ok."],
  ["A IA inventa número.", "A conta é do sistema. Valor e parcela são conferidos."],
  ["IA é coisa de escritório grande.", "Usuários ilimitados, a partir de R$ 299 por mês."],
];
M.forEach(([m, f], i) => {
  const t = 1.0 + i * 4.3;
  const card = el("div", "", S);
  pos(card, 70, 520, W - 140, 760);
  Object.assign(card.style, { position: "absolute", perspective: "2000px", opacity: 0 });
  card.innerHTML = `<div class="in" style="position:absolute;inset:0;transform-style:preserve-3d">
    <div style="position:absolute;inset:0;backface-visibility:hidden;border-radius:40px;background:#1A1A1A;padding:60px;display:flex;flex-direction:column;justify-content:center;gap:30px">
      <span style="font:600 34px Inter;letter-spacing:.14em;color:#F87171">✕ MITO</span>
      <span style="font:600 76px/1.08 Geist;letter-spacing:-.035em;color:#fff">${m}</span></div>
    <div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);border-radius:40px;background:#fff;box-shadow:0 0 0 2px #E2E2E2,0 40px 80px -40px rgba(0,0,0,.35);padding:60px;display:flex;flex-direction:column;justify-content:center;gap:30px">
      <span style="font:600 34px Inter;letter-spacing:.14em;color:#15803D">✓ FATO</span>
      <span style="font:600 76px/1.08 Geist;letter-spacing:-.035em;color:#1A1A1A">${f}</span></div></div>`;
  tl.fromTo(card, { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO }, t);
  cue("pop", t);
  tl.to(card.querySelector(".in"), { rotateY: 180, duration: 0.7, ease: "power3.inOut" }, t + 1.8);
  cue("whoosh", t + 1.8);
  cue("ding", t + 2.3);
  tl.to(card, { opacity: 0, y: -40, duration: 0.3 }, t + 4.0);
});
fechamento(14.4, DUR);
finalize(DUR, { style: "quirky", end: 14.4 });
