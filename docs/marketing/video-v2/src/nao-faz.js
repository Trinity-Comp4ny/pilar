// O que a Pilar não faz (9:16, 16 s, cinematográfica). Lição da Attio: dizer o que a IA não muda.
// Fundo tinta; a cada batida, um "Não." gigante em verde e o limite logo abaixo.
import { tl, W, el, pos, scene, cue, finalize, EXPO } from "./engine.js";
import { assinatura } from "./fim-base.js";

const DUR = 12.2;
const S = scene("nao", 0, 12.2, { theme: "dark" });
S.style.background = "#0C0E0C";
const t1 = el("div", "", S);
pos(t1, 70, 230, W - 140);
Object.assign(t1.style, { position: "absolute", font: "600 64px/1.08 Geist", letterSpacing: "-.035em", color: "#fff" });
t1.innerHTML = `O que a Pilar <span style="background:#A4EC86;color:#1A1A1A;border-radius:.2em;padding:0 .14em;font-style:italic">não</span> faz.`;
const itens = [
  ["Aprovar por você.", "Ela prepara. Quem aprova é você."],
  ["Mandar nada ao cliente sem o seu ok.", "O registro nasce interno."],
  ["Inventar número.", "A conta é do sistema, não do texto da IA."],
  ["Assinar ART ou RRT.", "A responsabilidade técnica é de quem projeta."],
  ["Cobrar por usuário.", "Todo plano tem usuários ilimitados."],
];
itens.forEach(([a, b], i) => {
  const t = 1.2 + i * 2.0;
  const n = el("div", "", S);
  pos(n, 70, 560, W - 140);
  Object.assign(n.style, { position: "absolute", font: "600 300px/0.9 Geist", letterSpacing: "-.07em", color: "#A4EC86", opacity: 0 });
  n.textContent = "Não.";
  const ta = el("div", "", S);
  pos(ta, 70, 900, W - 140);
  Object.assign(ta.style, { position: "absolute", font: "600 72px/1.08 Geist", letterSpacing: "-.035em", color: "#fff", opacity: 0 });
  ta.textContent = a;
  const tb = el("div", "", S);
  pos(tb, 70, 1120, W - 140);
  Object.assign(tb.style, { position: "absolute", font: "500 40px/1.3 Inter", color: "rgba(255,255,255,.6)", opacity: 0 });
  tb.textContent = b;
  tl.fromTo(n, { opacity: 0, scale: 1.15, filter: "blur(12px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.35, ease: EXPO }, t);
  tl.fromTo(ta, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: EXPO }, t + 0.25);
  tl.fromTo(tb, { opacity: 0 }, { opacity: 1, duration: 0.4 }, t + 0.6);
  tl.set([n, ta, tb], { opacity: 0 }, t + 1.95);
  cue("thud", t);
});
const fim = el("div", "", S);
pos(fim, 70, 760, W - 140);
Object.assign(fim.style, { position: "absolute", font: "600 96px/1.04 Geist", letterSpacing: "-.045em", color: "#fff", opacity: 0 });
fim.innerHTML = `Ela prepara.<br><span style="color:#A4EC86;font-style:italic">Você decide.</span>`;
tl.fromTo(fim, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO }, 11.2);
cue("braam", 11.2);
assinatura(S, 0.2);
finalize(DUR, { style: "cinematic", hits: [11.2] });
