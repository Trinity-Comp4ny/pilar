// Motor de composição dos vídeos da Pilar.
// Tudo é função do tempo: window.__seek(t) deixa o quadro pronto para captura.
// GSAP faz as entradas; contadores, anel e grão são pintados aqui, sem estado entre quadros.

const STAGE = document.getElementById("stage");
export const W = +STAGE.dataset.w;
export const THEME = STAGE.dataset.theme || "dark";
const cssVar = (name, node = STAGE) => getComputedStyle(node).getPropertyValue(name).trim();
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
export function scene(id, t0, t1, { theme } = {}) {
  const s = el("div", "scene" + (theme ? " is-" + theme : ""));
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
          const m = word.match(/^([*~])(.+)\1([.,!?:;]?)$/);
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
      tl.to(win.querySelector(".dim"), { opacity: amount, duration: dur, ease: "power2.out" }, t);
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
// cores de src/styles/motion.css: :root (claro) e .dark
const RING_PAL = {
  dark: { dust: "#7e857d", strong: "hsl(160 45% 72%)", mid: "#a4ec86", soft: "hsl(78 62% 58%)", halo: "rgba(164,236,134,.22)" },
  light: { dust: "#8f948d", strong: "hsl(102 55% 27%)", mid: "hsl(96 42% 38%)", soft: "hsl(88 55% 50%)", halo: "rgba(164,236,134,.45)" },
};
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
export function readingRing(parent, { cx, cy, size, t0, t1, scale = 1, theme = THEME }) {
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
  const ring = { cv, ctx: cv.getContext("2d"), ps, size, radius, t0, t1, opacity: { v: 1 }, pal: RING_PAL[theme] };
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
  const RING_DARK = R.pal;
  g.addColorStop(0, RING_DARK.halo);
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
export function mark(parent, { x, y, w, weight = 1.6, color = cssVar("--fg") }) {
  const s = el("div", "", parent);
  pos(s, x, y, w);
  s.style.position = "absolute";
  s.innerHTML = `<svg viewBox="-1 -0.5 30 25.5" fill="none" stroke="${color}" stroke-width="${weight}" stroke-linecap="round" style="width:100%;overflow:visible">
    <path class="cap" pathLength="1" d="M1 2H27"/><path class="aba" pathLength="1" d="M3 6H25"/>
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
    green(t, color = cssVar("--flute")) {
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
// Logotipo horizontal desenhado a partir da geometria oficial
// (brand/assets/logo/pilar-logo-horizontal-*.svg): capitel, ábaco, três caneluras e o nome.
// Uma cor só, como o CEO pediu em 2026-11-09: o ábaco sai opaco, igual às versões de uma cor.
const LK = { cap: 4.273, aba: 25.635, fTop: 41.658, fBot: 116.427, cx: 73.702, capL: 4.273, capR: 143.131, abaL: 14.954, abaR: 132.45, flutes: [36.317, 73.702, 111.087], sw: 8.545 };

export function lockup(parent, { x, y, w, theme = THEME, color }) {
  const ink = color || (theme === "light" ? "#1A1A1A" : "#FFFFFF");
  const s = el("div", "", parent);
  pos(s, x, y, w);
  s.style.position = "absolute";
  const word = (window.LOCKUP.match(/<path d="(M8\.6[^"]+)" transform="([^"]+)"/) || []).slice(1);
  const half = (yy, x1, x2, cls) =>
    `<path class="${cls}" pathLength="1" d="M${LK.cx} ${yy}H${x1}"/><path class="${cls}" pathLength="1" d="M${LK.cx} ${yy}H${x2}"/>`;
  s.innerHTML = `<svg viewBox="0 0 396.181 120.700" style="width:100%;overflow:visible">
    <g class="guides" stroke="${ink}" stroke-width="0.7" fill="none" opacity="0">
      <path class="gd" pathLength="1" d="M${LK.cx} -26V146" stroke-dasharray="4 4"/>
      <path class="gd" pathLength="1" d="M-30 ${LK.cap}H180"/>
      <path class="gd" pathLength="1" d="M-30 ${LK.aba}H180"/>
      <path class="gd" pathLength="1" d="M-30 ${LK.fBot}H180"/>
      ${LK.flutes.map((fx) => `<path class="gd" pathLength="1" d="M${fx} ${LK.aba}V140" stroke-dasharray="2 4"/>`).join("")}
      ${LK.flutes.map((fx) => `<circle cx="${fx}" cy="${LK.fBot}" r="2.6"/>`).join("")}
    </g>
    <g class="mk" stroke="${ink}" stroke-width="${LK.sw}" stroke-linecap="round" fill="none">
      ${half(LK.cap, LK.capL, LK.capR, "cap")}
      ${half(LK.aba, LK.abaL, LK.abaR, "aba")}
      ${LK.flutes.map((fx, i) => `<path class="fl f${i}" pathLength="1" d="M${fx} ${LK.fTop}V${LK.fBot}"/>`).join("")}
    </g>
    <defs><clipPath id="wclip${x}${y}"><rect class="wr" x="190" y="-10" width="0" height="140"/></clipPath></defs>
    <g clip-path="url(#wclip${x}${y})"><g class="wd"><path d="${word[0]}" transform="${word[1]}" fill="${ink}"/></g></g>
  </svg>`;
  const q = (sel) => s.querySelectorAll(sel);
  const strokes = q(".mk path");
  return {
    el: s,
    word: s.querySelector(".wd"),
    // Traço técnico: guias de construção, capitel e ábaco do eixo para fora, caneluras
    // descendo do ábaco, guias somem, o nome se revela. ~1,6 s.
    draw(t, { guides = true } = {}) {
      tl.set(strokes, { strokeDasharray: "1 2", strokeDashoffset: 1.001 }, 0);
      tl.set(q(".gd"), { strokeDashoffset: 0 }, 0);
      if (guides) {
        tl.set(s.querySelector(".guides"), { opacity: 0.32 }, t);
        q(".gd").forEach((g, i) => {
          tl.fromTo(g, { strokeDasharray: "1 2", strokeDashoffset: 1.001 }, { strokeDashoffset: 0, duration: 0.5, ease: "power2.out", immediateRender: false }, t + i * 0.04);
        });
        tl.fromTo(q(".guides circle"), { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: 0.05, immediateRender: false }, t + 0.35);
        tl.to(s.querySelector(".guides"), { opacity: 0, duration: 0.45, ease: "power2.in" }, t + 1.15);
      }
      const t0 = t + (guides ? 0.25 : 0);
      tl.to(q(".cap"), { strokeDashoffset: 0, duration: 0.5, ease: "power3.out" }, t0);
      tl.to(q(".aba"), { strokeDashoffset: 0, duration: 0.45, ease: "power3.out" }, t0 + 0.14);
      // canelura do meio primeiro, as de fora logo depois
      [1, 0, 2].forEach((i, k) => tl.to(s.querySelector(".f" + i), { strokeDashoffset: 0, duration: 0.5, ease: "power3.out" }, t0 + 0.32 + k * 0.07));
      tl.to(s.querySelector(".wr"), { attr: { width: 220 }, duration: 0.7, ease: "power3.inOut" }, t0 + 0.75);
      tl.fromTo(s.querySelector(".wd"), { x: -18 }, { x: 0, duration: 0.8, ease: EXPO, immediateRender: false }, t0 + 0.75);
      cue("draw", t);
      cue("tick", t0 + 0.32);
    },
    // logotipo já pronto, sem animação
    show(t) {
      tl.set(strokes, { strokeDasharray: "none" }, t);
      tl.set(s.querySelector(".wr"), { attr: { width: 220 } }, t);
    },
  };
}

/* ---------- fundo ---------- */
// Paisagem da landing (apps/marketing/src/components/hero/HeroBackdrop.tsx), em SVG.
const HILLS = (w, h) => `<svg class="hills" width="${w}" height="${h}" viewBox="0 0 1440 860" preserveAspectRatio="xMidYMax slice" style="position:absolute;inset:0">
  <defs>
    <linearGradient id="hL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(160 45% 78%)"/><stop offset="1" stop-color="hsl(102 73% 73% / .7)"/></linearGradient>
    <linearGradient id="hM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(102 73% 73%)"/><stop offset="1" stop-color="hsl(78 62% 58%)"/></linearGradient>
    <linearGradient id="hP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(88 55% 52%)"/><stop offset="1" stop-color="hsl(96 42% 38%)"/></linearGradient>
    <pattern id="tr" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".62" fill="#fff"/></pattern>
  </defs>
  <g class="h1"><path d="M0 690 C160 640 260 664 400 652 C560 638 640 590 800 606 C960 622 1060 660 1200 648 C1320 638 1380 656 1440 668 V860 H0Z" fill="url(#hL)" opacity=".75"/></g>
  <g class="h2"><path d="M0 752 C180 714 300 742 460 730 C620 718 720 682 880 700 C1020 716 1140 744 1280 732 C1350 726 1400 736 1440 744 V860 H0Z" fill="url(#hM)" opacity=".8"/></g>
  <g class="h3"><path d="M0 806 C200 780 340 800 520 792 C700 784 820 760 980 772 C1140 784 1300 800 1440 796 V860 H0Z" fill="url(#hP)" opacity=".7"/></g>
  <rect width="1440" height="860" fill="url(#tr)" opacity=".28"/>
</svg>`;

export function background({ glows = [] } = {}) {
  const bg = el("div", "layer " + (THEME === "light" ? "bg-light" : "bg-dark"), STAGE);
  bg.id = "bg";
  let hills = null;
  if (THEME === "light") {
    // a paisagem ocupa o terço de baixo; o céu fica limpo para o texto
    const hw = el("div", "", bg);
    Object.assign(hw.style, { position: "absolute", left: 0, right: 0, bottom: 0, height: H * 0.42 + "px" });
    hw.innerHTML = HILLS(W, H * 0.42);
    hills = hw;
  } else {
    bg.innerHTML = `<svg class="colunata" width="${W}" height="${H}"><defs><pattern id="col" width="96" height="${H}" patternUnits="userSpaceOnUse"><path d="M48 0V${H}" stroke="#fff" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#col)"/></svg>`;
  }
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
  if (THEME === "dark") el("div", "vignette", STAGE);
  return { bg, glows: gl, grain, hills };
}

/* ---------- legenda sincronizada à fala ---------- */
// Cada fala (de narration/<id>/timing.json) vira blocos de até `max` palavras; a palavra
// falada acende. O tempo de cada palavra é proporcional ao tamanho dela dentro da fala.
export function captions(parent, lines, { y, max = 6 } = {}) {
  const box = el("div", "cap", parent);
  box.style.top = y + "px";
  box.style.zIndex = 60;
  for (const ln of lines) {
    const words = ln.text.split(/\s+/);
    const weights = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 2);
    const total = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    const times = weights.map((w) => {
      const t = ln.start + (acc / total) * ln.dur;
      acc += w;
      return t;
    });
    for (let i = 0; i < words.length; i += max) {
      const chunk = words.slice(i, i + max);
      const row = el("div", "", box);
      Object.assign(row.style, { position: "absolute", left: 0, right: 0, top: 0, opacity: 0 });
      row.innerHTML = chunk.map((w) => `<span class="cw">${w}</span>`).join(" ");
      const t0 = times[i];
      const t1 = i + max < words.length ? times[i + max] : ln.start + ln.dur + 0.25;
      tl.fromTo(row, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out", immediateRender: false }, t0 - 0.05);
      tl.set(row, { opacity: 0 }, t1);
      row.querySelectorAll(".cw").forEach((sp, k) => {
        const tw = times[i + k];
        tl.set(sp, { attr: { class: "cw now" } }, tw);
        const next = times[i + k + 1] ?? ln.start + ln.dur;
        tl.set(sp, { attr: { class: "cw said" } }, Math.min(next, t1 - 0.01));
      });
    }
  }
  return box;
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
/* ---------- gravação real (o fundador falando, tela gravada no celular) ---------- */
// A gravação vira uma sequência de JPG em footage/<id>/frames/ (make.sh extrai com ffmpeg).
// Sem gravação, aparece um quadro-guia com o enquadramento, para revisar o formato antes de gravar.
const FOOTS = [];
export function footage(parent, { x, y, w, h, id, t0 = 0, fps = 30, radius = 0, label = "Seu vídeo aqui" }) {
  const box = el("div", "", parent);
  pos(box, x, y, w, h);
  Object.assign(box.style, { position: "absolute", overflow: "hidden", borderRadius: radius + "px", background: "#2A2D2A" });
  const info = window.FOOTAGE && window.FOOTAGE[id];
  if (info) {
    const img = el("img", "", box);
    Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover" });
    FOOTS.push({ img, t0, fps, n: info.frames, base: `../footage/${id}/frames/` });
  } else {
    box.innerHTML = `<div style="position:absolute;inset:0;background:radial-gradient(60% 50% at 50% 38%, #4A4F4A 0%, #2A2D2A 70%)"></div>
      <svg viewBox="0 0 200 260" style="position:absolute;left:50%;top:52%;width:62%;transform:translate(-50%,-50%);opacity:.35"><circle cx="100" cy="80" r="46" fill="#8A908A"/><path d="M20 260 C20 170 60 140 100 140 C140 140 180 170 180 260Z" fill="#8A908A"/></svg>
      <div style="position:absolute;left:0;right:0;top:46px;text-align:center;font:600 30px Inter;color:rgba(255,255,255,.75);letter-spacing:.06em;text-transform:uppercase">${label}</div>
      <div style="position:absolute;inset:40px;border:2px dashed rgba(255,255,255,.25);border-radius:24px"></div>
      <div style="position:absolute;left:0;right:0;top:34%;height:2px;background:rgba(164,236,134,.35)"></div>`;
  }
  return box;
}

export function finalize(duration, sections = {}, fps = 30) {
  tl.set({}, {}, duration);
  window.__meta = { duration, fps, w: W, h: H, cues: CUES, sections };
  window.__seek = async (t) => {
    // em t=0 exato o GSAP não aplica o que está posicionado em 0; um instante depois, sim
    t = Math.max(t, 0.0005);
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
    await Promise.all(
      FOOTS.map((f) => {
        const k = Math.min(f.n, Math.max(1, Math.floor((t - f.t0) * f.fps) + 1));
        const src = f.base + String(k).padStart(5, "0") + ".jpg";
        if (f.img.getAttribute("src") === src) return null;
        f.img.src = src;
        return f.img.decode().catch(() => {});
      }),
    );
  };
}
