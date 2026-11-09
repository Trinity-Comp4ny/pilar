// Motor de composição dos vídeos da Pilar.
// Tudo é função do tempo: window.__seek(t) deixa o quadro pronto para captura.
// GSAP faz as entradas; contadores, anel e grão são pintados aqui, sem estado entre quadros.

const STAGE = document.getElementById("stage");
export const W = +STAGE.dataset.w;
export const H = +STAGE.dataset.h;
STAGE.style.width = W + "px";
STAGE.style.height = H + "px";

export const tl = gsap.timeline({ paused: true });
export const EXPO = "expo.out";
export const QUINT = "power4.out";
export const IO = "power2.inOut";

/* ---------- utilidades de DOM ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const el = (tag, cls, parent, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  (parent || STAGE).appendChild(n);
  return n;
};
export const pos = (n, x, y, w, h) => {
  Object.assign(n.style, { left: x + "px", top: y + "px" });
  if (w != null) n.style.width = w + "px";
  if (h != null) n.style.height = h + "px";
  return n;
};
export const icon = (name, cls = "ico") => `<span class="${cls}">${window.ICONS[name] || ""}</span>`;

/* ---------- cenas: corte seco ---------- */
export function scene(id, t0, t1) {
  const s = el("div", "scene");
  s.id = id;
  tl.set(s, { visibility: "visible" }, t0);
  if (t1 != null) tl.set(s, { visibility: "hidden" }, t1);
  return s;
}

/* ---------- títulos: revelação por máscara, palavra a palavra ---------- */
// Marcação: *palavra* vira pílula verde; ~palavra~ vira pílula vermelha; | quebra linha.
export function headline(parent, text, { x = 70, y, size = 78, w = W - 140, align = "left", cls = "" } = {}) {
  const h = el("div", "hd " + cls, parent);
  Object.assign(h.style, { position: "absolute", left: x + "px", top: y + "px", width: w + "px", fontSize: size + "px", textAlign: align });
  const lines = text.split("|");
  h.innerHTML = lines
    .map((line) =>
      line
        .trim()
        .split(/\s+/)
        .map((raw) => {
          // pílula com mais de uma palavra: *agentes_de_IA*
          const word = raw.replace(/_/g, " ");
          const m = word.match(/^([*~])(.+)\1([.,!?]?)$/);
          if (m) {
            const red = m[1] === "~" ? " red" : "";
            return `<span class="w"><span class="wi"><span class="hl${red}"><span class="pillbg"></span><em>${m[2]}</em></span>${m[3]}</span></span>`;
          }
          return `<span class="w"><span class="wi">${word}</span></span>`;
        })
        .join(" "),
    )
    .join("<br>");
  return h;
}

export function textIn(h, t, { stagger = 0.045, dur = 0.62, sound = true } = {}) {
  const words = h.querySelectorAll(".wi");
  tl.fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: dur, ease: EXPO, stagger }, t);
  const pills = h.querySelectorAll(".pillbg");
  pills.forEach((p, i) => {
    const at = t + 0.2 + words.length * stagger * 0.6 + i * 0.25;
    tl.fromTo(p, { scaleX: 0 }, { scaleX: 1, duration: 0.42, ease: QUINT }, at);
  });
  if (sound) cue("text", t);
  return t + dur + words.length * stagger;
}

export function textOut(h, t, { dur = 0.32 } = {}) {
  tl.to(h.querySelectorAll(".wi"), { yPercent: -115, duration: dur, ease: "power3.in", stagger: 0.012 }, t);
}

/* ---------- entradas genéricas ---------- */
export function popIn(n, t, { y = 50, scale = 0.94, dur = 0.7, blur = 10, sound = "pop" } = {}) {
  tl.fromTo(n, { opacity: 0, y, scale, filter: `blur(${blur}px)` }, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: dur, ease: EXPO }, t);
  if (sound) cue(sound, t);
}
export function fadeOut(n, t, { dur = 0.3, y = -30 } = {}) {
  tl.to(n, { opacity: 0, y, duration: dur, ease: "power2.in" }, t);
}

