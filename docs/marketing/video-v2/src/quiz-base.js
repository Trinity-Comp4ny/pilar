// Modelo do Quiz: pergunta de múltipla escolha com contagem regressiva (9:16, 15 s, trilha animada).
// Inspiração: os quizzes de Reels que pedem a resposta nos comentários. Fundo verde da marca,
// tipografia grande, uma alternativa com humor. Termina pedindo o comentário (engajamento).
import { tl, W, H, el, pos, icon, scene, popIn, lockup, cue, finalize, EXPO, QUINT } from "./engine.js";

export function quizVideo({ tag = "Teste rápido", pergunta, opcoes, explicacao, bg = "linear-gradient(165deg, #D4F7C3 0%, #A4EC86 60%, #8FD46A 100%)" }) {
const DUR = 15;
const S = scene("quiz", 0, DUR, { theme: "light" });
S.style.background = bg;
const grain = el("canvas", "", document.getElementById("stage"));
grain.id = "grain";
grain.width = W / 3;
grain.height = H / 3;

const tagq = el("div", "", S);
pos(tagq, 70, 170);
Object.assign(tagq.style, { position: "absolute", font: "600 30px Inter", letterSpacing: ".12em", textTransform: "uppercase", color: "#1A1A1A", background: "rgba(255,255,255,.6)", borderRadius: "999px", padding: "12px 26px" });
tagq.textContent = tag;

const q = el("div", "", S);
pos(q, 70, 270, 940);
Object.assign(q.style, { position: "absolute", font: "600 80px/1.05 Geist", letterSpacing: "-.04em", color: "#1A1A1A" });
q.textContent = pergunta;
tl.fromTo(q, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: EXPO }, 0.05);

const opts = opcoes;
const boxes = opts.map(([l, t, ok], i) => {
  const b = el("div", "", S);
  pos(b, 70, 700 + i * 190, 940, 160);
  Object.assign(b.style, { position: "absolute", borderRadius: "34px", background: "#fff", display: "flex", alignItems: "center", gap: "30px", padding: "0 36px", boxShadow: "0 20px 40px -24px rgba(26,40,20,.5)", opacity: 0 });
  b.innerHTML = `<span class="lt" style="width:84px;height:84px;border-radius:50%;background:#1A1A1A;color:#fff;font:600 42px Geist;display:grid;place-items:center;flex:none">${l}</span><span style="font:600 42px/1.15 Geist;letter-spacing:-.02em;color:#1A1A1A">${t}</span>`;
  tl.fromTo(b, { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 0.5, ease: EXPO }, 1.2 + i * 0.35);
  cue("pop", 1.2 + i * 0.35);
  return b;
});

// contagem regressiva em anel
const ring = el("div", "", S);
pos(ring, 420, 1300, 240, 240);
ring.style.position = "absolute";
ring.innerHTML = `<svg viewBox="0 0 100 100" style="width:100%;height:100%"><circle cx="50" cy="50" r="44" fill="rgba(255,255,255,.55)"/>
  <circle class="arc" cx="50" cy="50" r="44" fill="none" stroke="#1A1A1A" stroke-width="6" stroke-linecap="round" pathLength="1" transform="rotate(-90 50 50)"/>
  <text class="n" x="50" y="64" text-anchor="middle" font-family="Geist" font-weight="600" font-size="42" fill="#1A1A1A">3</text></svg>`;
tl.fromTo(ring, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.4, ease: QUINT }, 2.6);
const arc = ring.querySelector(".arc");
tl.set(arc, { strokeDasharray: "1 1", strokeDashoffset: 0 }, 0);
tl.to(arc, { strokeDashoffset: 1, duration: 3.0, ease: "none" }, 2.8);
const n = ring.querySelector(".n");
[["3", 2.8], ["2", 3.8], ["1", 4.8]].forEach(([v, t]) => {
  tl.set(n, { textContent: v }, t);
  cue("tick-clock", t);
});
tl.to(ring, { opacity: 0, scale: 0.8, duration: 0.25 }, 5.8);

// revelação
const REV = 6.0;
boxes.forEach((b, i) => {
  const ok = opts[i][2];
  if (ok) {
    tl.to(b, { background: "#1A1A1A", scale: 1.04, duration: 0.3, ease: QUINT }, REV);
    tl.to(b.querySelectorAll("span")[1], { color: "#fff", duration: 0.3 }, REV);
    tl.to(b.querySelector(".lt"), { background: "#A4EC86", color: "#1A1A1A", duration: 0.3 }, REV);
  } else {
    tl.to(b, { opacity: 0.4, scale: 0.97, duration: 0.3 }, REV);
  }
});
cue("ding", REV);
const exp = el("div", "", S);
pos(exp, 70, 1300, 940);
Object.assign(exp.style, { position: "absolute", font: "500 40px/1.3 Geist", letterSpacing: "-.02em", color: "#1A1A1A", opacity: 0 });
exp.innerHTML = explicacao;
tl.fromTo(exp, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO }, REV + 0.5);
tl.to([q, ...boxes, exp, tagq], { opacity: 0, duration: 0.3 }, 10.6);

// fecho: pede o comentário
const c1 = el("div", "", S);
pos(c1, 70, 560, 940);
Object.assign(c1.style, { position: "absolute", textAlign: "center", font: "600 88px/1.05 Geist", letterSpacing: "-.04em", color: "#1A1A1A", opacity: 0 });
c1.innerHTML = `Acertou?<br>Comenta a sua<br>letra.`;
tl.fromTo(c1, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO }, 10.9);
const L = lockup(S, { x: 290, y: 1010, w: 500, color: "#1A1A1A" });
L.draw(11.6, { guides: false });
const cta = el("div", "", S);
pos(cta, 230, 1250, 620, 100);
Object.assign(cta.style, { position: "absolute", borderRadius: "999px", background: "#1A1A1A", color: "#fff", font: "600 36px Geist", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0 });
cta.textContent = "Veja os planos · link na bio";
tl.fromTo(cta, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: EXPO }, 12.3);

finalize(DUR, { style: "quirky", hits: [REV], end: 12.6 });
}
