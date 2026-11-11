// Diário por áudio: "Na tela" (9:16, 20 s, claro, só música). Território "obra e clima".
// O que a feature faz hoje (brand/messaging.md): você fala, a Pilar organiza o registro do dia;
// ele nasce interno e só vai ao cliente quando o gestor liga "Mostrar ao cliente".
import { THEME, tl, W, el, pos, icon, scene, headline, textIn, textOut, popIn, typer, lockup, background, cue, finalize, EXPO, QUINT } from "./engine.js";
import { assinatura } from "./fim-base.js";

const DUR = 16.4;
const BG = background({ glows: [[200, 300, 900, "rgba(190,235,240,.9)"], [900, 1200, 900, "rgba(164,236,134,.5)"]] });
tl.set(BG.glows, { opacity: 0.6 }, 0);

const S = scene("diario", 0, 16.4);
const h1 = headline(S, "O diário da obra ainda|está no *WhatsApp*?", { y: 200, size: 82 });
textOut(h1, 4.2);
const h2 = headline(S, "O canteiro fala.|A Pilar *organiza*.", { y: 200, size: 88 });
textIn(h2, 4.4);
textOut(h2, 11.0);
const h3 = headline(S, "Nasce interno. Vai ao|cliente quando *você* liberar.", { y: 200, size: 74 });
textIn(h3, 11.2);

// celular do canteiro (Pilar Campo)
const ph = el("div", "", S);
pos(ph, 280, 420, 520, 1050);
Object.assign(ph.style, { position: "absolute", borderRadius: "76px", background: "#111", padding: "16px", boxShadow: "0 50px 100px -30px rgba(20,40,10,.45), 0 0 0 2px #2a2a2a" });
ph.innerHTML = `<div style="position:relative;width:100%;height:100%;border-radius:62px;overflow:hidden;background:#F7F7F7;font-family:Inter;color:#1a1a1a">
  <div style="display:flex;justify-content:space-between;padding:24px 38px 0;font:600 21px Inter">9:41<span style="width:120px;height:32px;border-radius:20px;background:#111;margin-top:-6px"></span><span>5G</span></div>
  <div style="padding:28px 32px 0;font:500 20px Inter;color:#777">Obra Residência Toledo</div>
  <div style="padding:4px 32px 0;font:600 38px Geist;letter-spacing:-.02em">Diário de hoje</div>
  <div class="rec" style="position:absolute;left:0;right:0;top:230px;display:grid;justify-items:center">
    <div class="mic" style="width:160px;height:160px;border-radius:50%;background:#A4EC86;display:grid;place-items:center">${icon("mic", "ico i60 ink")}</div>
    <div class="wave" style="display:flex;gap:8px;align-items:center;height:90px;margin-top:30px">${Array.from({ length: 16 }, (_, i) => `<i style="display:block;width:10px;border-radius:5px;background:#3c3c3c;height:${18 + ((i * 37) % 50)}px"></i>`).join("")}</div>
    <div style="font:500 21px Inter;color:#777;margin-top:10px">Gravando · 0:38</div>
    <div style="margin:28px 28px 0;background:#ececec;border-radius:24px;padding:20px 24px;font:400 24px/1.4 Inter;min-height:200px;width:calc(100% - 56px)"><span class="tr"></span></div>
  </div>
  <div class="org" style="position:absolute;left:20px;right:20px;top:200px;background:#fff;border-radius:30px;box-shadow:0 0 0 1px #e8e8e8;padding:26px;opacity:0">
    <div style="display:flex;align-items:center;gap:10px"><span style="font:600 28px Geist">Resumo do dia</span>
      <span class="badge-int" style="margin-left:auto;display:inline-flex;align-items:center;gap:6px;font:600 18px Inter;color:#555;background:#f0f0f0;border-radius:999px;padding:6px 14px">${icon("lock", "ico i24")}Interno</span></div>
    ${[
      ["Avançou", "Fôrmas da laje do pavimento superior fechadas, escoramento conferido", "#166534", "#dcfce7"],
      ["Pendência", "Aço da escada não chegou", "#b45309", "#fff7ed"],
      ["Efetivo", "10 pessoas", "#3c3c3c", "#f0f0f0"],
      ["Clima", "Nublado, sem chuva", "#3c3c3c", "#f0f0f0"],
    ]
      .map(([k, v, c, bg]) => `<div class="it" style="margin-top:20px;opacity:0"><span style="font:600 17px Inter;letter-spacing:.06em;text-transform:uppercase;color:${c};background:${bg};border-radius:8px;padding:4px 10px">${k}</span><div style="font:400 24px/1.4 Inter;margin-top:8px">${v}</div></div>`)
      .join("")}
    <div class="mc" style="margin-top:24px;height:66px;border-radius:999px;border:1px solid #dcdcdc;display:flex;align-items:center;justify-content:center;gap:12px;font:500 22px Inter;position:relative;overflow:hidden">${icon("eye", "ico i24")}<span class="mct">Mostrar ao cliente</span></div>
  </div></div>`;
tl.fromTo(ph, { opacity: 0, y: 260 }, { opacity: 1, y: 0, duration: 0.9, ease: EXPO }, 0.3);
cue("whoosh", 0.3);
const mic = ph.querySelector(".mic");
tl.fromTo(mic, { boxShadow: "0 0 0 0 rgba(164,236,134,.7)" }, { boxShadow: "0 0 0 40px rgba(164,236,134,0)", duration: 0.9, repeat: 4, ease: "power2.out", immediateRender: false }, 1.0);
ph.querySelectorAll(".wave i").forEach((b, i) => tl.fromTo(b, { scaleY: 0.3 }, { scaleY: 1, duration: 0.16 + (i % 5) * 0.03, repeat: 15, yoyo: true, ease: "sine.inOut", immediateRender: false }, 1.0 + (i % 7) * 0.02));
typer(ph.querySelector(".tr"), 1.4, "Hoje a gente fechou as fôrmas da laje lá de cima e conferiu o escoramento. O aço da escada não chegou. Deu dez pessoas.", 36);
tl.to(ph.querySelector(".rec"), { opacity: 0, y: -30, duration: 0.35 }, 5.0);
const org = ph.querySelector(".org");
tl.fromTo(org, { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.6, ease: EXPO }, 5.1);
cue("lift", 5.1);
ph.querySelectorAll(".it").forEach((n, i) => {
  tl.fromTo(n, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.45, ease: EXPO }, 5.5 + i * 0.5);
  cue("tick", 5.5 + i * 0.5);
});
// liberar para o cliente
const mc = ph.querySelector(".mc");
tl.to(mc, { backgroundColor: "#15803d", color: "#fff", borderColor: "#15803d", duration: 0.3 }, 12.4);
tl.to(mc.querySelector("svg"), { color: "#fff", duration: 0.3 }, 12.4);
tl.set(mc.querySelector(".mct"), { textContent: "Liberado para o cliente" }, 12.45);
tl.to(ph.querySelector(".badge-int"), { opacity: 0, duration: 0.2 }, 12.4);
cue("click", 12.4);
const port = el("div", "chip on", S, `${icon("globe")} O cliente vê pelo portal, com link`);
pos(port, 190, 1500);
popIn(port, 13.0);

// sem cartão final (08-direcao-criativa.md): acaba no conteúdo e volta em loop
assinatura(S, 0.2);

finalize(DUR, { brand: 5.1, flow: 5.4, grid: 14.4 });
