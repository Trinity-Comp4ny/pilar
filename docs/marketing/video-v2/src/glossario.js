// Glossário do escritório de projeto (9:16, 18 s, lofi). Um verbete por vez, como num dicionário:
// a palavra grande, a classe, a definição curta. Para salvar e mandar para o estagiário.
import { tl, W, el, pos, scene, cue, finalize, EXPO, background } from "./engine.js";
import { fechamento } from "./fim-base.js";

const DUR = 18;
const BG = background({ glows: [[200, 300, 900, "rgba(190,235,240,.9)"], [900, 1200, 900, "rgba(164,236,134,.5)"]] });
tl.set(BG.glows, { opacity: 0.6 }, 0);
const S = scene("glossario", 0, 14.4);
const tag = el("div", "chip", S, "Glossário do escritório de projeto");
pos(tag, 70, 200);
const V = [
  ["ART", "substantivo · engenharia", "Anotação de Responsabilidade Técnica. Registrada no CREA, diz quem responde pelo projeto."],
  ["RRT", "substantivo · arquitetura", "Registro de Responsabilidade Técnica. O equivalente da ART, registrado no CAU."],
  ["Aditivo", "substantivo · contrato", "O que muda no escopo e no valor depois do contrato assinado. Sem ele, a revisão sai de graça."],
  ["Curva S", "substantivo · cronograma", "O avanço acumulado do projeto ou da obra no tempo, planejado contra o realizado."],
  ["Margem", "substantivo · financeiro", "O que sobra do preço depois do custo e do imposto. Medida durante, não só no fim."],
];
V.forEach(([w, c, d], i) => {
  const t = 0.4 + i * 2.8;
  const box = el("div", "", S);
  pos(box, 70, 520, W - 140);
  box.style.position = "absolute";
  box.innerHTML = `<div style="font:600 190px/0.95 Geist;letter-spacing:-.06em;color:var(--fg)">${w}</div>
    <div style="font:italic 500 36px Geist;color:var(--fg-soft);margin-top:18px">${c}</div>
    <div style="height:3px;background:var(--fg);margin:34px 0;width:120px"></div>
    <div style="font:500 50px/1.3 Geist;letter-spacing:-.02em;color:var(--fg)">${d}</div>`;
  tl.fromTo(box, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO }, t);
  tl.to(box, { opacity: 0, y: -30, duration: 0.3, ease: "power2.in" }, t + 2.5);
  cue("typewriter", t + 0.2, { dur: 0.4 });
});
const num = el("div", "", S);
pos(num, 70, 1500, W - 140);
Object.assign(num.style, { position: "absolute", font: "500 30px Inter", color: "var(--fg-soft)" });
num.textContent = "Salve para mandar para o estagiário.";
fechamento(14.4, DUR);
finalize(DUR, { style: "lofi", end: 14.4 });
