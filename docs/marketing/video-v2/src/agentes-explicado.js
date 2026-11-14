// Agentes de IA, explicado: vídeo narrado (9:16). Tema claro da landing, com a marca
// num momento escuro. Todos os tempos vêm da narração (narration/<id>/timing.json):
// trocar a voz reposiciona o vídeo sozinho.
import {
  THEME, tl, W, el, pos, icon, scene, headline, textIn, textOut, popIn, fadeOut, appWindow, lift, cursor,
  typer, readingRing, mark, lockup, background, captions, cue, finalize, EXPO, QUINT,
} from "./engine.js";

const T = window.TIMING;
const L = Object.fromEntries(T.lines.map((l) => [l.id, l]));
const S = (id, f = 0) => L[id].start + L[id].dur * f; // instante a uma fração da fala
const E = (id) => L[id].start + L[id].dur;
const END = T.total;

const BG = background({
  glows: [[200, 260, 900, "rgba(190,235,240,.9)"], [900, 1150, 900, "rgba(164,236,134,.5)"]],
});
tl.fromTo(BG.glows[0], { opacity: 0.6, x: -60 }, { opacity: 0.9, x: 140, y: 160, duration: END, ease: "sine.inOut" }, 0);
tl.fromTo(BG.glows[1], { opacity: 0.4 }, { opacity: 0.7, x: -160, y: -200, duration: END, ease: "sine.inOut" }, 0);
tl.fromTo(BG.hills, { y: 60 }, { y: 0, duration: END, ease: "none" }, 0);

// legenda: sempre no mesmo lugar, acima da área que o Instagram cobre
const cap = captions(document.getElementById("stage"), T.lines, { y: 1470, max: 5 });

/* =============== 1. O trabalho que não é engenharia (l01, l02) =============== */
{
  const s = scene("tarefas", 0, S("l03") - 0.05);
  const h = headline(s, "O trabalho que|*não_é* engenharia.", { y: 250, size: 90 });
  textIn(h, 0.15);
  const tasks = [
    ["wallet", "Lançar um pagamento", "Financeiro · planilha"],
    ["file-plus", "Montar um aditivo", "Escopo · Word"],
    ["calendar-range", "Resumir a semana", "E-mail para os sócios"],
  ];
  const cards = tasks.map(([ic, t1, t2], i) => {
    const c = el("div", "surf", s);
    pos(c, 90, 620 + i * 210, 900, 170);
    c.innerHTML = `<div style="display:flex;align-items:center;gap:30px;height:100%;padding:0 36px">
      <div style="width:84px;height:84px;border-radius:22px;background:var(--soft-fill);display:grid;place-items:center;flex:none">${icon(ic, "ico i40 brand")}</div>
      <div style="flex:1"><div style="font:600 38px Geist;letter-spacing:-.02em">${t1}</div><div class="soft" style="font:400 26px Inter;margin-top:6px">${t2}</div></div>
      <div class="hr" style="font:600 24px Inter;color:#b45309;background:#fff7ed;border-radius:999px;padding:8px 18px;opacity:0;white-space:nowrap">à mão</div></div>
      <div class="strike" style="position:absolute;left:30px;right:30px;top:50%;height:4px;border-radius:4px;background:var(--red-500);transform-origin:0 50%;transform:scaleX(0)"></div>`;
    popIn(c, S("l01", [0.02, 0.36, 0.68][i]), { y: 80, sound: "whoosh" });
    tl.fromTo(c.querySelector(".hr"), { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.4, ease: EXPO }, S("l02", 0.2) + i * 0.12);
    return c;
  });
  cue("tick", S("l02", 0.2));
  // "horas do sócio": um relógio de páginas, contagem de horas na semana
  const clk = el("div", "chip", s, `${icon("clock")} Horas do sócio, toda semana`);
  pos(clk, 90, 1290);
  popIn(clk, S("l02", 0.35));
  cards.forEach((c, i) => tl.to(c.querySelector(".strike"), { scaleX: 1, duration: 0.35, ease: "power3.inOut" }, S("l02", 0.72) + i * 0.08));
  cards.forEach((c, i) => tl.to(c, { opacity: 0.45, duration: 0.3 }, S("l02", 0.8) + i * 0.08));
  cue("thud", S("l02", 0.72));
}

