// Conceito: o nível. A tela inteira começa torta e se acerta; aí a frase entra.
import { tl, scene, cue, finalize } from "./engine.js";
import { assinatura } from "./fim-base.js";
import { foto, frase, entra } from "./conceito-base.js";

const DUR = 7.4;
const S = scene("nivel", 0, DUR, { theme: "light" });
const F = foto(S, "nivel", { dur: DUR, de: 1.18, para: 1.22, foco: [0.5, 0.68] });
tl.fromTo(F.img, { rotate: -5 }, { rotate: 0, duration: 1.6, ease: "elastic.out(1, 0.55)", immediateRender: true }, 0.5);
cue("whoosh", 0.5); cue("ding", 1.5);
const a = frase(S, "Projeto e caixa", { y: 330, size: 124 });
const b = frase(S, "no mesmo nível.", { y: 460, size: 124 });
entra(a, 2.0); cue("text", 2.0);
entra(b, 2.6);
const c = frase(S, "Escopo, prazo e financeiro de cada projeto na mesma tela.", { y: 1380, size: 44, weight: 500, color: "#3D3D3D" });
entra(c, 3.8);
assinatura(S, 0.2, { y: 160 });
finalize(DUR, { style: "lofi" });
