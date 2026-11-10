// Um dia do sócio: agenda que se enche de tarefa que não é engenharia (9:16, 22 s, relógio).
// Inspiração: vídeos "POV" e "um dia na vida". Um relógio grande conta as horas; os blocos caem
// na agenda; o contador de horas de engenharia encolhe. Depois, o mesmo dia com a Pilar.
// Agenda de exemplo, marcada como exemplo.
import { tl, W, el, pos, icon, scene, headline, textIn, textOut, popIn, background, lockup, cue, finalize, EXPO, QUINT } from "./engine.js";

const DUR = 22;
const SW = 11.6;
const BG = background({ glows: [[200, 300, 900, "rgba(190,235,240,.9)"], [900, 1200, 900, "rgba(164,236,134,.5)"]] });
tl.set(BG.glows, { opacity: 0.6 }, 0);

const S = scene("dia", 0, 18.6);
const ex = el("div", "chip", S, `${icon("calendar-days")} Agenda de exemplo`);
pos(ex, 70, 150);
const h1 = headline(S, "Um dia do sócio|de um escritório de *projeto*.", { y: 240, size: 64 });
textOut(h1, 8.4);

// relógio digital grande
const clk = el("div", "", S);
pos(clk, 70, 420, 400, 120);
Object.assign(clk.style, { position: "absolute", font: "600 110px Geist", letterSpacing: "-.05em", color: "var(--fg)", fontVariantNumeric: "tabular-nums" });
clk.textContent = "08:00";
// contador de engenharia
const eng = el("div", "surf", S);
pos(eng, 520, 420, 420, 130);
eng.innerHTML = `<div style="padding:20px 26px"><div class="label">Horas de engenharia</div><div style="font:600 54px Geist;margin-top:6px"><span class="eh">10</span><span style="font:500 30px Inter;color:var(--surf-soft)"> de 10 h</span></div></div>`;
popIn(eng, 0.5, { sound: null });
const eh = eng.querySelector(".eh");

// a agenda: 10 faixas de 1 h
const AG = { x: 70, y: 580, w: 870, hh: 90 };
for (let i = 0; i < 10; i++) {
  const r = el("div", "", S);
  pos(r, AG.x, AG.y + i * AG.hh, AG.w, AG.hh);
  Object.assign(r.style, { position: "absolute", borderTop: "2px solid var(--line)", font: "500 22px Inter", color: "var(--fg-soft)", paddingTop: "6px" });
  r.textContent = String(8 + i).padStart(2, "0") + "h";
}
const bloco = (h0, dur, txt, ic, admin, t, parent = S) => {
  const b = el("div", "", parent);
  pos(b, AG.x + 90, AG.y + (h0 - 8) * AG.hh + 6, AG.w - 100, dur * AG.hh - 12);
  Object.assign(b.style, { position: "absolute", borderRadius: "16px", display: "flex", alignItems: "center", gap: "16px", padding: "0 22px", font: "600 28px Inter", background: admin ? "#FEE2E2" : "#DCFCE7", color: admin ? "#991B1B" : "#14532D", border: `2px solid ${admin ? "#FCA5A5" : "#86EFAC"}`, opacity: 0 });
  b.innerHTML = `${icon(ic, "ico i30")}<span>${txt}</span>`;
  tl.fromTo(b, { opacity: 0, y: -120, scaleY: 0.6, transformOrigin: "50% 0" }, { opacity: 1, y: 0, scaleY: 1, duration: 0.45, ease: QUINT }, t);
  cue(admin ? "thud" : "pop", t);
  return b;
};
const manha = [
  [8, 1, "Responder o grupo da obra", "message-circle", 1.2],
  [9, 1, "Atualizar a planilha de controle", "file-spreadsheet", 2.0],
  [10, 1, "Cliente ligou: como está?", "phone", 2.8],
  [11, 1, "Conferir quem pagou a parcela", "wallet", 3.6],
  [13, 2, "Redigitar a proposta no controle", "file-text", 4.6],
  [15, 1, "Montar o relatório da obra", "notebook-pen", 5.6],
  [16, 1, "Achar a versão certa do projeto", "folder-search", 6.4],
];
const blocos = manha.map(([h, d, txt, ic, t]) => bloco(h, d, txt, ic, true, t));
bloco(12, 1, "Almoço (rápido)", "utensils", false, 1.6).style.background = "#F3F4F6";
const sobrou = bloco(17, 1, "Engenharia (o que sobrou)", "ruler", false, 7.4);
// relógio e contador acompanham
[["09:00", 1.2], ["10:00", 2.0], ["11:00", 2.8], ["12:00", 3.6], ["14:00", 4.6], ["15:00", 5.6], ["16:00", 6.4], ["17:00", 7.4], ["18:00", 8.4]].forEach(([h, t]) => {
  tl.set(clk, { textContent: h }, t);
});
[[9, 1.2], [8, 2.0], [7, 2.8], [6, 3.6], [4, 4.6], [3, 5.6], [2, 6.4], [1, 7.4]].forEach(([v, t]) => tl.set(eh, { textContent: String(v) }, t));
tl.to(eh, { color: "#DC2626", duration: 0.3 }, 4.6);
const h2 = headline(S, "1 hora de engenharia.|O resto foi *administrar*.", { y: 240, size: 64 });
textIn(h2, 8.6);
textOut(h2, SW - 0.4);

