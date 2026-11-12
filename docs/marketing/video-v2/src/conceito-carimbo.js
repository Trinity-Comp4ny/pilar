// Conceito: o carimbo. A assinatura da marca termina numa batida de carimbo de verdade.
import { tl, W, scene, el, pos, cue, finalize } from "./engine.js";
import { assinatura } from "./fim-base.js";
import { foto, frase, entra } from "./conceito-base.js";

const DUR = 7.6;
const S = scene("carimbo", 0, DUR, { theme: "light" });
const F = foto(S, "carimbo", { dur: DUR, de: 1.04, para: 1.12, foco: [0.45, 0.55] });
const a = frase(S, "A IA prepara.", { y: 980, size: 104 });
const b = frase(S, "O sistema confere.", { y: 1100, size: 104 });
entra(a, 0.4); cue("text", 0.4);
entra(b, 1.5); cue("text", 1.5);
const st = el("div", "", S);
pos(st, 110, 1290);
Object.assign(st.style, { position: "absolute", color: "#B3261E", border: "10px solid currentColor", borderRadius: "20px", padding: "24px 46px", font: "700 96px/1 Geist", letterSpacing: "-.02em", boxShadow: "inset 0 0 0 6px #fff, inset 0 0 0 13px currentColor", opacity: 0, transformOrigin: "50% 50%" });
st.textContent = "VOCÊ APROVA.";
tl.fromTo(st, { opacity: 0, scale: 2.4, rotate: -2 }, { opacity: 0.9, scale: 1, rotate: -7, duration: 0.22, ease: "power4.in" }, 2.9);
cue("thud", 3.1); cue("shutter", 3.1);
tl.fromTo(F.box, { y: 0 }, { y: 10, duration: 0.05, yoyo: true, repeat: 3, ease: "none" }, 3.12);
assinatura(S, 0.2, { y: 160 });
finalize(DUR, { style: "foley" });
