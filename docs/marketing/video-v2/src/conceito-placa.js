// Conceito: a placa de obra preenchida com a verdade, linha a linha.
import { tl, scene, el, pos, cue, finalize } from "./engine.js";
import { assinatura } from "./fim-base.js";
import { foto, frase, entra } from "./conceito-base.js";

const DUR = 8.6;
const S = scene("placa", 0, DUR, { theme: "light" });
const F = foto(S, "placa", { dur: DUR, de: 1.0, para: 1.1, foco: [0.53, 0.35] });
// placa em branco da foto: x 196..848 e y 243..665 na foto 1024 × 1280; aqui a escala é 1.5 e o recorte começa em F.left
const k = F.k, x0 = F.left + 196 * k, y0 = 243 * k, w = 652 * k, h = 422 * k;
const box = el("div", "", F.box);
pos(box, x0 + 10, y0 + 10, w - 20, h - 20);
Object.assign(box.style, { position: "absolute", background: "#fff", display: "flex", flexDirection: "column", font: "500 40px Geist" });
const rows = [["PLACA DE OBRA", ""], ["Obra", "Residencial exemplo"], ["Responsável técnico", "você"], ["Responsável pela planilha", "ninguém"], ["Prazo", "perguntar no grupo"]];
rows.forEach(([kk, v], i) => {
  const r = el("div", "", box);
  if (!i) {
    Object.assign(r.style, { background: "#1A1A1A", color: "#fff", font: "700 40px Geist", letterSpacing: ".12em", padding: "26px 36px" });
    r.textContent = kk;
    return;
  }
  Object.assign(r.style, { flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", padding: "0 36px", borderTop: i > 1 ? "2px solid #D9D9D9" : "none" });
  r.innerHTML = `<span style="color:#5F6572">${kk}</span><b style="font-weight:650;letter-spacing:-.02em;opacity:0">${v}</b>`;
  const t = 0.8 + (i - 1) * 1.2;
  tl.to(r.querySelector("b"), { opacity: 1, duration: 0.05 }, t);
  cue(i === 4 ? "msg" : "typewriter", t, { dur: 0.3 });
});
const sh = el("div", "", S);
pos(sh, 0, 1100, 1080, 820);
Object.assign(sh.style, { position: "absolute", background: "linear-gradient(to top,rgba(10,12,10,.8),rgba(10,12,10,0))" });
const c = frase(S, "Toda obra tem responsável técnico. E o controle do escritório?", { y: 1250, size: 64, color: "#fff", sombra: true });
entra(c, 5.9);
assinatura(S, 0.2, { y: 1500, color: "#fff" });
finalize(DUR, { style: "quirky" });
