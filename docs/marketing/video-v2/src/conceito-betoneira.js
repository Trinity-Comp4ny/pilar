// Conceito: a betoneira já saiu, a previsão dizia chuva. Relâmpago, chuva fina, a pergunta fica.
import { tl, W, H, scene, el, cue, finalize } from "./engine.js";
import { assinatura } from "./fim-base.js";
import { foto, frase, entra } from "./conceito-base.js";

const DUR = 8.4;
const S = scene("betoneira", 0, DUR, { theme: "dark" });
foto(S, "betoneira", { dur: DUR, de: 1.0, para: 1.12, foco: [0.5, 0.72] });
const rain = el("div", "", S);
Object.assign(rain.style, { position: "absolute", inset: 0 });
for (let i = 0; i < 80; i++) {
  const d = el("i", "", rain);
  const x = (i * 157) % W, len = 60 + ((i * 37) % 80);
  Object.assign(d.style, { position: "absolute", left: x + "px", top: "0px", width: "2px", height: len + "px", background: "rgba(210,225,240,.28)", borderRadius: "2px", transform: "rotate(8deg)" });
  const dur = 0.7 + ((i * 13) % 5) * 0.08;
  tl.fromTo(d, { y: -200 - ((i * 211) % 900) }, { y: H + 200, duration: dur * 1.6, ease: "none", repeat: 8, immediateRender: true }, 0);
}
const flash = el("div", "", S);
Object.assign(flash.style, { position: "absolute", inset: 0, background: "#fff", opacity: 0 });
[[2.2, 0.55], [2.38, 0.3], [6.1, 0.4]].forEach(([t, o]) => tl.fromTo(flash, { opacity: o }, { opacity: 0, duration: 0.25, immediateRender: false }, t));
cue("braam", 2.2);
const a = frase(S, "A betoneira já saiu.", { y: 230, size: 100, color: "#fff", sombra: true });
const b = frase(S, "A previsão dizia chuva.", { y: 350, size: 100, color: "rgba(255,255,255,.7)", sombra: true });
entra(a, 0.5); cue("text", 0.5);
entra(b, 2.4);
const c = frase(S, "Marque quem precisa olhar a previsão antes da próxima concretagem.", { y: 1300, size: 50, weight: 500, color: "#fff", sombra: true });
entra(c, 4.4);
assinatura(S, 0.2, { y: 1490, color: "#fff" });
finalize(DUR, { style: "cinematic", hits: [2.2] });
