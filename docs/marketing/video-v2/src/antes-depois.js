// Antes e depois: tela dividida (9:16, 20 s, claro, só música). Território "dor nomeada".
// Cada linha: o jeito de hoje (esquerda, cinza) e o jeito com a Pilar (direita, branco).
import { THEME, tl, W, el, pos, icon, scene, headline, textIn, textOut, popIn, lockup, background, cue, finalize, EXPO, QUINT } from "./engine.js";

const DUR = 20;
const BG = background({ glows: [[200, 300, 900, "rgba(190,235,240,.9)"], [900, 1200, 900, "rgba(164,236,134,.5)"]] });
tl.set(BG.glows, { opacity: 0.6 }, 0);

const S = scene("comparacao", 0, 16.4);
const h1 = headline(S, "O mesmo escritório,|antes e depois da *Pilar*.", { y: 230, size: 76 });
textOut(h1, 14.2);

// cabeçalho das colunas
const hd = el("div", "", S);
pos(hd, 50, 470, 900, 60);
hd.style.position = "absolute";
hd.innerHTML = `<div style="display:flex;gap:20px;font:600 30px Geist;letter-spacing:-.01em">
  <div style="width:440px;display:flex;align-items:center;gap:12px;color:var(--fg-soft)"><i style="width:14px;height:14px;border-radius:50%;background:#EF4444"></i>Antes</div>
  <div style="width:440px;display:flex;align-items:center;gap:12px"><i style="width:14px;height:14px;border-radius:50%;background:#22C55E"></i>Com a Pilar</div></div>`;
popIn(hd, 0.6, { y: 20, sound: null });

const rows = [
  ["Proposta", "No Word, versão 3, por e-mail", "Aceita, vira projeto com disciplinas e parcelas"],
  ["Lucro", "Aparece quando o projeto acaba", "Na tela enquanto dá para agir"],
  ["Diário", "Foto e áudio no grupo da obra", "Falado no celular, chega organizado"],
  ["Cliente", "Liga para saber como está", "Acompanha pelo portal, com link"],
  ["Aditivo", "Montado à mão, sem base", "Chega pronto, citando as despesas"],
];
rows.forEach(([k, a, b], i) => {
  const y = 550 + i * 168;
  const t = 1.0 + i * 2.2;
  const L = el("div", "", S);
  pos(L, 50, y, 440, 148);
  Object.assign(L.style, { position: "absolute", borderRadius: "20px", background: "rgba(26,26,26,.05)", border: "2px dashed rgba(26,26,26,.15)", padding: "20px 24px", opacity: 0 });
  L.innerHTML = `<div style="font:600 18px Inter;letter-spacing:.08em;text-transform:uppercase;color:#B91C1C">${k}</div><div style="font:500 27px/1.3 Inter;color:#555;margin-top:8px;display:flex;gap:10px">${icon("x", "ico i28")}<span>${a}</span></div>`;
  const R = el("div", "surf", S);
  pos(R, 510, y, 440, 148);
  R.style.padding = "20px 24px";
  R.innerHTML = `<div style="font:600 18px Inter;letter-spacing:.08em;text-transform:uppercase;color:var(--green-700)">${k}</div><div style="font:500 27px/1.3 Inter;margin-top:8px;display:flex;gap:10px">${icon("check", "ico i28 brand")}<span>${a ? b : b}</span></div>`;
  tl.fromTo(L, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.5, ease: EXPO }, t);
  cue("pop", t);
  tl.fromTo(R, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.55, ease: EXPO }, t + 0.7);
  cue("tick", t + 0.7);
  tl.to(R, { boxShadow: "0 0 0 3px rgba(164,236,134,1), 0 18px 40px -16px rgba(26,26,26,.22)", duration: 0.25, yoyo: true, repeat: 1 }, t + 1.1);
  tl.to(L, { opacity: 0.55, duration: 0.4 }, t + 1.6);
});
const h2 = headline(S, "Um sistema *só*, do primeiro|contato à obra entregue.", { y: 230, size: 68 });
textIn(h2, 14.4);
tl.to(S.children, { opacity: 0, duration: 0.3 }, 16.1);

/* fecho */
const F = scene("fim", 16.4, DUR);
const Lk = lockup(F, { x: 210, y: 620, w: 660 });
Lk.draw(16.5, { guides: false });
const tg = headline(F, "Gestão com *agentes_de_IA*|para escritórios de|engenharia e arquitetura.", { y: 880, size: 56, align: "center", x: 60, w: 960 });
textIn(tg, 17.3, { stagger: 0.03 });
const cta = el("div", "", F);
pos(cta, 230, 1170, 620, 104);
Object.assign(cta.style, { position: "absolute", borderRadius: "999px", background: "#1A1A1A", color: "#fff", font: "600 38px Geist", display: "flex", alignItems: "center", justifyContent: "center" });
cta.textContent = "Veja os planos · link na bio";
popIn(cta, 17.9, { y: 30 });

finalize(DUR, { brand: 1.0, flow: 1.0, grid: 14.4, end: 16.4 });
