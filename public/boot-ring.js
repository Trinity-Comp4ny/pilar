/*
 * Anel de leitura do boot (ADR 0049, SPEC 106).
 *
 * Pinta o anel em #boot-canvas enquanto o JavaScript do app baixa. Arquivo
 * estático porque o CSP não permite script inline. É a cópia sem React de
 * src/components/motion/readingRingEngine.ts; o mesmo arquivo vive em
 * apps/marketing/public/boot-ring.js (um teste garante que os dois são iguais).
 * O React chama window.__pilarBootStop() quando tira o boot da tela.
 */
(function () {
  var canvas = document.getElementById("boot-canvas");
  var ctx = canvas && canvas.getContext && canvas.getContext("2d");
  if (!ctx) return;

  var TONES = ["hsl(160 45% 72%)", "#A4EC86", "hsl(78 62% 58%)"];
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ratio = window.devicePixelRatio || 1;
  var w = canvas.clientWidth || 112;
  var h = canvas.clientHeight || 112;
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  var seed = 20261009 >>> 0;
  function rng() {
    seed = (seed + 0x6d2b79f5) >>> 0;
    var t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  var cx = w / 2;
  var cy = h / 2;
  var base = Math.min(w, h) * 0.36;
  var scale = Math.min(1.1, Math.max(0.6, base / 80));
  var count = Math.round(Math.min(720, Math.max(120, base * 9)));
  var P = [];
  for (var i = 0; i < count; i++) {
    var g = (rng() + rng() + rng() - 1.5) / 1.5;
    var halo = rng() < 0.1;
    P.push({
      x: cx + (rng() - 0.5) * base * 3.4,
      y: cy + (rng() - 0.5) * base * 3.4,
      a: rng() * Math.PI * 2,
      off: halo ? g * 0.45 : g * 0.13,
      halo: halo,
      w: 0.42 * (0.85 + rng() * 0.3) * (halo ? 0.6 : 1),
      size: (0.45 + rng() * 0.8) * scale,
      alpha: halo ? 0.12 + rng() * 0.22 : 0.32 + rng() * 0.5,
      tone: Math.floor(rng() * TONES.length),
      grey: rng() < 0.92,
      ph: rng() * Math.PI * 2,
    });
  }

  function paint(t, dt, settled) {
    var r = base * (1 + 0.035 * Math.sin(t * 1.4));
    var head = t * 2.1;
    var share = (t % 3.4) / 3.4;
    var front = share * r * 2.2;
    var fade = settled ? 1 : Math.min(1, t / 0.6);
    ctx.clearRect(0, 0, w, h);
    var hx = cx + Math.cos(head - 0.35) * r;
    var hy = cy + Math.sin(head - 0.35) * r;
    var glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.55);
    glow.addColorStop(0, "rgba(164, 236, 134, 0.32)");
    glow.addColorStop(1, "rgba(164, 236, 134, 0)");
    ctx.globalAlpha = fade;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    for (var j = 0; j < P.length; j++) {
      var p = P[j];
      var ang = p.a + t * p.w;
      var rr = r * (1 + p.off) + Math.sin(t * 0.9 + p.ph) * r * 0.015;
      var k = settled ? 1 : 1 - Math.exp(-dt * 2.4);
      p.x += (cx + Math.cos(ang) * rr - p.x) * k;
      p.y += (cy + Math.sin(ang) * rr - p.y) * k;
      var behind = (head - ang) % (Math.PI * 2);
      if (behind < 0) behind += Math.PI * 2;
      var lit = p.halo ? 0 : Math.exp(-behind * 1.1);
      var dist = Math.hypot(p.x - cx, p.y - cy);
      var lift = settled ? 0 : Math.exp(-Math.pow((dist - front) / (r * 0.12), 2)) * 0.45 * (1 - share);
      var twinkle = settled ? 0 : Math.sin(t * 2.3 + p.ph) * 0.1;
      ctx.globalAlpha = Math.min(1, Math.max(0, p.alpha + twinkle + lit * 0.55 + lift)) * fade;
      ctx.fillStyle =
        lit > 0.6
          ? "hsl(102 55% 27%)"
          : lit > 0.4
            ? "hsl(96 42% 38%)"
            : lit > 0.25
              ? "hsl(88 55% 50%)"
              : p.grey
                ? "#8f948d"
                : TONES[p.tone];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + lit * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (still) {
    paint(2.6, 0, true);
    return;
  }

  var time = 0;
  var last = 0;
  var frame = 0;
  function step(now) {
    frame = requestAnimationFrame(step);
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    if (document.visibilityState !== "visible") return;
    time += dt;
    paint(time, dt, false);
  }
  frame = requestAnimationFrame(step);
  window.__pilarBootStop = function () {
    cancelAnimationFrame(frame);
  };
})();