/* ---------- janela do app com câmera ---------- */
export function appWindow(parent, { x, y, w, h, url = "app.pilarsoft.com.br" }) {
  const win = el("div", "win", parent);
  pos(win, x, y, w, h);
  win.innerHTML = `<div class="bar"><i></i><i></i><i></i><div class="url">${icon("lock", "ico lockico")}${url}</div><div style="width:60px"></div></div><div class="vp"></div><div class="dim"></div>`;
  const vp = win.querySelector(".vp");
  const vw = w;
  const vh = h - 52;
  const shots = {};
  const api = {
    el: win,
    vw,
    vh,
    shot(name) {
      if (!shots[name]) {
        const img = el("img", "shot", vp);
        img.src = `../stills/${name}.jpg`;
        shots[name] = img;
      }
      return shots[name];
    },
    // Enquadra o retângulo r (px CSS da tela 1440x900) na janela.
    frame(r) {
      const s = Math.min(vw / r.w, vh / r.h);
      let tx = vw / 2 - (r.x + r.w / 2) * s;
      let ty = vh / 2 - (r.y + r.h / 2) * s;
      tx = Math.min(0, Math.max(vw - 1440 * s, tx));
      ty = Math.min(0, Math.max(vh - 900 * s, ty));
      return { x: tx, y: ty, scale: s };
    },
    show(name, t, r, { fade = 0.25 } = {}) {
      const img = api.shot(name);
      tl.set(img, { ...api.frame(r), zIndex: ++api.z }, t);
      tl.fromTo(img, { opacity: 0 }, { opacity: 1, duration: fade, ease: "none" }, t);
      return img;
    },
    move(name, t, r, dur, ease = "power2.inOut") {
      tl.to(api.shot(name), { ...api.frame(r), duration: dur, ease }, t);
    },
    dim(t, amount = 0.55, dur = 0.4) {
      tl.to(win.querySelector(".dim"), { backgroundColor: `rgba(12,14,12,${amount})`, duration: dur, ease: "power2.out" }, t);
    },
    // posição na tela (stage) de um ponto da imagem, dado o enquadramento r
    toStage(r, px, py) {
      const f = api.frame(r);
      return { x: x + f.x + px * f.scale, y: y + 52 + f.y + py * f.scale };
    },
    z: 0,
  };
  return api;
}

// Recorte da tela que se descola da janela e cresce.
export function lift(parent, still, r, { x, y, w, t, from, ring = true }) {
  const k = w / r.w;
  const h = r.h * k;
  const n = el("div", "lift", parent);
  pos(n, x, y, w, h);
  Object.assign(n.style, {
    backgroundImage: `url(../stills/${still}.jpg)`,
    backgroundSize: `${1440 * k}px ${900 * k}px`,
    backgroundPosition: `${-r.x * k}px ${-r.y * k}px`,
  });
  if (from) {
    // nasce exatamente sobre o recorte na janela e voa até o lugar
    const sx = from.w / w;
    tl.fromTo(
      n,
      { opacity: 0, x: from.x - x, y: from.y - y, scale: sx, transformOrigin: "0 0" },
      { opacity: 1, duration: 0.12, ease: "none" },
      t,
    );
    tl.to(n, { x: 0, y: 0, scale: 1, duration: 0.75, ease: EXPO }, t + 0.02);
  } else {
    popIn(n, t, { sound: null });
  }
  if (ring) {
    tl.to(n, { boxShadow: "0 0 0 1px rgba(0,0,0,.06), 0 30px 80px -10px rgba(0,0,0,.7), 0 0 0 6px rgba(164,236,134,.9)", duration: 0.5, ease: QUINT }, t + 0.45);
  }
  cue("lift", t);
  return { el: n, h };
}

