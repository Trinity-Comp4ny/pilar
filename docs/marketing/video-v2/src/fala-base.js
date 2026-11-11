// Modelo do vídeo com o fundador falando (9:16). A gravação do celular ocupa a tela; por cima,
// o título do gancho, a faixa com nome e cargo, a legenda palavra a palavra e, nas falas que pedem,
// a tela real da Pilar (a gravação vira um quadro no canto), um número ou uma lista.
// Roteiro em src/<id>.script.json; cada fala pode ter "show": { type: "tela" | "numero" | "lista" }.
// Sem a gravação, renderiza uma prévia com o quadro-guia, para revisar o formato antes de gravar.
import { tl, W, H, el, pos, icon, scene, footage, captions, lockup, cue, finalize, EXPO, QUINT } from "./engine.js";
import { assinatura } from "./fim-base.js";

const RECTS = {
  aditivo: { still: "pendencias", r: { x: 470, y: 330, w: 770, h: 300 } },
  margem: { still: "projeto", r: { x: 1010, y: 150, w: 420, h: 300 } },
  funil: { still: "leads", r: { x: 300, y: 170, w: 720, h: 520 } },
  propostas: { still: "propostas", r: { x: 310, y: 150, w: 1000, h: 420 } },
  financeiro: { still: "financeiro", r: { x: 300, y: 220, w: 1110, h: 260 } },
  inicio: { still: "inicio", r: { x: 300, y: 60, w: 880, h: 400 } },
  clima: { still: "obra", r: { x: 300, y: 110, w: 820, h: 260 } },
  diario: { still: "diario", r: { x: 480, y: 330, w: 800, h: 460 } },
  cronograma: { still: "cronograma", r: { x: 300, y: 380, w: 900, h: 520 } },
  projetos: { still: "projetos", r: { x: 290, y: 40, w: 760, h: 560 } },
};