/* =============== 2. A marca, no escuro (l03) =============== */
{
  const t0 = S("l03") - 0.05;
  const s = scene("marca", t0, S("l04") - 0.05, { theme: "dark" });
  // a legenda acompanha o tema da cena
  tl.set(cap, { attr: { class: "cap is-dark" } }, t0);
  tl.set(cap, { attr: { class: "cap" } }, S("l04") - 0.05);
  const glow = el("div", "glow", s);
  pos(glow, 90, 300, 900, 900);
  glow.style.background = "rgba(164,236,134,.35)";
  tl.set(glow, { opacity: 0.6 }, t0);
  const Lk = lockup(s, { x: 210, y: 560, w: 660, theme: "dark" });
  Lk.draw(t0 + 0.1);
  const h = headline(s, "A Pilar faz|o *preparo*.", { y: 1000, size: 76, align: "center", x: 60, w: 960 });
  textIn(h, S("l03", 0.1));
  const h2 = el("div", "chip", s, `${icon("shield-check")} Nada vai adiante sem você`);
  pos(h2, 260, 1230);
  popIn(h2, S("l03", 0.6));
  cue("impact", t0);
}

/* =============== 3. Os três passos, no chat do agente (l04 a l08) =============== */
const STEP_T = [S("l04", 0.62), S("l07", 0.02), S("l08", 0.05)];
{
  const t0 = S("l04") - 0.05;
  const t1 = E("l08") + 0.5;
  const s = scene("passos", t0, t1);
  const steps = [
    ["1", "A IA prepara", 70, 300],
    ["2", "O sistema confere", 390, 360],
    ["3", "Você aprova", 770, 250],
  ];
  const chips = steps.map(([n, t, x, w], i) => {
    const c = el("div", "chip", s, `<span class="num">${n}</span>${t}`);
    pos(c, x, 250);
    c.style.fontSize = "27px";
    popIn(c, t0 + 0.1 + i * 0.12, { y: 30, sound: i ? null : "pop" });
    tl.to(c, { backgroundColor: "#A4EC86", color: "#1A1A1A", borderColor: "rgba(0,0,0,0)", duration: 0.35 }, STEP_T[i]);
    tl.fromTo(c, { scale: 1 }, { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out", immediateRender: false }, STEP_T[i]);
    cue("chime", STEP_T[i]);
    return c;
  });
  const h = headline(s, "Funciona em *três* passos.", { y: 360, size: 66 });
  textIn(h, t0 + 0.05);
  textOut(h, S("l05") - 0.1);

  // a janela do app com a conversa do agente (mesma cena da landing)
  const app = appWindow(s, { x: 40, y: 450, w: 1000, h: 980 });
  popIn(app.el, t0 + 0.25, { y: 120, scale: 0.94, sound: "whoosh" });
  const vp = app.el.querySelector(".vp");
  vp.innerHTML = `
    <div style="height:84px;display:flex;align-items:center;padding:0 30px;border-bottom:1px solid #e6e6e6;background:#f7f7f7;font-family:Inter">
      <div style="font:600 30px Geist;letter-spacing:-.02em;color:#1a1a1a">Agentes</div>
      <div style="margin-left:auto;display:flex;gap:10px;align-items:center;font:500 22px Inter;color:#3c3c3c">
        <span style="background:#e9e9e9;border-radius:999px;padding:8px 18px">Conversar</span><span style="padding:8px 6px">Pendências</span>
        <span style="background:#A4EC86;border-radius:999px;width:28px;height:28px;display:grid;place-items:center;font-size:16px;color:#1a1a1a">1</span></div>
    </div>
    <div class="chat" style="position:absolute;inset:84px 0 0 0;padding:34px 34px;font-family:Inter;color:#1a1a1a"></div>`;
  const chat = vp.querySelector(".chat");

  // fala do usuário, digitada no ritmo da narração
  const bub = el("div", "", chat);
  Object.assign(bub.style, { marginLeft: "auto", maxWidth: "720px", background: "#e9e9e9", borderRadius: "22px", padding: "20px 26px", font: "500 27px/1.35 Inter", opacity: 0, height: "114px" });
  const bubT = el("span", "", bub);
  const pedido = "Recebi 128 mil do centro cirúrgico, primeira de três parcelas";
  const tType = S("l05", 0.3);
  tl.to(bub, { opacity: 1, duration: 0.2 }, tType - 0.15);
  typer(bubT, tType, pedido, pedido.length / (L.l05.dur * 0.66));

  // o agente pensa e responde
  const think = el("div", "", chat);
  Object.assign(think.style, { display: "flex", gap: "10px", margin: "30px 0 0 6px", opacity: 0 });
  think.innerHTML = [0, 1, 2].map(() => `<i style="display:block;width:14px;height:14px;border-radius:50%;background:#9a9a9a"></i>`).join("");
  const tReply = S("l06", 0.2);
  tl.to(think, { opacity: 1, duration: 0.15 }, S("l06") - 0.1);
  think.querySelectorAll("i").forEach((d, i) => tl.fromTo(d, { y: 0 }, { y: -8, duration: 0.25, yoyo: true, repeat: 3, ease: "sine.inOut", immediateRender: false }, S("l06") - 0.1 + i * 0.1));
  tl.set(think, { display: "none" }, tReply);
  const msg = el("div", "", chat);
  Object.assign(msg.style, { font: "400 27px/1.4 Inter", margin: "30px 0 22px 4px", height: "76px", display: "flex", gap: "12px", alignItems: "flex-start" });
  msg.innerHTML = `<span style="opacity:0" class="spk">${icon("sparkles", "ico i30 brand")}</span><span class="mt"></span>`;
  tl.to(msg.querySelector(".spk"), { opacity: 1, duration: 0.2 }, tReply);
  typer(msg.querySelector(".mt"), tReply + 0.05, "Achei o projeto e montei o lançamento. Confere antes de eu gravar:", 48);

  const card = el("div", "", chat);
  Object.assign(card.style, { border: "1px solid #e3e3e3", background: "#fafafa", borderRadius: "22px", padding: "26px 28px", opacity: 0 });
  const rows = [
    ["Projeto", "Climatização, centro cirúrgico", "pelo nome"],
    ["Categoria", "Receita de projeto", "plano de contas"],
    ["Valor", "R$ 128.400,00", "do contrato"],
    ["Parcela", "1 de 3, vence 18/09", "calculada"],
  ];
  card.innerHTML = `<div style="font:500 19px Inter;letter-spacing:.08em;color:#7a7a7a;text-transform:uppercase;margin-bottom:12px">Receita · aguardando aprovação</div>
    ${rows
      .map(([k, v, n]) => `<div class="row" style="display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid #ececec;font:400 26px Inter;opacity:0">
        <span style="color:#6b6b6b">${k}</span>
        <span class="ok" style="opacity:0;display:inline-flex;align-items:center;gap:6px;font:600 18px Inter;color:#166534;background:#dcfce7;border-radius:999px;padding:4px 12px">${icon("check", "ico i24")}${n}</span>
        <span style="margin-left:auto;font-weight:500">${v}</span></div>`)
      .join("")}
    <div style="display:flex;gap:14px;margin-top:24px">
      <div class="conf" style="flex:1;height:72px;border-radius:999px;background:#A4EC86;display:grid;place-items:center;font:600 28px Inter;position:relative">Confirmar</div>
      <div style="width:150px;height:72px;border-radius:999px;border:1px solid #dcdcdc;display:grid;place-items:center;font:500 26px Inter;color:#555">Editar</div>
    </div>`;
  const tCard = S("l06", 0.55);
  tl.fromTo(card, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO }, tCard);
  cue("lift", tCard);
  card.querySelectorAll(".row").forEach((r, i) => tl.fromTo(r, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.4, ease: EXPO }, tCard + 0.15 + i * 0.12));

  // o sistema confere: um selo por campo, no momento em que a voz cita
  const okAt = [S("l07", 0.36), S("l07", 0.9), S("l07", 0.66), S("l07", 0.6)];
  card.querySelectorAll(".ok").forEach((o, i) => {
    tl.fromTo(o, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.35, ease: QUINT }, okAt[i]);
    cue("tick", okAt[i]);
  });

  // você aprova
  const conf = card.querySelector(".conf");
  const cur = cursor(s);
  // posição real do botão (sem transformações), medida com as fontes carregadas
  await document.fonts.ready;
  let bx = conf.offsetWidth / 2, by = conf.offsetHeight / 2;
  for (let n = conf; n && n.id !== "stage"; n = n.offsetParent) {
    bx += n.offsetLeft;
    by += n.offsetTop;
  }
  const tClick = S("l08", 0.36);
  cur.move(tClick - 0.85, bx, by, 0.75, { x: 820, y: 1700 });
  cur.click(tClick, bx - 4, by - 6);
  tl.to(conf, { backgroundColor: "#15803d", color: "#fff", duration: 0.25 }, tClick + 0.05);
  tl.call(() => {}, [], tClick);
  const confText = el("div", "", conf);
  Object.assign(confText.style, { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "#15803d", color: "#fff", borderRadius: "999px", opacity: 0 });
  confText.innerHTML = `${icon("check", "ico i30 white")} Lançado no financeiro`;
  tl.to(confText, { opacity: 1, duration: 0.25 }, tClick + 0.08);
  cur.hide(tClick + 0.9);
  const toast = el("div", "surf", s);
  pos(toast, 140, 1300, 800, 110);
  toast.innerHTML = `<div style="display:flex;align-items:center;gap:20px;height:100%;padding:0 30px">${icon("wallet", "ico i40 brand")}
    <div><div style="font:600 28px Geist">A receber · Centro cirúrgico</div><div class="soft" style="font:400 22px Inter">Parcela 1 de 3 · R$ 128.400,00 · 18/09</div></div></div>`;
  popIn(toast, tClick + 0.5);
}

