// Anel de leitura (R1, ADR 0049): poeira cinza em anel, uma varredura verde que
// dá a volta com um brilho suave por baixo, um pulso de leitura saindo do centro
// e uma respiração leve. Mesmo motor do MoleculeField do Precursal, com as cores
// do Pilar. A cópia sem React para o boot vive em public/boot-ring.js.

const TONES = ["hsl(160 45% 72%)", "#A4EC86", "hsl(78 62% 58%)"];
const SEED = 20261009;
const PULSE_S = 3.4;
const SWEEP_RAD_S = 2.1;

export interface RingParticle {
  x: number;
  y: number;
  /** Ângulo inicial no anel, em radianos. */
  readonly a: number;
  /** Distância relativa ao raio (gaussiana); o halo vai mais longe. */
  readonly off: number;
  readonly halo: boolean;
  /** Radianos por segundo. */
  readonly w: number;
  readonly size: number;
  readonly alpha: number;
  readonly tone: number;
  readonly grey: boolean;
  readonly phase: number;
}

/** Mulberry32: o anel nasce igual toda vez para a mesma semente. */
const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const ringRadius = (width: number, height: number): number => Math.min(width, height) * 0.36;

/** Mais grãos em anel maior, com teto para continuar barato. */
export const particleCount = (radius: number): number => Math.round(Math.min(720, Math.max(120, radius * 9)));

export const seedRing = (width: number, height: number, seed = SEED): RingParticle[] => {
  const rng = createRng(seed);
  const radius = ringRadius(width, height);
  const scale = Math.min(1.1, Math.max(0.6, radius / 80));
  return Array.from({ length: particleCount(radius) }, () => {
    const gauss = (rng() + rng() + rng() - 1.5) / 1.5;
    const halo = rng() < 0.1;
    return {
      x: width / 2 + (rng() - 0.5) * radius * 3.4,
      y: height / 2 + (rng() - 0.5) * radius * 3.4,
      a: rng() * Math.PI * 2,
      off: halo ? gauss * 0.45 : gauss * 0.13,
      halo,
      w: 0.42 * (0.85 + rng() * 0.3) * (halo ? 0.6 : 1),
      size: (0.45 + rng() * 0.8) * scale,
      alpha: halo ? 0.12 + rng() * 0.22 : 0.32 + rng() * 0.5,
      tone: Math.floor(rng() * TONES.length),
      grey: rng() < 0.92,
      phase: rng() * Math.PI * 2,
    };
  });
};

/** Quanto um grão acende por estar logo atrás da varredura (0 a 1). */
export const sweepGlow = (angle: number, head: number): number => {
  let behind = (head - angle) % (Math.PI * 2);
  if (behind < 0) behind += Math.PI * 2;
  return Math.exp(-behind * 1.1);
};

interface RingColors {
  dust: string;
  strong: string;
  mid: string;
  soft: string;
  halo: string;
}

const readColors = (el: Element): RingColors => {
  const css = getComputedStyle(el);
  const pick = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    dust: pick("--ring-dust", "#8f948d"),
    strong: pick("--ring-glow-strong", "hsl(102 55% 27%)"),
    mid: pick("--ring-glow-mid", "hsl(96 42% 38%)"),
    soft: pick("--ring-glow-soft", "hsl(88 55% 50%)"),
    halo: pick("--ring-halo", "rgba(164, 236, 134, 0.32)"),
  };
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Começa a pintar o anel no canvas e devolve como parar. Pausa fora da tela e com
 * a aba escondida. Com movimento reduzido, pinta um quadro só, já formado.
 */
export const startReadingRing = (canvas: HTMLCanvasElement): { stop: () => void } => {
  const ctx = canvas.getContext?.("2d") ?? null;
  if (!ctx) return { stop: () => undefined };
  const still = reducedMotion();
  let width = 0;
  let height = 0;
  let particles: RingParticle[] = [];
  let colors = readColors(canvas);
  let time = 0;
  let last = 0;
  let frame = 0;
  let onScreen = true;

  const paint = (t: number, dt: number, settled: boolean) => {
    const cx = width / 2;
    const cy = height / 2;
    const base = ringRadius(width, height);
    const radius = base * (1 + 0.035 * Math.sin(t * 1.4));
    const head = t * SWEEP_RAD_S;
    const share = (t % PULSE_S) / PULSE_S;
    const front = share * radius * 2.2;
    const fade = settled ? 1 : Math.min(1, t / 0.6);
    ctx.clearRect(0, 0, width, height);

    const hx = cx + Math.cos(head - 0.35) * radius;
    const hy = cy + Math.sin(head - 0.35) * radius;
    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, radius * 0.55);
    glow.addColorStop(0, colors.halo);
    glow.addColorStop(1, "rgba(164, 236, 134, 0)");
    ctx.globalAlpha = fade;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(hx, hy, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();

    for (const p of particles) {
      const angle = p.a + t * p.w;
      const r = radius * (1 + p.off) + Math.sin(t * 0.9 + p.phase) * radius * 0.015;
      const tx = cx + Math.cos(angle) * r;
      const ty = cy + Math.sin(angle) * r;
      const k = settled ? 1 : 1 - Math.exp(-dt * 2.4);
      p.x += (tx - p.x) * k;
      p.y += (ty - p.y) * k;
      const lit = p.halo ? 0 : sweepGlow(angle, head);
      const dist = Math.hypot(p.x - cx, p.y - cy);
      const lift = settled ? 0 : Math.exp(-(((dist - front) / (radius * 0.12)) ** 2)) * 0.45 * (1 - share);
      const twinkle = settled ? 0 : Math.sin(t * 2.3 + p.phase) * 0.1;
      ctx.globalAlpha = Math.min(1, Math.max(0, p.alpha + twinkle + lit * 0.55 + lift)) * fade;
      ctx.fillStyle =
        lit > 0.6
          ? colors.strong
          : lit > 0.4
            ? colors.mid
            : lit > 0.25
              ? colors.soft
              : p.grey
                ? colors.dust
                : TONES[p.tone];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + lit * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const fit = () => {
    const ratio = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    colors = readColors(canvas);
    particles = seedRing(width, height);
    if (still) paint(2.6, 0, true);
  };

  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
  resize?.observe(canvas);
  const visibility =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          onScreen = entry?.isIntersecting ?? true;
        });
  visibility?.observe(canvas);
  fit();

  if (still) {
    return {
      stop: () => {
        resize?.disconnect();
        visibility?.disconnect();
      },
    };
  }

  const step = (now: number) => {
    frame = requestAnimationFrame(step);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    if (!onScreen || document.visibilityState !== "visible" || !width) return;
    time += dt;
    paint(time, dt, false);
  };
  frame = requestAnimationFrame(step);

  return {
    stop: () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      visibility?.disconnect();
    },
  };
};
