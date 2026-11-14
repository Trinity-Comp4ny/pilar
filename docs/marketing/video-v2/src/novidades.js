// Novidades da semana (9:16, 14 s, groove). Série fixa de sexta (lição do Linear: changelog no
// mesmo formato toda semana). Atualize DATA e ITENS com o que mudou de verdade no produto.
import { tl, W, el, pos, icon, scene, cue, finalize, EXPO, QUINT } from "./engine.js";
import { fechamento } from "./fim-base.js";

const DATA = "14/11/2026";
const ITENS = [
  ["at-sign", "@ chega por e-mail na hora", "Marcou alguém num comentário? Ela recebe no mesmo instante."],
  ["user-plus", "Cadastrou na Equipe, já tem acesso", "O convite sai junto com o cadastro."],
  ["percent", "Produtividade em % do projeto", "A folha paga a produção como percentual do valor do projeto."],
  ["wallet", "A pagar e A receber, lado a lado", "Novas visões do financeiro, com painel lateral."],
];
const DUR = 14;
const S = scene("novidades", 0, 10.6, { theme: "dark" });
S.style.background = "radial-gradient(120% 70% at 50% 0%, #1b2219 0%, #0C0E0C 60%)";
const top = el("div", "", S);
pos(top, 70, 190, W - 140);
Object.assign(top.style, { position: "absolute", display: "flex", justifyContent: "space-between", alignItems: "center", font: "600 30px Inter", letterSpacing: ".1em", textTransform: "uppercase", color: "#A4EC86" });
top.innerHTML = `<span>Novidades da semana</span><span style="color:rgba(255,255,255,.6);letter-spacing:0">${DATA}</span>`;
const h = el("div", "", S);
pos(h, 70, 270, W - 140);
Object.assign(h.style, { position: "absolute", font: "600 92px/1.02 Geist", letterSpacing: "-.045em", color: "#fff" });
h.textContent = "O que mudou na Pilar.";
tl.fromTo([top, h], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: EXPO }, 0.05);
ITENS.forEach(([ic, a, b], i) => {
  const t = 1.2 + i * 1.9;
  const c = el("div", "", S);
  pos(c, 70, 520 + i * 250, W - 140, 220);
  Object.assign(c.style, { position: "absolute", borderRadius: "28px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", display: "flex", gap: "28px", alignItems: "flex-start", padding: "34px 36px", opacity: 0 });
  c.innerHTML = `<span style="width:76px;height:76px;border-radius:20px;background:#A4EC86;display:grid;place-items:center;flex:none">${icon(ic, "ico i40 ink")}</span>
    <span><span style="display:block;font:600 44px/1.1 Geist;letter-spacing:-.02em;color:#fff">${a}</span><span style="display:block;font:400 32px/1.35 Inter;color:rgba(255,255,255,.65);margin-top:10px">${b}</span></span>`;
  tl.fromTo(c, { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.55, ease: EXPO }, t);
  cue("pop", t);
});
fechamento(10.6, DUR, { theme: "dark", bg: "#0C0E0C" });
finalize(DUR, { brand: 1.0, flow: 1.2, grid: 9.0, end: 10.6 });
