// Grupo da obra: o caos do grupo de mensagens e a calma do sistema (9:16, 20 s).
// Primeira metade só com o som das notificações acelerando (sem música); na virada entra um
// lofi calmo. Inspiração: os vídeos "POV" e de humor do dia a dia que o público reconhece.
// Interface de mensagens genérica (sem marca de aplicativo de terceiro).
import { tl, W, H, el, pos, icon, scene, headline, textIn, textOut, popIn, background, cue, finalize, EXPO, QUINT, lockup } from "./engine.js";

const DUR = 20;
const SWITCH = 9.6;
const BG = background({ glows: [[200, 300, 900, "rgba(190,235,240,.9)"], [900, 1200, 900, "rgba(164,236,134,.5)"]] });
tl.set(BG.glows, { opacity: 0.6 }, 0);

const S = scene("chat", 0, 16.4);
const h1 = headline(S, "O grupo da obra|às 7h da manhã:", { y: 150, size: 78 });
textOut(h1, SWITCH - 0.4);

// o celular, grande
const ph = el("div", "", S);
pos(ph, 150, 380, 780, 1240);
Object.assign(ph.style, { position: "absolute", borderRadius: "80px", background: "#111", padding: "18px", boxShadow: "0 50px 100px -30px rgba(20,40,10,.45)" });
ph.innerHTML = `<div class="scr" style="position:relative;width:100%;height:100%;border-radius:64px;overflow:hidden;background:#EFEAE2;font-family:Inter">
  <div style="position:absolute;left:0;right:0;top:0;height:150px;background:#F7F7F7;border-bottom:1px solid #ddd;display:flex;align-items:flex-end;padding:0 34px 22px;gap:18px;z-index:3">
    <div style="width:64px;height:64px;border-radius:50%;background:#C9D6CF;display:grid;place-items:center">${icon("hard-hat", "ico i40 gray")}</div>
    <div><div style="font:600 30px Inter;color:#1a1a1a">Obra Residência Toledo</div><div style="font:400 22px Inter;color:#777">14 participantes</div></div>
    <div class="unread" style="margin-left:auto;min-width:64px;height:48px;border-radius:999px;background:#E5484D;color:#fff;font:700 24px Inter;display:grid;place-items:center;padding:0 14px">0</div>
  </div>
  <div class="feed" style="position:absolute;left:0;right:0;bottom:0;padding:0 26px 30px;display:flex;flex-direction:column;gap:14px"></div></div>`;
popIn(ph, 0.2, { y: 200, scale: 0.95, sound: null });
const feed = ph.querySelector(".feed");
const unread = ph.querySelector(".unread");

