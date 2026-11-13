// Conceito: a busca. A pessoa digita "como cobrar revisão" e o autocompletar entrega a dor.
import { tl, W, scene, el, pos, cue, typer, finalize } from "./engine.js";
import { assinatura } from "./fim-base.js";
import { frase, entra } from "./conceito-base.js";

const DUR = 9.4;
const S = scene("busca", 0, DUR, { theme: "light" });
S.style.background = "#F2F1EE";
const lupa = `<svg viewBox="0 0 24 24" width="40" fill="none" stroke="#8A8F99" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>`;
const t1 = frase(S, "O que todo escritório de projeto já pesquisou:", { y: 260, size: 76 });
entra(t1, 0.2);
const box = el("div", "", S);
pos(box, 60, 560, W - 120);
Object.assign(box.style, { position: "absolute", background: "#fff", borderRadius: "40px", boxShadow: "0 30px 70px -30px rgba(0,0,0,.3),0 0 0 2px #E4E4E4", overflow: "hidden" });
const bar = el("div", "", box);
Object.assign(bar.style, { display: "flex", alignItems: "center", gap: "24px", padding: "40px 44px", font: "500 50px Geist", borderBottom: "2px solid #EDEDED" });
bar.innerHTML = lupa;
const q = el("span", "", bar);
const caret = el("i", "", bar);
Object.assign(caret.style, { display: "inline-block", width: "4px", height: "54px", background: "#1A1A1A", marginLeft: "-18px" });
tl.fromTo(caret, { opacity: 1 }, { opacity: 0, duration: 0.45, repeat: 18, yoyo: true, ease: "steps(1)", immediateRender: true }, 0);
typer(q, 0.9, "como cobrar revisão", 14);
["de projeto", "sem perder o cliente", "que o cliente jura que é ajuste", "pela quarta vez"].forEach((s, i) => {
  const r = el("div", "", box);
  Object.assign(r.style, { display: "flex", alignItems: "center", gap: "24px", padding: "28px 44px", font: "400 44px/1.2 Geist", color: "#3D3D3D", opacity: 0 });
  r.innerHTML = `${lupa}<span>como cobrar revisão <b style="font-weight:650;color:#1A1A1A">${s}</b></span>`;
  const t = 2.5 + i * 0.55;
  tl.to(r, { opacity: 1, duration: 0.12 }, t);
  cue("tick", t);
  if (i === 3) tl.to(r, { background: "#1A1A1A", color: "#fff", duration: 0.2 }, 5.0), tl.to(r.querySelector("b"), { color: "#fff", duration: 0.2 }, 5.0), cue("click", 5.0);
});
const ans = frase(S, "Resposta curta: <b>aditivo</b>, registrado no dia em que o pedido chega.", { y: 1310, size: 54, weight: 500 });
entra(ans, 5.8);
cue("ding", 5.8);
assinatura(S, 0.2, { y: 1520 });
finalize(DUR, { style: "quirky" });