/* =============== 4. O aditivo (l09) =============== */
{
  const t0 = S("l09") - 0.05;
  const s = scene("aditivo", t0, E("l09") + 0.4);
  const c = el("div", "chip", s, `${icon("file-plus")} Aditivo`);
  pos(c, 70, 250);
  popIn(c, t0, { y: 20, sound: null });
  const h = headline(s, "Passou do orçamento?|O aditivo vem *pronto*.", { y: 340, size: 72 });
  textIn(h, t0 + 0.05);
  const app = appWindow(s, { x: 40, y: 600, w: 1000, h: 640 });
  popIn(app.el, t0 + 0.1, { y: 100, scale: 0.95, sound: "whoosh" });
  const R = { pend: { x: 470, y: 330, w: 770, h: 300 }, ad: { x: 488, y: 365, w: 738, h: 212 } };
  app.show("pendencias", t0 + 0.1, R.pend, { fade: 0.01 });
  app.dim(S("l09", 0.45), 0.5);
  const from = app.toStage(R.pend, R.ad.x, R.ad.y);
  const kf = app.frame(R.pend).scale;
  // o lift é posicionado relativo ao palco: a janela entra subindo, então ele vem depois
  lift(s, "pendencias", R.ad, { x: 30, y: 960, w: 1020, t: S("l09", 0.45), from: { x: from.x, y: from.y, w: R.ad.w * kf } });
  const tag = el("div", "chip on", s, `${icon("receipt")} Cita as despesas de cada valor`);
  pos(tag, 70, 1290);
  popIn(tag, S("l09", 0.8));
}