const MSGS = [
  ["Mestre Jorge", "Bom dia. Betoneira chegou?", 0],
  ["Ana (cliente)", "Oi! Como está a obra? 😊", 1],
  ["Lucas", "Alguém tem a versão final do projeto?", 0],
  ["Mestre Jorge", "🎤 Áudio 0:47", 0, "audio"],
  ["Financeiro", "Qual era o valor da parcela 2?", 1],
  ["Lucas", "📷 Foto", 0, "photo"],
  ["Ana (cliente)", "Vai chover sábado, e a laje?", 1],
  ["Pedro", "Mandei por e-mail ontem", 0],
  ["Lucas", "Qual e-mail??", 0],
  ["Mestre Jorge", "🎤 Áudio 1:12", 0, "audio"],
  ["Ana (cliente)", "Quando termina mesmo?", 1],
  ["Financeiro", "Alguém sabe se pagaram?", 1],
  ["Lucas", "Versão R03 ou R04?", 0],
  ["Pedro", "??", 0],
];
// cada mensagem chega mais rápido que a anterior
let t = 1.0;
const times = MSGS.map((_, i) => {
  const at = t;
  t += Math.max(0.22, 0.75 * Math.pow(0.86, i));
  return at;
});
MSGS.forEach(([who, txt, side, kind], i) => {
  const m = el("div", "", feed);
  const mine = side === 1;
  Object.assign(m.style, { alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%", background: mine ? "#D9FDD3" : "#fff", borderRadius: "22px", padding: "14px 20px", boxShadow: "0 1px 1px rgba(0,0,0,.08)", display: "none" });
  m.innerHTML = `<div style="font:600 19px Inter;color:${["#C2410C", "#1D4ED8", "#7C3AED", "#047857"][i % 4]}">${who}</div>` +
    (kind === "photo"
      ? `<div style="width:300px;height:180px;border-radius:14px;background:linear-gradient(135deg,#9CA3AF,#6B7280);margin-top:8px;display:grid;place-items:center">${icon("image", "ico i60 white")}</div>`
      : kind === "audio"
        ? `<div style="display:flex;align-items:center;gap:14px;margin-top:6px;font:500 24px Inter;color:#333">${icon("play", "ico i28")}<span style="display:flex;gap:4px;align-items:center">${Array.from({ length: 18 }, (_, k) => `<i style="display:block;width:5px;border-radius:3px;background:#8a8a8a;height:${8 + ((k * 29) % 26)}px"></i>`).join("")}</span>${txt.replace("🎤 Áudio ", "")}</div>`
        : `<div style="font:400 27px/1.3 Inter;color:#1a1a1a;margin-top:4px">${txt}</div>`);
  tl.set(m, { display: "block" }, times[i]);
  tl.fromTo(m, { opacity: 0, y: 30, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: QUINT, immediateRender: false }, times[i]);
  tl.set(unread, { textContent: String(Math.min(99, (i + 1) * 7)) + (i > 12 ? "+" : "") }, times[i]);
  cue(i % 3 === 0 ? "notif" : "msg", times[i], { pan: mine ? 0.3 : -0.3 });
});
// sacudida leve do celular no auge (deslocamento, sem giro)
tl.to(ph, { x: 8, duration: 0.05, yoyo: true, repeat: 7, ease: "none" }, times[MSGS.length - 1] + 0.1);

// a virada: congela, desatura, e as mensagens viram registros
tl.to(ph.querySelector(".scr"), { filter: "grayscale(1) brightness(.92)", duration: 0.3 }, SWITCH - 0.3);
const h2 = headline(S, "Cada recado|já tem *lugar*.", { y: 150, size: 88 });
textIn(h2, SWITCH);
cue("riser", SWITCH - 1.0, { dur: 1.0 });
tl.to(ph, { opacity: 0, scale: 0.9, y: 80, duration: 0.45, ease: "power3.in" }, SWITCH + 0.5);

const dest = [
  ["notebook-pen", "Diário de obra", "Áudio do Jorge vira o registro do dia", "#F7DDBF"],
  ["file-check", "Projeto · revisão R04", "Uma versão, a certa, para todos", "#D0E3F6"],
  ["wallet", "Financeiro", "Parcela 2: R$ 35.500, vence 15/12", "#A4EC86"],
  ["globe", "Portal do cliente", "A Ana vê o andamento sem ligar", "#D0E3F6"],
  ["cloud-lightning", "Clima", "Sábado com chuva: concretagem em alerta", "#FEF3C7"],
];
dest.forEach(([ic, a, b, c], i) => {
  const d = el("div", "surf", S);
  pos(d, 70, 470 + i * 200, 860, 170);
  d.innerHTML = `<div style="display:flex;align-items:center;gap:28px;height:100%;padding:0 32px">
    <div style="width:92px;height:92px;border-radius:24px;background:${c};display:grid;place-items:center;flex:none">${icon(ic, "ico i40 ink")}</div>
    <div><div style="font:600 34px Geist;letter-spacing:-.02em">${a}</div><div class="soft" style="font:400 25px Inter;margin-top:6px">${b}</div></div></div>`;
  const tt = SWITCH + 0.95 + i * 0.32;
  tl.fromTo(d, { opacity: 0, y: -260 + i * 30, scale: 0.85 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: EXPO }, tt);
  cue("pop", tt);
});
tl.to(S.children, { opacity: 0, duration: 0.3 }, 16.1);

const F = scene("fim", 16.4, DUR);
const L = lockup(F, { x: 210, y: 640, w: 660 });
L.draw(16.5, { guides: false });
const c = el("div", "", F);
pos(c, 230, 960, 620, 100);
Object.assign(c.style, { position: "absolute", borderRadius: "999px", background: "#1A1A1A", color: "#fff", font: "600 36px Geist", display: "flex", alignItems: "center", justifyContent: "center" });
c.textContent = "Veja os planos · link na bio";
popIn(c, 17.3, { y: 30 });

finalize(DUR, { style: "lofi", start: SWITCH, end: 17.0 });