/* ---------- cursor ---------- */
export function cursor(parent) {
  const c = el("div", "cursor", parent, `<svg viewBox="0 0 24 24"><path d="M4 2.5 L4 19 L8.6 14.8 L11.6 21.4 L14.4 20.2 L11.5 13.8 L17.8 13.6 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`);
  const rp = el("div", "ripple", parent);
  return {
    move(t, x, y, dur = 0.8, from) {
      if (from) tl.set(c, { left: from.x, top: from.y }, t);
      tl.to(c, { opacity: 1, duration: 0.2 }, t);
      tl.to(c, { left: x, top: y, duration: dur, ease: "power3.inOut" }, t);
    },
    click(t, x, y) {
      tl.to(c, { scale: 0.82, duration: 0.08, yoyo: true, repeat: 1, transformOrigin: "10% 10%" }, t);
      tl.fromTo(rp, { left: x, top: y, scale: 0.3, opacity: 1 }, { scale: 1.4, opacity: 0, duration: 0.55, ease: "power2.out", immediateRender: false }, t);
      cue("click", t);
    },
    hide(t) {
      tl.to(c, { opacity: 0, duration: 0.2 }, t);
    },
  };
}

/* ---------- contadores (pintados no seek) ---------- */
const COUNTERS = [];
const ease = (p) => 1 - Math.pow(1 - p, 4);
export const brl = (v) => "R$ " + Math.round(v).toLocaleString("pt-BR");
export function counter(n, t, from, to, dur, fmt = (v) => Math.round(v).toString(), { ticks = true } = {}) {
  COUNTERS.push({ n, t, from, to, dur, fmt });
  n.textContent = fmt(from);
  if (ticks) cue("count", t, { dur });
}

/* ---------- digitação ---------- */
const TYPERS = [];
export function typer(n, t, text, cps = 28) {
  TYPERS.push({ n, t, text, cps });
  cue("type", t, { dur: text.length / cps });
}