// a virada: o mesmo dia com a Pilar (os blocos administrativos encolhem)
const h3 = headline(S, "O mesmo dia,|com a *Pilar*.", { y: 240, size: 84 });
textIn(h3, SW);
cue("riser", SW - 1.0, { dur: 1.0 });
tl.set(clk, { textContent: "08:00" }, SW);
blocos.forEach((b) => tl.to(b, { opacity: 0, scaleX: 0.3, duration: 0.35, ease: "power3.in" }, SW + 0.1));
tl.to(sobrou, { opacity: 0, duration: 0.3 }, SW + 0.1);
const auto = [
  [8, 0.5, "Diário chega organizado do canteiro", "mic", SW + 0.9],
  [8.5, 0.5, "Resumo da semana pronto no Início", "sparkles", SW + 1.3],
];
auto.forEach(([h, d, txt, ic, t]) => {
  const b = bloco(h, d, txt, ic, false, t);
  b.style.background = "#EFF6FF";
  b.style.borderColor = "#BFDBFE";
  b.style.color = "#1E3A8A";
  b.style.font = "600 24px Inter";
});
bloco(9, 3, "Engenharia", "ruler", false, SW + 1.8);
bloco(13, 5, "Engenharia", "ruler", false, SW + 2.3);
[["7", SW + 1.8], ["8", SW + 2.3]].forEach(([v, t]) => tl.set(eh, { textContent: v }, t));
tl.to(eh, { color: "#15803D", duration: 0.3 }, SW + 1.8);
const tag = el("div", "chip on", S, `${icon("check")} Cliente no portal · parcelas no financeiro · uma versão do projeto`);
Object.assign(tag.style, { fontSize: "22px" });
pos(tag, 70, 1490);
popIn(tag, SW + 3.2);
tl.to(S.children, { opacity: 0, duration: 0.3 }, 18.3);

const F = scene("fim", 18.6, DUR);
const L = lockup(F, { x: 210, y: 640, w: 660 });
L.draw(18.7, { guides: false });
const c = el("div", "", F);
pos(c, 230, 960, 620, 100);
Object.assign(c.style, { position: "absolute", borderRadius: "999px", background: "#1A1A1A", color: "#fff", font: "600 36px Geist", display: "flex", alignItems: "center", justifyContent: "center" });
c.textContent = "Veja os planos · link na bio";
popIn(c, 19.5, { y: 30 });

finalize(DUR, { style: "clock", hits: [SW], end: 18.6 });
