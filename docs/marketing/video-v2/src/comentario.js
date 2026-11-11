// Respondendo comentário (9:16, 18 s, lofi). Formato de resposta: o comentário aparece como um
// balão de rede social (genérico), e a resposta vem com a tela e o número. Troque o comentário
// por um real, com autorização de quem escreveu.
import { tl, W, el, pos, icon, scene, headline, textIn, popIn, lift, background, cue, finalize, EXPO, QUINT } from "./engine.js";
import { assinatura } from "./fim-base.js";

const DUR = 14.4;
const BG = background({ glows: [[200, 300, 900, "rgba(190,235,240,.9)"], [900, 1200, 900, "rgba(164,236,134,.5)"]] });
tl.set(BG.glows, { opacity: 0.6 }, 0);
const S = scene("resp", 0, 14.4);
const b = el("div", "", S);
pos(b, 60, 220, 960);
Object.assign(b.style, { position: "absolute", background: "#fff", borderRadius: "34px", padding: "30px 34px", boxShadow: "0 30px 60px -30px rgba(26,40,20,.4)", display: "flex", gap: "22px" });
b.innerHTML = `<span style="width:76px;height:76px;border-radius:50%;background:#D0E3F6;display:grid;place-items:center;flex:none;font:600 30px Geist;color:#295485">RM</span>
  <span><span style="display:block;font:600 28px Inter;color:#1A1A1A">ricardo.eng.estrutural <span style="font-weight:400;color:#888">· 2 h</span></span>
  <span style="display:block;font:400 40px/1.3 Inter;color:#1A1A1A;margin-top:8px">Isso funciona para escritório pequeno? Aqui somos 4.</span></span>`;
tl.fromTo(b, { opacity: 0, y: 40, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: EXPO }, 0.1);
cue("notif", 0.2);
const r = el("div", "chip on", S, `${icon("reply")} Respondendo`);
pos(r, 60, 520);
popIn(r, 1.0);
const h = headline(S, "Funciona, e foi pensada|para *começar_pequeno*.", { y: 640, size: 70 });
textIn(h, 1.4);
const pts = [
  ["users", "Usuários ilimitados: os 4 entram, e o próximo também"],
  ["layout-dashboard", "A plataforma inteira em todo plano"],
  ["wallet", "Essencial: R$ 299/mês, até 10 projetos e 2 obras"],
];
pts.forEach(([ic, t], i) => {
  const c = el("div", "surf", S);
  pos(c, 60, 900 + i * 170, 960, 140);
  c.innerHTML = `<div style="display:flex;align-items:center;gap:24px;height:100%;padding:0 30px">${icon(ic, "ico i40 brand")}<span style="font:600 34px/1.2 Geist;letter-spacing:-.02em">${t}</span></div>`;
  popIn(c, 3.6 + i * 1.6);
});
const q = el("div", "", S);
pos(q, 60, 1430, 960);
Object.assign(q.style, { position: "absolute", font: "500 34px Inter", color: "var(--fg-soft)", opacity: 0 });
q.textContent = "Tem uma pergunta? Comenta que eu respondo em vídeo.";
tl.to(q, { opacity: 1, duration: 0.4 }, 9.6);
assinatura(S, 0.2, { y: 1520 });
finalize(DUR, { style: "lofi" });