/* ---------- anel de leitura (src/components/motion/readingRingEngine.ts, sem estado) ---------- */
const TONES = ["hsl(160 45% 72%)", "#A4EC86", "hsl(78 62% 58%)"];
const RING_DARK = { dust: "#7e857d", strong: "hsl(160 45% 72%)", mid: "#a4ec86", soft: "hsl(78 62% 58%)", halo: "rgba(164, 236, 134, 0.16)" };
const rng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};
const RINGS = [];
export function readingRing(parent, { cx, cy, size, t0, t1, scale = 1 }) {
  const cv = el("canvas", "", parent);
  const dpr = 1;
  cv.width = size * dpr;
  cv.height = size * dpr;
  Object.assign(cv.style, { position: "absolute", left: cx - size / 2 + "px", top: cy - size / 2 + "px", width: size + "px", height: size + "px" });
  const r = rng(20261009);
  const radius = size * 0.36;
  const sc = Math.min(1.1, Math.max(0.6, radius / 80)) * scale;
  const ps = Array.from({ length: 720 }, () => {
    const gauss = (r() + r() + r() - 1.5) / 1.5;
    const halo = r() < 0.1;
    return {
      x0: size / 2 + (r() - 0.5) * radius * 3.4,
      y0: size / 2 + (r() - 0.5) * radius * 3.4,
      a: r() * Math.PI * 2,
      off: halo ? gauss * 0.45 : gauss * 0.13,
      halo,
      w: 0.42 * (0.85 + r() * 0.3) * (halo ? 0.6 : 1),
      size: (0.45 + r() * 0.8) * sc,
      alpha: halo ? 0.12 + r() * 0.22 : 0.32 + r() * 0.5,
      tone: Math.floor(r() * 3),
      grey: r() < 0.88,
      phase: r() * Math.PI * 2,
    };
  });
  const ring = { cv, ctx: cv.getContext("2d"), ps, size, radius, t0, t1, opacity: { v: 1 } };
  RINGS.push(ring);
  return ring;
}
function paintRing(R, T) {
  const { ctx, size } = R;
  ctx.clearRect(0, 0, size, size);
  if (T < R.t0 || (R.t1 != null && T > R.t1)) return;
  const t = T - R.t0 + 0.0001;
  const cx = size / 2, cy = size / 2;
  const radius = R.radius * (1 + 0.035 * Math.sin(t * 1.4));
  const head = t * 2.1;
  const share = (t % 3.4) / 3.4;
  const front = share * radius * 2.2;
  const fade = Math.min(1, t / 0.6) * R.opacity.v;
  const hx = cx + Math.cos(head - 0.35) * radius;
  const hy = cy + Math.sin(head - 0.35) * radius;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, radius * 0.55);
  g.addColorStop(0, "rgba(164,236,134,.22)");
  g.addColorStop(1, "rgba(164,236,134,0)");
  ctx.globalAlpha = fade;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(hx, hy, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  const k = 1 - Math.exp(-t * 2.4);
  for (const p of R.ps) {
    const angle = p.a + t * p.w;
    const rr = radius * (1 + p.off) + Math.sin(t * 0.9 + p.phase) * radius * 0.015;
    const x = p.x0 + (cx + Math.cos(angle) * rr - p.x0) * k;
    const y = p.y0 + (cy + Math.sin(angle) * rr - p.y0) * k;
    let behind = (head - angle) % (Math.PI * 2);
    if (behind < 0) behind += Math.PI * 2;
    const lit = p.halo ? 0 : Math.exp(-behind * 1.1);
    const dist = Math.hypot(x - cx, y - cy);
    const liftv = Math.exp(-(((dist - front) / (radius * 0.12)) ** 2)) * 0.45 * (1 - share);
    const tw = Math.sin(t * 2.3 + p.phase) * 0.1;
    ctx.globalAlpha = Math.min(1, Math.max(0, p.alpha + tw + lit * 0.55 + liftv)) * fade;
    ctx.fillStyle = lit > 0.6 ? RING_DARK.strong : lit > 0.4 ? RING_DARK.mid : lit > 0.25 ? RING_DARK.soft : p.grey ? RING_DARK.dust : TONES[p.tone];
    ctx.beginPath();
    ctx.arc(x, y, p.size * (1 + lit * 0.35), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---------- símbolo (PilarMark): capitel, ábaco e três caneluras ---------- */
export function mark(parent, { x, y, w, weight = 1.6, color = "#fff" }) {
  const s = el("div", "", parent);
  pos(s, x, y, w);
  s.style.position = "absolute";
  s.innerHTML = `<svg viewBox="-1 -0.5 30 25.5" fill="none" stroke="${color}" stroke-width="${weight}" stroke-linecap="round" style="width:100%;overflow:visible">
    <path class="cap" pathLength="1" d="M1 2H27"/><path class="aba" pathLength="1" d="M3 6H25" stroke-opacity=".85"/>
    <path class="fl f1" pathLength="1" d="M7 9V23"/><path class="fl f2" pathLength="1" d="M14 9V23"/><path class="fl f3" pathLength="1" d="M21 9V23"/></svg>`;
  const paths = s.querySelectorAll("path");
  return {
    el: s,
    // Desenho (A01): 550 ms, capitel, ábaco e caneluras descendo em sequência
    draw(t) {
      tl.set(paths, { strokeDasharray: "1 2", strokeDashoffset: 1.001 }, 0);
      const d = [0, 0.16, 0.34, 0.42, 0.5];
      paths.forEach((p, i) => tl.to(p, { strokeDashoffset: 0, duration: 0.55, ease: "power4.out" }, t + d[i]));
      cue("draw", t);
    },
    // Caneluras verdes uma a uma (A07)
    green(t, color = "#A4EC86") {
      s.querySelectorAll(".fl").forEach((p, i) => tl.to(p, { stroke: color, duration: 0.3, ease: "power2.out" }, t + i * 0.12));
      cue("chime", t);
    },
    // Respiração (L02): caneluras crescem da base, fora de fase
    breathe(t0, t1) {
      s.querySelectorAll(".fl").forEach((p, i) => {
        const n = Math.floor((t1 - t0) / 0.9);
        tl.set(p, { transformBox: "fill-box", transformOrigin: "50% 100%" }, t0);
        tl.fromTo(p, { scaleY: 1 }, { scaleY: 0.38, duration: 0.9, ease: "sine.inOut", yoyo: true, repeat: n, delay: i * 0.3 }, t0);
      });
    },
  };
}

/* ---------- logotipo oficial (brand/assets/logo/pilar-logo-horizontal-white.svg) ---------- */
export function lockup(parent, { x, y, w }) {
  const s = el("div", "", parent);
  pos(s, x, y, w);
  s.style.position = "absolute";
  s.innerHTML = window.LOCKUP;
  const svg = s.querySelector("svg");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.style.width = "100%";
  svg.style.overflow = "visible";
  const strokes = svg.querySelectorAll("g path");
  strokes.forEach((p) => p.setAttribute("pathLength", "1"));
  // o texto vai num grupo: animar o path direto apagaria o translate do SVG oficial
  const raw = svg.querySelector(":scope > path");
  const word = document.createElementNS("http://www.w3.org/2000/svg", "g");
  raw.replaceWith(word);
  word.appendChild(raw);
  return {
    el: s,
    word,
    draw(t) {
      tl.set(strokes, { strokeDasharray: "1 2", strokeDashoffset: 1.001 }, 0);
      const d = [0, 0.16, 0.34, 0.42, 0.5];
      strokes.forEach((p, i) => tl.to(p, { strokeDashoffset: 0, duration: 0.55, ease: "power4.out" }, t + d[i]));
      tl.fromTo(word, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.7, ease: EXPO }, t + 0.45);
      cue("draw", t);
    },
    green(t) {
      [2, 3, 4].forEach((i, k) => tl.to(strokes[i], { stroke: "#A4EC86", duration: 0.3 }, t + k * 0.12));
      cue("chime", t);
    },
  };
}

/* ---------- fundo ---------- */
export function background({ glows = [] } = {}) {
  const bg = el("div", "layer", STAGE);
  bg.id = "bg";
  bg.innerHTML = `<svg id="colunata" width="${W}" height="${H}"><defs><pattern id="col" width="96" height="${H}" patternUnits="userSpaceOnUse"><path d="M48 0V${H}" stroke="#fff" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#col)"/></svg>`;
  const gl = glows.map(([gx, gy, gs, c]) => {
    const g = el("div", "glow", bg);
    pos(g, gx - gs / 2, gy - gs / 2, gs, gs);
    g.style.background = c;
    return g;
  });
  const grain = el("canvas", "", STAGE);
  grain.id = "grain";
  grain.width = W / 3;
  grain.height = H / 3;
  const vig = el("div", "", STAGE);
  vig.id = "vignette";
  return { bg, glows: gl, grain, vig };
}
let GRAIN;
function paintGrain(frame) {
  if (!GRAIN) GRAIN = document.getElementById("grain");
  if (!GRAIN) return;
  const ctx = GRAIN.getContext("2d");
  const img = ctx.createImageData(GRAIN.width, GRAIN.height);
  const r = rng(frame * 7919 + 13);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------- cues de áudio (lidos pelo mixer) ---------- */
export const CUES = [];
export function cue(kind, t, extra = {}) {
  CUES.push({ kind, t: +t.toFixed(3), ...extra });
}

/* ---------- seek ---------- */
export function finalize(duration, sections = {}, fps = 30) {
  tl.set({}, {}, duration);
  window.__meta = { duration, fps, w: W, h: H, cues: CUES, sections };
  window.__seek = async (t) => {
    tl.seek(t, false);
    for (const c of COUNTERS) {
      const p = Math.min(1, Math.max(0, (t - c.t) / c.dur));
      c.n.textContent = c.fmt(c.from + (c.to - c.from) * ease(p));
    }
    for (const ty of TYPERS) {
      const nch = Math.max(0, Math.min(ty.text.length, Math.floor((t - ty.t) * ty.cps)));
      ty.n.textContent = t < ty.t ? "" : ty.text.slice(0, nch);
    }
    for (const R of RINGS) paintRing(R, t);
    paintGrain(Math.round(t * fps));
  };
}
