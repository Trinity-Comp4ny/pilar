// Planos: chamada para ação curta (9:16, 10 s, verde da marca, em loop). Preço e limites de
// apps/marketing/src/lib/planos.ts (DECISOES 2026-11-06). Fundo verde cheio, como o ícone do app.
import { tl, W, H, el, pos, icon, scene, headline, textIn, textOut, popIn, lockup, cue, finalize, EXPO, QUINT } from "./engine.js";

const DUR = 10;
const S = scene("planos", 0, DUR, { theme: "light" });
S.style.background = "linear-gradient(160deg, #C9F4B6 0%, #A4EC86 55%, #93CD51 100%)";
const grain = el("canvas", "", document.getElementById("stage"));
grain.id = "grain";
grain.width = W / 3;
grain.height = H / 3;

const L = lockup(S, { x: 70, y: 210, w: 300, color: "#1A1A1A" });
L.show(0);

const h = headline(S, "Usuários ilimitados.|A plataforma inteira.|Em todo plano.", { y: 400, size: 84 });
h.querySelectorAll(".wi").forEach((w) => (w.style.color = "#1A1A1A"));
textIn(h, 0.05, { stagger: 0.05 });

const planos = [
  ["Essencial", "R$ 299", "10 projetos · 2 obras"],
  ["Profissional", "R$ 499", "30 projetos · 5 obras", true],
  ["Escala", "R$ 899", "Projetos ilimitados · 15 obras"],
];
planos.forEach(([n, p, d, dest], i) => {
  const c = el("div", "", S);
  pos(c, 70, 790 + i * 190, 860, 166);
  Object.assign(c.style, { position: "absolute", borderRadius: "28px", background: dest ? "#1A1A1A" : "rgba(255,255,255,.75)", color: dest ? "#fff" : "#1A1A1A", display: "flex", alignItems: "center", padding: "0 40px", gap: "24px", opacity: 0, boxShadow: "0 20px 40px -24px rgba(26,40,20,.45)" });
  c.innerHTML = `<div style="flex:1"><div style="font:600 40px Geist;letter-spacing:-.02em">${n}${dest ? ' <span style="font:600 20px Inter;background:#A4EC86;color:#1A1A1A;border-radius:999px;padding:6px 14px;vertical-align:middle;margin-left:8px">mais escolhido</span>' : ""}</div><div style="font:500 26px Inter;opacity:.7;margin-top:6px">${d}</div></div>
    <div style="font:600 54px Geist;letter-spacing:-.03em">${p}<span style="font:500 24px Inter;opacity:.7">/mês</span></div>`;
  popIn(c, 2.0 + i * 0.35, { y: 60, sound: i ? "tick" : "whoosh" });
});
const cta = el("div", "", S);
pos(cta, 70, 1400, 860, 112);
Object.assign(cta.style, { position: "absolute", borderRadius: "999px", background: "#1A1A1A", color: "#fff", font: "600 42px Geist", display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", opacity: 0 });
cta.innerHTML = `Veja os planos · link na bio ${icon("arrow-right", "ico i40 white")}`;
popIn(cta, 4.2, { y: 40 });
tl.fromTo(cta, { scale: 1 }, { scale: 1.03, duration: 0.45, yoyo: true, repeat: 3, ease: "sine.inOut", immediateRender: false }, 5.0);

finalize(DUR, { brand: 2.0, flow: 2.2, grid: 7.2, end: 8.2 });
