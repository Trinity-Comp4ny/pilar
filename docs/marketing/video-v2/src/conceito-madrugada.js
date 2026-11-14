// Conceito: 23h47. O relógio corre do fim do expediente até a madrugada em cima das planilhas.
import { tl, scene, el, pos, cue, finalize } from "./engine.js";
import { assinatura } from "./fim-base.js";
import { foto, frase, entra } from "./conceito-base.js";

const DUR = 9;
const S = scene("madrugada", 0, DUR, { theme: "dark" });
foto(S, "planilhas", { dur: DUR, de: 1.02, para: 1.14, foco: [0.55, 0.5], escurecer: 0.25 });
const sh = el("div", "", S);
pos(sh, 0, 0, 1080, 760);
Object.assign(sh.style, { position: "absolute", background: "linear-gradient(to bottom,rgba(8,10,8,.75),rgba(8,10,8,0))" });
const relogio = frase(S, "18h00", { y: 200, size: 230, color: "#fff", align: "right", sombra: true });
tl.set(relogio, { opacity: 1 }, 0.01);
// a hora avança em saltos: 18h00 → 23h47
const horas = ["18h00", "18h30", "19h15", "20h05", "20h40", "21h20", "22h10", "22h55", "23h30", "23h47."];
horas.forEach((hh, i) => {
  const t = 0.2 + i * 0.32;
  tl.set(relogio, { innerHTML: hh }, t);
  cue("tick-clock", t);
});
const a = frase(S, "Fechando o mês na planilha.", { y: 470, size: 60, color: "#fff", weight: 500, align: "right", sombra: true });
const b = frase(S, "De novo.", { y: 550, size: 60, color: "rgba(255,255,255,.65)", weight: 500, align: "right", sombra: true });
entra(a, 3.6); entra(b, 4.6);
const c = frase(S, "Fechar o mês não precisa virar madrugada.", { y: 1300, size: 70, color: "#fff", sombra: true });
entra(c, 6.0); cue("text", 6.0);
assinatura(S, 0.2, { y: 1520, color: "#fff" });
finalize(DUR, { style: "clock" });