/* =============== 5. O resumo da semana (l10) =============== */
{
  const t0 = S("l10") - 0.05;
  const s = scene("resumo", t0, E("l10") + 0.35);
  const c = el("div", "chip", s, `${icon("layout-dashboard")} Início`);
  pos(c, 70, 250);
  popIn(c, t0, { y: 20, sound: null });
  const h = headline(s, "Toda semana, o resumo|chega *pronto*.", { y: 340, size: 72 });
  textIn(h, t0 + 0.05);
  const app = appWindow(s, { x: 40, y: 600, w: 1000, h: 640 });
  popIn(app.el, t0 + 0.05, { y: 100, scale: 0.95, sound: "whoosh" });
  const R = { ini: { x: 300, y: 50, w: 1110, h: 640 }, ban: { x: 312, y: 75, w: 1090, h: 178 } };
  app.show("inicio", t0 + 0.05, R.ini, { fade: 0.01 });
  app.dim(S("l10", 0.35), 0.5);
  const from = app.toStage(R.ini, R.ban.x, R.ban.y);
  const kf = app.frame(R.ini).scale;
  lift(s, "inicio", R.ban, { x: 20, y: 980, w: 1040, t: S("l10", 0.35), from: { x: from.x, y: from.y, w: R.ban.w * kf } });
  const tag = el("div", "chip on", s, `${icon("shield-check")} Cada número conferido`);
  pos(tag, 70, 1290);
  popIn(tag, S("l10", 0.7));
}

/* =============== 6. Fechamento (l11) =============== */
{
  const t0 = S("l11") - 0.1;
  const s = scene("fim", t0);
  const Lk = lockup(s, { x: 210, y: 440, w: 660 });
  Lk.draw(t0 + 0.05, { guides: false });
  const lines = ["A IA prepara.", "O sistema confere.", "Você aprova."];
  lines.forEach((t, i) => {
    const h = headline(s, i === 2 ? "*Você* aprova." : t, { y: 740 + i * 100, size: 72, align: "center", x: 60, w: 960 });
    textIn(h, S("l11", [0.22, 0.5, 0.78][i]), { sound: false });
  });
  const cta = el("div", "", s);
  pos(cta, 190, 1100, 700, 108);
  Object.assign(cta.style, { position: "absolute", borderRadius: "999px", background: "#A4EC86", color: "#1A1A1A", font: "600 38px Geist", letterSpacing: "-.02em", display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" });
  cta.innerHTML = `Agende uma demonstração ${icon("arrow-right", "ico i40 ink")}`;
  popIn(cta, E("l11") + 0.15, { y: 40 });
  const url = el("div", "", s);
  pos(url, 0, 1240, W);
  Object.assign(url.style, { position: "absolute", textAlign: "center", font: "500 34px Geist", color: "var(--fg-soft)" });
  url.textContent = "pilarsoft.com.br";
  popIn(url, E("l11") + 0.35, { y: 20, sound: null });
  cue("impact-soft", t0);
}

finalize(END, { style: "bed", brand: [S("l03") - 0.05], steps: STEP_T, end: S("l11") - 0.1, voice: true });
