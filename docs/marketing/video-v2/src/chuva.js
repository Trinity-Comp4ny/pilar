// Chuva: provocativo de obra e clima (9:16, 16 s, escuro, só música). Território "obra e clima".
// Só diz o que a feature faz: tarefa sensível + previsão do local = aviso com o motivo. Quem
// reprograma é o responsável (docs/marketing/01-posicionamento.md, seção 7).
import { THEME, tl, W, H, el, pos, icon, scene, headline, textIn, textOut, popIn, counter, lockup, background, cue, finalize, EXPO, QUINT } from "./engine.js";

const DUR = 16;
const BG = background({ glows: [[200, 400, 900, "rgba(120,170,200,.25)"], [900, 1400, 900, "rgba(164,236,134,.18)"]] });
tl.set(BG.glows, { opacity: 0.6 }, 0);

// chuva fina caindo atrás de tudo (some quando entra a solução)
const rain = el("div", "layer");
for (let i = 0; i < 70; i++) {
  const d = el("i", "", rain);
  const x = (i * 157) % W, len = 60 + ((i * 37) % 80);
  Object.assign(d.style, { position: "absolute", left: x + "px", top: "0px", width: "2px", height: len + "px", background: "rgba(200,220,235,.22)", borderRadius: "2px" });
  const dur = 0.7 + ((i * 13) % 5) * 0.08;
  tl.fromTo(d, { y: -200 - ((i * 211) % 900) }, { y: H + 200, duration: dur * 2.2, ease: "none", repeat: 6, immediateRender: true }, 0);
}
tl.to(rain, { opacity: 0, duration: 0.8 }, 9.6);

/* gancho, visível já no primeiro quadro */
const s1 = scene("gancho", 0, 9.8);
const h1 = headline(s1, "Quem marcou a|concretagem para o|dia da *chuva*?", { y: 260, size: 92 });
textOut(h1, 4.1);
const h2 = headline(s1, "Obra não para|por *surpresa*.", { y: 290, size: 100 });
textIn(h2, 4.3);

/* a semana da obra: o sábado é o problema */
const wk = el("div", "surf", s1);
pos(wk, 60, 720, 880, 400);
const days = [["sun", "Ter"], ["cloud-sun", "Qua"], ["cloud", "Qui"], ["cloud-drizzle", "Sex"], ["cloud-lightning", "Sáb"], ["cloud-drizzle", "Dom"], ["sun", "Seg"]];
wk.innerHTML = `<div style="padding:32px 34px 0"><div class="label">Obra Residência Toledo · semana</div>
  <div style="font:600 34px Geist;margin-top:10px">Concretagem da laje: <span style="color:#FBBF24">sábado</span></div></div>
  <div style="display:flex;justify-content:space-between;padding:30px 34px 0">${days
    .map(([ic, d], i) => `<div class="dy d${i}" style="width:104px;height:150px;border-radius:18px;background:rgba(255,255,255,.06);display:grid;justify-items:center;align-content:center;gap:12px">${icon(ic, "ico i40 " + (i === 4 ? "amber" : "gray"))}<span style="font:600 22px Inter;color:rgba(255,255,255,.7)">${d}</span>${i === 4 ? '<span class="pc" style="font:700 26px Inter;color:#FBBF24">0%</span>' : ""}</div>`)
    .join("")}</div>`;
popIn(wk, 1.4, { y: 80 });
wk.querySelectorAll(".dy").forEach((d, i) => tl.fromTo(d, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, ease: EXPO }, 1.7 + i * 0.07));
const sab = wk.querySelector(".d4");
tl.to(sab, { backgroundColor: "rgba(251,191,36,.16)", boxShadow: "0 0 0 3px #F59E0B", duration: 0.3 }, 2.8);
counter(wk.querySelector(".pc"), 2.9, 0, 94, 0.8, (v) => Math.round(v) + "%");
cue("thud", 2.9);
tl.to(wk, { opacity: 0, y: -40, duration: 0.3 }, 5.3);

/* a solução: o alerta da tela real */
// o alerta como aparece na obra (mesmo texto da tela real), grande o bastante para ler no celular
const a = el("div", "card", s1);
pos(a, 60, 640, 880, 270);
a.innerHTML = `<div style="padding:30px 34px;background:#FFFBEB;border-radius:22px;height:100%">
  <div style="display:flex;align-items:center;gap:14px;font:600 32px Inter;color:#B45309">${icon("cloud-lightning", "ico i40 amber")}Clima pode atrapalhar 2 etapas</div>
  <div style="font:400 29px/1.4 Inter;color:#1A1A1A;margin-top:16px">Concretagem da laje do pavimento superior: trovoada com granizo (94%) em 07/11. Reprograme.</div></div>`;
tl.fromTo(a, { opacity: 0, y: 60, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: EXPO }, 5.6);
cue("lift", 5.6);
const tag = el("div", "chip", s1, `${icon("calendar-range")} Tarefa sensível + previsão do local`);
pos(tag, 60, 960);
popIn(tag, 6.4);
const tag2 = el("div", "chip", s1, `${icon("bell")} Aviso antes, com o motivo`);
pos(tag2, 60, 1045);
popIn(tag2, 6.9);
const tag3 = el("div", "chip on", s1, `${icon("check")} Quem decide reprogramar é você`);
pos(tag3, 60, 1130);
popIn(tag3, 7.6);
tl.to(s1.children, { opacity: 0, duration: 0.3 }, 9.5);

/* fecho */
const s2 = scene("fim", 9.8, DUR);
const L = lockup(s2, { x: 210, y: 600, w: 660, theme: THEME });
L.draw(9.9);
const tg = headline(s2, "Gestão com *agentes_de_IA*|para escritórios de|engenharia e arquitetura.", { y: 880, size: 58, align: "center", x: 60, w: 960 });
textIn(tg, 11.0, { stagger: 0.04 });
const cta = el("div", "", s2);
pos(cta, 230, 1210, 620, 104);
Object.assign(cta.style, { position: "absolute", borderRadius: "999px", background: "#A4EC86", color: "#1A1A1A", font: "600 38px Geist", display: "flex", alignItems: "center", justifyContent: "center", gap: "14px" });
cta.innerHTML = `Veja os planos · link na bio`;
popIn(cta, 11.8, { y: 30 });

finalize(DUR, { brand: 5.6, flow: 6.0, grid: 8.0, end: 9.8 });