export function falaVideo({ style = "lofi", nome = "Matheus Rezende", cargo = "Fundador da Pilar" } = {}) {
  const SC = window.SCRIPT;
  // tempos: da gravação (footage.py) ou estimados pelo tamanho do texto, na prévia
  let lines = window.TIMING?.lines;
  if (!lines) {
    let t = 0.6;
    lines = SC.lines.map((l) => {
      const d = Math.max(1.4, l.text.length / 14);
      const o = { id: l.id, text: l.text, start: +t.toFixed(2), dur: +d.toFixed(2) };
      t += d + 0.35;
      return o;
    });
  }
  const byId = Object.fromEntries(SC.lines.map((l) => [l.id, l]));
  const last = lines[lines.length - 1];
  const END = last.start + last.dur + 0.4;
  const DUR = SC.cta ? END + 3.4 : END + 0.6;

  const S = scene("fala", 0, DUR);
  S.style.background = "#111";
  const cam = footage(S, { x: 0, y: 0, w: W, h: H, id: SC.id, label: "Sua gravação aqui · olhe para a lente" });
  // escurecimento no topo e na base, para o texto ler sobre qualquer fundo
  const grad = el("div", "layer", S);
  grad.style.background = "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 55%, rgba(0,0,0,.65) 100%)";

  // gancho no topo, durante a primeira fala
  const hook = el("div", "", S);
  pos(hook, 60, 170, W - 120);
  Object.assign(hook.style, { position: "absolute", font: "600 64px/1.08 Geist", letterSpacing: "-.035em", color: "#fff", textShadow: "0 4px 24px rgba(0,0,0,.45)" });
  hook.innerHTML = SC.hook.replace(/\*(.+?)\*/g, '<span style="background:#A4EC86;color:#1A1A1A;border-radius:.22em;padding:0 .14em;font-style:italic;text-shadow:none">$1</span>');
  tl.fromTo(hook, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO }, 0.1);
  tl.to(hook, { opacity: 0, y: -20, duration: 0.3 }, lines[Math.min(1, lines.length - 1)].start + 0.4);

  // faixa com nome e cargo
  const lt = el("div", "", S);
  pos(lt, 60, 1090);
  Object.assign(lt.style, { position: "absolute", display: "flex", alignItems: "center", gap: "18px", background: "rgba(255,255,255,.94)", borderRadius: "999px", padding: "12px 30px 12px 14px", opacity: 0 });
  lt.innerHTML = `<span style="width:52px;height:52px;border-radius:50%;background:#A4EC86;display:grid;place-items:center">${icon("user-round", "ico i28 ink")}</span><span><span style="display:block;font:600 28px Geist;color:#1A1A1A">${nome}</span><span style="display:block;font:500 22px Inter;color:#555">${cargo}</span></span>`;
  tl.fromTo(lt, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.5, ease: EXPO }, 0.8);
  tl.to(lt, { opacity: 0, x: -30, duration: 0.3 }, 4.2);

  // legenda grande, branca, palavra falada em verde
  const cap = captions(S, lines, { y: 1290, max: 4 });
  cap.classList.add("cap-video");

  // o que aparece em cada fala
  for (const ln of lines) {
    const sh = byId[ln.id]?.show;
    if (!sh) continue;
    const t0 = ln.start, t1 = ln.start + ln.dur;
    if (sh.type === "tela") {
      const R = RECTS[sh.tela];
      // a gravação vira um quadro no canto; a tela ocupa o centro
      tl.to(cam, { left: 640, top: 150, width: 380, height: 560, borderRadius: 32, boxShadow: "0 30px 60px -20px rgba(0,0,0,.6)", duration: 0.5, ease: "power3.inOut" }, t0);
      tl.to(cam, { left: 0, top: 0, width: W, height: H, borderRadius: 0, duration: 0.5, ease: "power3.inOut" }, t1);
      const k = 1000 / R.r.w;
      const card = el("div", "", S);
      pos(card, 40, 760, 1000, Math.round(R.r.h * k));
      Object.assign(card.style, { position: "absolute", borderRadius: "26px", backgroundImage: `url(../stills/${R.still}.jpg)`, backgroundSize: `${1440 * k}px ${900 * k}px`, backgroundPosition: `${-R.r.x * k}px ${-R.r.y * k}px`, backgroundColor: "#fff", boxShadow: "0 0 0 1px rgba(255,255,255,.2), 0 40px 80px -20px rgba(0,0,0,.6)", opacity: 0 });
      tl.fromTo(card, { opacity: 0, y: 60, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: EXPO }, t0 + 0.15);
      tl.to(card, { opacity: 0, y: 40, duration: 0.3 }, t1 - 0.1);
      if (sh.legenda) {
        const tg = el("div", "chip on", S, `${icon("check")} ${sh.legenda}`);
        pos(tg, 40, 760 + Math.round(R.r.h * k) + 24);
        tl.fromTo(tg, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: EXPO }, t0 + 0.5);
        tl.to(tg, { opacity: 0, duration: 0.25 }, t1 - 0.1);
      }
      cue("whoosh", t0);
    } else if (sh.type === "numero") {
      const n = el("div", "", S);
      pos(n, 60, 620, W - 120);
      Object.assign(n.style, { position: "absolute", textAlign: "center", opacity: 0 });
      n.innerHTML = `<div style="font:600 220px/1 Geist;letter-spacing:-.06em;color:${sh.cor || "#A4EC86"};text-shadow:0 10px 40px rgba(0,0,0,.4)">${sh.valor}</div><div style="font:600 40px Inter;color:#fff;margin-top:14px;text-shadow:0 4px 20px rgba(0,0,0,.5)">${sh.rotulo}</div>`;
      tl.fromTo(n, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.5, ease: QUINT }, t0 + 0.1);
      tl.to(n, { opacity: 0, duration: 0.3 }, t1);
      cue("thud", t0 + 0.1);
    } else if (sh.type === "lista") {
      sh.itens.forEach((it, i) => {
        const c = el("div", "", S);
        pos(c, 60, 560 + i * 120);
        Object.assign(c.style, { position: "absolute", display: "flex", alignItems: "center", gap: "16px", background: "rgba(255,255,255,.95)", borderRadius: "999px", padding: "18px 30px 18px 18px", font: "600 34px Geist", color: "#1A1A1A", opacity: 0 });
        c.innerHTML = `<span style="width:48px;height:48px;border-radius:50%;background:${sh.cor || "#A4EC86"};display:grid;place-items:center">${icon(sh.icone || "check", "ico i28 ink")}</span>${it}`;
        const ti = t0 + 0.15 + (i * (ln.dur - 0.4)) / sh.itens.length;
        tl.fromTo(c, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.45, ease: EXPO }, ti);
        tl.to(c, { opacity: 0, duration: 0.25 }, t1);
        cue("pop", ti);
      });
    }
  }

  // fim: sem cartão por padrão (08-direcao-criativa.md); o roteiro com "cta" mantém o cartão de conversão
  if (SC.cta) {
    const veil = el("div", "layer", S);
    veil.style.background = "rgba(12,14,12,.82)";
    tl.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.5 }, END);
    tl.to(cap, { opacity: 0, duration: 0.2 }, END);
    const L = lockup(S, { x: 210, y: 720, w: 660, theme: "dark" });
    L.draw(END + 0.2, { guides: false });
    const cta = el("div", "", S);
    pos(cta, 230, 1020, 620, 100);
    Object.assign(cta.style, { position: "absolute", borderRadius: "999px", background: "#A4EC86", color: "#1A1A1A", font: "600 36px Geist", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0 });
    cta.textContent = SC.cta || "Veja os planos · link na bio";
    tl.fromTo(cta, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: EXPO }, END + 1.0);
  } else assinatura(S, 0.2, { y: 300, color: "#fff" });

  finalize(DUR, { style, end: END, voice: !!window.TIMING });
}
