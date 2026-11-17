/**
 * Kit de lançamento do Instagram (@pilarsoft.app): capas de destaque, stories de cada
 * destaque e os seis primeiros posts do feed. Regras visuais em brand/social-instagram.md.
 *
 *   node scripts/brand/render-lancamento.mjs
 *
 * Usa o Playwright do projeto. Cada peça vira um HTML temporário ao lado de
 * brand/social/templates/social.css (fontes e tokens do kit) e sai em PNG em
 * brand/assets/social/lancamento/. Preço e limites espelham apps/marketing/src/lib/planos.ts.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TPL = resolve(ROOT, "brand/social/templates");
const OUT = process.env.OUT_DIR ?? resolve(ROOT, "brand/assets/social/lancamento");

const HANDLE = "@pilarsoft.app";
const INK = "#1A1A1A";

// Símbolo da Pilar: capitel, ábaco e três caneluras, a do meio no eixo (DECISOES 2026-11-07),
// numa cor só: o ábaco tem a mesma opacidade do resto (DECISOES 2026-11-10).
// Mesmo desenho de brand/assets/logo/pilar-mark-ink.svg, no viewBox antigo de 27,6 × 22,6.
const MARK_PATHS = `<path d="M.8 .8H26.8"/><path d="M2.8 4.8H24.8"/><path d="M6.8 7.8V21.8"/><path d="M13.8 7.8V21.8"/><path d="M20.8 7.8V21.8"/>`;
const mark = (stroke = "currentColor", sw = 1.6) =>
  `<svg viewBox="0 0 27.6 22.6" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" aria-hidden="true">${MARK_PATHS}</svg>`;

// Logo empilhado (símbolo + "Pilar"), de brand/assets/logo/pilar-logo-vertical-ink.svg.
const WORDMARK = `<path d="M8.6 0V-71H35.08Q47.28 -71 54.09 -65.14Q60.9 -59.28 60.9 -48.94Q60.9 -42.02 57.81 -36.97Q54.72 -31.92 48.95 -29.25Q43.18 -26.58 35.08 -26.58H19.4V0ZM19.4 -36.44H34.78Q42.1 -36.44 45.9 -39.59Q49.7 -42.74 49.7 -48.940Q49.7 -54.98 45.91 -58.06Q42.12 -61.14 34.78 -61.14H19.4Z M70.72 0V-53.2H81.32V0ZM70.5 -60.92V-71.48H81.54V-60.92Z M105.42 0Q100.18 0 97 -2.7Q93.82 -5.4 93.82 -11.32V-71H104.42V-12.32Q104.42 -10.48 105.36 -9.57Q106.3 -8.66 108.06 -8.66H112.32V0Z M134.38 1.2Q126.12 1.2 121.14 -2.62Q116.16 -6.44 116.16 -13.28Q116.16 -20.16 120.31 -24.05Q124.46 -27.94 133.18 -29.6L151.46 -33.08Q151.46 -39.28 148.58 -42.36Q145.7 -45.44 140.02 -45.44Q134.94 -45.44 132.01 -43.15Q129.08 -40.86 128.02 -36.54L117.06 -37.22Q118.58 -45.18 124.56 -49.79Q130.54 -54.4 140.02 -54.4Q150.82 -54.4 156.44 -48.66Q162.06 -42.92 162.06 -32.52V-11.84Q162.06 -9.88 162.75 -9.12Q163.44 -8.36 164.94 -8.36H166.84V0Q166.34 0.14 165.22 0.23Q164.1 0.32 162.92 0.32Q159.46 0.32 157.04 -0.8Q154.62 -1.92 153.4 -4.45Q152.18 -6.98 152.18 -11.28L153.26 -10.8Q152.48 -7.340 149.82 -4.6Q147.16 -1.86 143.15 -0.33Q139.14 1.2 134.38 1.2ZM136.1 -7.16Q140.88 -7.16 144.31 -9.02Q147.74 -10.88 149.6 -14.17Q151.46 -17.46 151.46 -21.68V-25.08L135.94 -22.08Q131.12 -21.16 129.15 -19.25Q127.18 -17.34 127.18 -14.28Q127.18 -10.9 129.54 -9.03Q131.9 -7.16 136.1 -7.16Z M173.52 0V-53.2H183.2L183.64 -39.08L182.72 -39.36Q183.82 -46.6 187.16 -49.9Q190.5 -53.2 196.18 -53.2H201.26V-43.72H196.22Q192.16 -43.72 189.49 -42.39Q186.82 -41.06 185.47 -38.36Q184.12 -35.66 184.12 -31.38V0Z" transform="translate(-8.600 259.822)" fill="${INK}"/>`;
const logoVertical = (w) =>
  `<svg viewBox="0 0 192.7 261.822" width="${w}" role="img" aria-label="Pilar"><g stroke="${INK}" stroke-width="10.053" stroke-linecap="round" fill="none"><path d="M14.669 5.027H178.031"/><path d="M27.235 30.159H165.465"/><path d="M52.368 49.009V136.973"/><path d="M96.35 49.009V136.973"/><path d="M140.332 49.009V136.973"/></g>${WORDMARK}</svg>`;

const foot = `<div class="foot"><span class="who">${mark()}<span>Pilar</span></span><span>${HANDLE}</span></div>`;

/**
 * Paisagem da marca (céu claro e três morros verdes), a mesma de pilar-logo-*-paisagem.svg e da
 * hero da landing. `topo` é onde os morros começam; `alt` é a altura da faixa de morros.
 */
const paisagem = (w, h, topo, alt) => {
  const sx = (w / 1440).toFixed(5);
  const sy = (alt / 270).toFixed(5);
  const morro = (d, fill, op) =>
    `<path d="${d}" fill="url(#${fill})" opacity="${op}" transform="translate(0 ${topo}) scale(${sx} ${sy})"/>`;
  return `<svg class="paisagem" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" style="position:absolute;inset:0"><defs>
<linearGradient id="lc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="62%" stop-color="#EFF9FB"/><stop offset="100%" stop-color="#A6EC88" stop-opacity="0.22"/></linearGradient>
<linearGradient id="llonge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#AEE0CF"/><stop offset="100%" stop-color="#A6EC88" stop-opacity="0.7"/></linearGradient>
<linearGradient id="lmeio" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#A6EC88"/><stop offset="100%" stop-color="#AED651"/></linearGradient>
<linearGradient id="lperto" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#89C841"/><stop offset="100%" stop-color="#598A38"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#lc)"/>
${morro("M0 100 C160 50 260 74 400 62 C560 48 640 0 800 16 C960 32 1060 70 1200 58 C1320 48 1380 66 1440 78 V270 H0Z", "llonge", 0.75)}
${morro("M0 162 C180 124 300 152 460 140 C620 128 720 92 880 110 C1020 126 1140 154 1280 142 C1350 136 1400 146 1440 154 V270 H0Z", "lmeio", 0.8)}
${morro("M0 216 C200 188 340 210 520 202 C700 194 800 168 980 182 C1140 194 1260 212 1440 204 V270 H0Z", "lperto", 0.72)}
<rect y="${topo + alt - 1}" width="${w}" height="${Math.max(0, h - topo - alt + 1)}" fill="#7DA74A"/></svg>`;
};

/**
 * Ícones das capas de destaque, feitos para ler a ~60 px no celular: grade 100 × 100, traço 8
 * (o mesmo peso relativo do símbolo no ícone do app), ponta e junção redondas, só linha.
 * Cada um é um objeto do escritório de projeto, não um ícone genérico de interface.
 */
const ICON = {
  // Play: o destaque abre com o vídeo de apresentação. O símbolo já está na foto do perfil.
  "comece-aqui": { d: `<path d="M32 18 L84 50 L32 82 Z"/>` },
  // Cartão de preço: o card do plano, com o que vem nele, como a tabela de planos da landing.
  planos: {
    d: `<rect x="20" y="10" width="60" height="80" rx="9"/><path d="M20 34 H80"/><path d="M32 50 L36 54 L44 46 M52 50 H68"/><path d="M32 70 L36 74 L44 66 M52 70 H68"/>`,
  },
  // Maleta: o lado do negócio (comercial, contrato e financeiro).
  gestao: {
    d: `<rect x="10" y="32" width="80" height="52" rx="9"/><path d="M36 32 V24 a6 6 0 0 1 6 -6 H58 a6 6 0 0 1 6 6 V32"/><path d="M10 54 H90"/><path d="M44 54 V62 H56 V54"/>`,
  },
  // Esquadro: o instrumento de quem projeta.
  projetos: {
    d: `<path d="M16 12 V88 H90 Z"/><path d="M32 50 V72 H54 Z"/><path d="M16 30 H24 M16 48 H24 M16 66 H24"/>`,
  },
  // Capacete de obra.
  obras: { d: `<path d="M8 74 H92"/><path d="M18 74 V66 A32 32 0 0 1 82 66 V74"/><path d="M42 36 V56 M58 36 V56"/>` },
  // Faísca da IA: uma grande, uma pequena.
  agentes: {
    d: `<path d="M40 22 C42 46 52 56 76 58 C52 60 42 70 40 94 C38 70 28 60 4 58 C28 56 38 46 40 22 Z"/><path d="M78 6 C79 17 82 20 93 21 C82 22 79 25 78 36 C77 25 74 22 63 21 C74 20 77 17 78 6 Z"/>`,
  },
};

// Estilo da capa. "verde" (padrão): verde cheio, como pilar-app-icon-verde; lê melhor a 60 px e
// não repete o disco da foto do perfil. "disco": disco verde sobre papel (pilar-app-icon-disco).
const ESTILO = process.env.DESTAQUE_ESTILO ?? "verde";

/**
 * Capa de destaque 1080 × 1920. O Instagram mostra só o círculo inscrito no quadrado central
 * (y 420 a 1500, centro em 960): o ícone fica no centro desse círculo.
 */
const destaque = (k) => {
  const i = ICON[k];
  const fundo =
    ESTILO === "verde"
      ? `<svg width="1080" height="1920" style="position:absolute;inset:0" aria-hidden="true"><defs><linearGradient id="v" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#BDF1A7"/><stop offset="100%" stop-color="#93CD51"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#v)"/></svg>`
      : `<svg width="1080" height="1920" style="position:absolute;inset:0" aria-hidden="true"><defs><radialGradient id="d" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="#D8F7CA"/><stop offset="100%" stop-color="#A4EC86"/></radialGradient></defs><rect width="1080" height="1920" fill="#F7F7F7"/><circle cx="540" cy="960" r="420" fill="url(#d)"/></svg>`;
  return {
    w: 1080,
    h: 1920,
    body: `<div class="canvas" style="padding:0">${fundo}
<div style="position:absolute;left:0;right:0;top:420px;height:1080px;display:flex;align-items:center;justify-content:center"><svg viewBox="${i.vb ?? "0 0 100 100"}" width="${i.w ?? 500}" fill="none" stroke="${INK}" stroke-width="${i.sw ?? 8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${i.d}</svg></div></div>`,
  };
};

// Story: 250 px livres no topo, 340 px na base. Rodapé da marca logo abaixo da zona livre do topo.
const storyCss = `.canvas{padding:250px 90px 340px;justify-content:flex-start;gap:56px}
.st-foot{position:absolute;left:90px;right:90px;bottom:200px}
.list{display:flex;flex-direction:column;gap:0;border-top:2px solid var(--line)}
.ink .list{border-color:#3a3a3a}
.li{display:flex;gap:36px;padding:38px 0;border-bottom:2px solid var(--line);align-items:flex-start}
.ink .li{border-color:#3a3a3a}
.li .n{font-size:44px;font-weight:300;color:var(--muted);font-variant-numeric:tabular-nums;min-width:70px;line-height:1.2}
.ink .li .n{color:#a9aab0}
.li h3{font-size:52px;font-weight:500;letter-spacing:-.02em;line-height:1.1}
.li p{font-size:36px;line-height:1.4;color:var(--ink-soft);margin-top:10px}
.ink .li p{color:#d8d8d8}
.cta{display:inline-flex;width:fit-content;align-items:center;height:104px;padding:0 52px;border-radius:999px;background:var(--brand);color:var(--ink);font-size:42px;font-weight:500}
.land .cta{background:var(--ink);color:#fff}`;

// `land`: fechamento claro sobre a paisagem da marca (substitui o fundo Ink, DECISOES 2026-11-07).
const story = ({ land = false, centro = !land, badge, hook, size = 96, extra = "" }) => ({
  w: 1080,
  h: 1920,
  css: storyCss + extraCss,
  body: `<div class="canvas${land ? " land" : ""}"${centro ? ' style="justify-content:center"' : ""}>${land ? paisagem(1080, 1920, 1340, 580) : '<div class="dots"></div>'}
<span class="badge">${badge}</span>
<h1 class="hook" style="font-size:${size}px">${hook}</h1>
${extra}
<div class="st-foot">${foot}</div></div>`,
});

const lista = (itens) =>
  `<div class="list">${itens
    .map(
      ([n, t, p]) =>
        `<div class="li"><span class="n">${n}</span><div><h3>${t}</h3>${p ? `<p>${p}</p>` : ""}</div></div>`
    )
    .join("")}</div>`;

const planoCss = `.planos{display:flex;flex-direction:column;gap:28px}
.pl{border:2px solid var(--line);border-radius:36px;padding:38px 44px;background:#fff}
.pl.on{border:3px solid var(--ink)}
.pl .top{display:flex;justify-content:space-between;align-items:baseline}
.pl .nome{font-size:44px;font-weight:500;letter-spacing:-.02em;display:flex;align-items:center;gap:18px}
.pl .tag{font-size:24px;letter-spacing:.08em;text-transform:uppercase;background:var(--brand);border-radius:999px;padding:8px 18px;font-weight:500}
.pl .preco{font-size:64px;font-weight:500;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.pl .preco small{font-size:32px;font-weight:400;color:var(--muted);letter-spacing:0}
.pl ul{list-style:none;margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
.pl li{font-size:32px;color:var(--ink-soft);line-height:1.35}
.nota{font-size:32px;line-height:1.4;color:var(--ink-soft)}`;

const plano = (nome, preco, itens, on = false) =>
  `<div class="pl${on ? " on" : ""}"><div class="top"><span class="nome">${nome}${on ? '<span class="tag">Mais escolhido</span>' : ""}</span><span class="preco">R$ ${preco}<small>/mês</small></span></div><ul>${itens
    .map((i) => `<li>${i}</li>`)
    .join("")}</ul></div>`;

// Lista de marcas (✓ / ✕) com título opcional. Usada em "para quem é", "incluso" e "portal".
const marcas = (titulo, itens) =>
  `<div class="marcas">${titulo ? `<p class="mt">${titulo}</p>` : ""}${itens
    .map(
      ([tipo, t]) =>
        `<div class="mk"><span class="ic ${tipo}">${
          tipo === "sim"
            ? `<svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7.5"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M7 7 L17 17 M17 7 L7 17"/></svg>`
        }</span><span>${t}</span></div>`
    )
    .join("")}</div>`;

const extraCss = `.marcas{display:flex;flex-direction:column;gap:26px}
.marcas .mt{font-size:32px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.mk{display:flex;align-items:flex-start;gap:28px;font-size:44px;line-height:1.25;font-weight:500;letter-spacing:-.01em}
.mk .ic{flex:none;width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-top:-4px}
.mk .ic.sim{background:var(--brand)}
.mk .ic.nao{background:var(--paper-200)}
.mk .ic svg{width:34px;height:34px;fill:none;stroke:var(--ink);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.marcas+.marcas{margin-top:20px}
.shot{border:2px solid var(--line);border-radius:28px;overflow:hidden;background:#fff;flex:none}
.shot img{display:block;width:100%}
.shot.sangra{border-right:none;border-radius:28px 0 0 28px}
.faq-a{font-size:52px;line-height:1.35;font-weight:400;letter-spacing:-.01em;color:var(--ink);border-left:6px solid var(--brand);padding-left:44px}`;

// Story de tela: título curto e um recorte da tela real (dado fictício do vídeo), que sangra pela
// borda direita quando é largo. Recortes em brand/assets/social/lancamento/telas/.
const tela = ({ badge, hook, body, img, w = 1250, sangra = w > 900 }) => ({
  ...story({
    badge,
    hook,
    size: 88,
    extra: `<p class="body" style="font-size:42px;margin-top:-16px">${body}</p>
<div class="shot${sangra ? " sangra" : ""}" style="width:${w}px;margin-top:24px"><img src="../../assets/social/lancamento/telas/${img}.jpg"></div>`,
  }),
});

// Pergunta frequente: a pergunta grande e a resposta com filete verde.
const faq = ({ badge, q, a }) => story({ badge, hook: q, size: 92, extra: `<p class="faq-a">${a}</p>` });

// Enquete: pergunta e espaço livre para o adesivo de enquete do Instagram (posto no app).
const enquete = ({ badge, hook }) =>
  story({
    centro: false,
    badge,
    hook,
    size: 104,
    extra: `<p class="body" style="font-size:44px">Responde aqui embaixo.</p>`,
  });

// Convite final de cada destaque, claro, sobre a paisagem. O adesivo de link vai acima do botão.
const cta = ({
  badge,
  hook = `Comece pelo <span class="pill">plano certo</span>`,
  body = "Usuários ilimitados e a plataforma inteira em todo plano, a partir de R$ 299 por mês.",
}) =>
  story({
    land: true,
    badge,
    hook,
    size: 104,
    extra: `<p class="body" style="font-size:44px">${body}</p><span class="cta" style="margin-top:16px">Veja os planos</span>`,
  });

// Post de feed 1080 × 1350.
const post = ({ land = false, dots = !land, body, css = "" }) => ({
  w: 1080,
  h: 1350,
  css: storyCss.replace(/\.canvas\{[^}]*\}/, "") + css,
  body: `<div class="canvas${land ? " land" : ""}">${land ? paisagem(1080, 1350, 1000, 350) : ""}${dots ? '<div class="dots"></div>' : ""}${body}</div>`,
});

// Slide de carrossel (2 a 6): barra de progresso, numeral opcional, título, apoio e, se houver,
// um recorte de tela que sangra pela direita.
const slide = ({ i, n, titulo, body, img }) =>
  post({
    css: `.prog{display:flex;gap:12px}.prog i{flex:1;height:8px;border-radius:99px;background:var(--paper-200)}.prog i.on{background:var(--ink)}
.num{font-size:120px;line-height:.9;font-weight:300;letter-spacing:-.05em;font-variant-numeric:tabular-nums;margin-bottom:24px}
.shot{border:2px solid var(--line);border-right:none;border-radius:24px 0 0 24px;overflow:hidden;background:#fff;margin-right:-90px}
.shot img{display:block;width:100%}`,
    body: `<div class="prog">${Array.from({ length: 7 }, (_, k) => `<i${k < i ? ' class="on"' : ""}></i>`).join("")}</div>
<div>${n ? `<div class="num">${n}</div>` : ""}<h2 class="hook ${img ? "sm" : "md"}">${titulo}</h2><p class="body" style="margin-top:28px">${body}</p></div>
${img ? `<div class="shot" style="max-height:420px"><img src="../../assets/social/lancamento/telas/${img}.jpg"></div>` : ""}
${foot}`,
  });

// Croqui da foto-pergunta P-01: o mesmo número passando por quatro lugares, com cota "4×",
// carimbo de prancha e um único preenchimento verde (brand/imagery.md).
const croquiRedigitado = `<svg viewBox="0 0 900 470" width="900" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block">
<rect x="40" y="30" width="250" height="120" rx="14" fill="#E2F6DA"/><rect x="610" y="30" width="250" height="120" rx="14"/>
<rect x="40" y="250" width="250" height="120" rx="14"/><rect x="610" y="250" width="250" height="120" rx="14"/>
<path d="M300 90 C400 60 500 60 600 90"/><path d="M585 76 L600 90 L582 101"/>
<path d="M735 160 C760 190 760 210 735 240"/><path d="M727 222 L735 240 L750 226"/>
<path d="M600 310 C500 340 400 340 300 310"/><path d="M315 324 L300 310 L318 299"/>
<path d="M165 240 C140 210 140 190 165 160"/><path d="M173 178 L165 160 L150 174"/>
<g stroke="none" fill="${INK}" font-family="Geist" font-size="34" font-weight="500" text-anchor="middle">
<text x="165" y="102">Proposta</text><text x="735" y="102">Planilha</text><text x="165" y="322">WhatsApp</text><text x="735" y="322">Financeiro</text></g>
<path d="M40 430 H860"/><path d="M40 415 V445 M860 415 V445"/>
<rect x="405" y="410" width="90" height="40" fill="#FCFCFC" stroke="none"/>
<text x="450" y="443" stroke="none" fill="${INK}" font-family="Geist" font-size="34" font-weight="500" text-anchor="middle">4×</text>
</svg><p style="font-size:28px;letter-spacing:.08em;color:var(--muted);margin-top:8px;text-align:right">PRANCHA 01 · REV C</p>`;

// Capa de Reel 1080 × 1920: tudo no miolo 3:4 do grid (y 240 a 1680). `visual` é um croqui ou
// um recorte de tela limpo; frame do vídeo não, porque traz legenda e título queimados.
const reelCapa = ({ badge, hook, visual }) => ({
  w: 1080,
  h: 1920,
  css:
    storyCss +
    `.miolo{position:absolute;left:90px;right:90px;top:240px;height:1440px;display:flex;flex-direction:column;justify-content:center;gap:56px}
.shot{border:2px solid var(--line);border-radius:28px;overflow:hidden;background:#fff}.shot img{display:block;width:100%}`,
  body: `<div class="canvas" style="padding:0"><div class="dots"></div><div class="miolo"><span class="badge">${badge}</span><h1 class="hook" style="font-size:108px">${hook}</h1>${visual}${foot}</div></div>`,
});

// Croqui do V-02: três caixas soltas, cada uma guardando um pedaço do mesmo projeto.
const croquiTresLugares = `<svg viewBox="0 0 900 300" width="900" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block">
<rect x="10" y="40" width="260" height="140" rx="14"/><rect x="320" y="40" width="260" height="140" rx="14" fill="#E2F6DA"/><rect x="630" y="40" width="260" height="140" rx="14"/>
<g stroke="none" fill="${INK}" font-family="Geist" font-size="40" font-weight="500" text-anchor="middle"><text x="140" y="124">Word</text><text x="450" y="124">Excel</text><text x="760" y="124">WhatsApp</text></g>
<path d="M276 110 H314" stroke-dasharray="2 12"/><path d="M586 110 H624" stroke-dasharray="2 12"/>
<path d="M10 250 H890"/><path d="M10 235 V265 M890 235 V265"/><rect x="380" y="228" width="140" height="44" fill="#FCFCFC" stroke="none"/>
<text x="450" y="263" stroke="none" fill="${INK}" font-family="Geist" font-size="34" font-weight="500" text-anchor="middle">1 projeto</text></svg>`;

// Tela final dos Reels: símbolo de três caneluras, nome, frase, convite e endereço.
const reelFim = (frase) => ({
  w: 1080,
  h: 1920,
  css:
    storyCss +
    `.fim{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;text-align:center;padding:0 110px 300px}
.fim .nome{font-size:96px;font-weight:500;letter-spacing:-.03em;margin-top:-10px}
.fim .frase{font-size:64px;line-height:1.15;font-weight:500;letter-spacing:-.025em}
.fim .url{font-size:34px;color:var(--muted)}`,
  body: `<div class="canvas" style="padding:0"><div class="dots"></div><div class="fim">${mark(INK, 1.6).replace("<svg", '<svg width="220"')}<div class="nome">Pilar</div><div class="frase">${frase}</div><span class="cta">Veja os planos</span><div class="url">pilarsoft.com.br</div></div></div>`,
});

const PECAS = {
  // ── Capas de destaque ──────────────────────────────────────────────
  "destaque-comece-aqui": destaque("comece-aqui"),
  "destaque-planos": destaque("planos"),
  "destaque-gestao": destaque("gestao"),
  "destaque-projetos": destaque("projetos"),
  "destaque-obras": destaque("obras"),
  "destaque-agentes": destaque("agentes"),

  // ── Stories dos destaques ──────────────────────────────────────────
  // Nome: story-<destaque>-<posição>-<assunto>. As posições que faltam na sequência são
  // vídeos (Reels da pasta docs/marketing/video/renders), postados direto no story.
  // Roteiro completo em brand/social/lancamento.md.

  // Comece aqui: quem é, para quem, como funciona, o que a IA faz, convite.
  "story-comece-aqui-01-o-que-e": story({
    badge: "Comece aqui",
    hook: `Gestão para escritórios de engenharia e <span class="pill">arquitetura</span>`,
    size: 104,
    extra: `<p class="body" style="font-size:44px">O comercial, o projeto, a obra e o financeiro no mesmo lugar, com agentes de IA que preparam o trabalho repetitivo.</p>`,
  }),
  "story-comece-aqui-03-para-quem": story({
    badge: "Para quem é",
    hook: `Feito para escritórios de <span class="pill">projeto técnico</span>`,
    size: 92,
    extra: `${marcas("É para", [
      ["sim", "Engenharia multidisciplinar: civil, estrutural e instalações"],
      ["sim", "Arquitetura, do estudo ao acompanhamento de obra"],
    ])}${marcas("Não é para", [
      ["nao", "Construtora ou incorporadora de grande porte"],
      ["nao", "Freelancer sozinho, sem fluxo de proposta"],
    ])}`,
  }),
  "story-comece-aqui-04-modulos": story({
    badge: "Comece aqui",
    hook: `Três módulos, <span class="pill">um fluxo</span>`,
    extra: lista([
      ["01", "Gestão", "Do lead ao dinheiro na conta. Funil, proposta, contrato e financeiro."],
      ["02", "Projetos", "Disciplina, prazo e responsável. Concluiu uma, o próximo já sabe."],
      ["03", "Obras", "A execução e a conta da obra. Cada frente com seu avanço."],
    ]),
  }),
  "story-comece-aqui-05-inicio": tela({
    badge: "Comece aqui",
    hook: `Abriu o sistema, a semana <span class="pill">já vem resumida</span>`,
    body: "Caixa, prazos e o que precisa de você, na tela de início.",
    img: "inicio",
    w: 900,
    sangra: false,
  }),
  "story-comece-aqui-06-agentes": story({
    badge: "Comece aqui",
    hook: `Agentes de IA, com <span class="pill">você no controle</span>`,
    size: 92,
    extra: lista([
      ["01", "A IA prepara", "Lança, categoriza e organiza o registro do dia."],
      ["02", "O sistema confere", "Cada número contra os seus dados. A conta é do sistema."],
      ["03", "Você aprova", "Nada grava e nada vai ao cliente sem o seu aval."],
    ]),
  }),
  "story-comece-aqui-07-um-sistema": faq({
    badge: "Pergunta frequente",
    q: "São três sistemas ou um só?",
    a: `<span class="pill">Um só.</span> O cliente do lead é o cliente do projeto, e é o cliente da obra. Os módulos só separam as telas.`,
  }),
  "story-comece-aqui-08-planos": cta({ badge: "Comece aqui" }),

  // Planos: preço, o que vem em todos, as três dúvidas da página de planos, convite.
  "story-planos-01-tabela": {
    ...story({
      badge: "Planos",
      hook: `A plataforma inteira em <span class="pill">todos os planos</span>`,
      size: 80,
      extra: `<div class="planos">${plano("Essencial", 299, ["10 projetos", "2 obras", "50 leads", "100 créditos de IA"])}${plano(
        "Profissional",
        499,
        ["30 projetos", "5 obras", "200 leads", "400 créditos de IA"],
        true
      )}${plano("Escala", 899, ["Projetos ilimitados", "15 obras", "Leads ilimitados", "1.600 créditos de IA"])}</div>
<p class="nota">Usuários ilimitados em todos. Limites contam projetos, obras e leads ativos.</p>`,
    }),
    css: storyCss + extraCss + planoCss + `.canvas{gap:44px}`,
  },
  "story-planos-02-incluso": story({
    badge: "Planos",
    hook: `Em todo plano, <span class="pill">sem exceção</span>`,
    extra: marcas("", [
      ["sim", "Usuários ilimitados, sem cobrar por cabeça"],
      ["sim", "Gestão, Projetos e Obras, a plataforma inteira"],
      ["sim", "Portal do cliente e Pilar Campo"],
      ["sim", "Agentes de IA com aprovação sua"],
      ["sim", "Todos os relatórios e exportações"],
      ["sim", "Atualizações e novos módulos incluídos"],
    ]),
  }),
  "story-planos-03-por-usuario": faq({
    badge: "Planos",
    q: "Preciso pagar por usuário?",
    a: `<span class="pill">Não.</span> O preço é da empresa inteira. Coloque o escritório todo, estagiário e sócio, sem mudar a conta.`,
  }),
  "story-planos-04-credito": faq({
    badge: "Planos",
    q: "O que é um crédito de IA?",
    a: `A medida de uso dos agentes. Pergunta simples gasta pouco; ler um PDF ou montar uma proposta gasta mais. A cota <span class="pill">renova todo mês</span>, e dá para comprar um pacote avulso.`,
  }),
  "story-planos-05-faixa": faq({
    badge: "Planos",
    q: "E se eu passar da faixa?",
    a: `A gente avisa antes de virar problema e você sobe de plano quando fizer sentido. <span class="pill">Sem corte de acesso</span> e sem cobrar excedente sem falar com você.`,
  }),
  "story-planos-06-planos": cta({
    badge: "Planos",
    hook: `O plano muda quanto, <span class="pill">nunca o quê</span>`,
    body: "Escolha a faixa do seu escritório e assine pelo link. Prefere ver antes? Agende uma demonstração.",
  }),

  // Gestão: o módulo, três telas, dois vídeos, enquete, convite.
  "story-gestao-01-modulo": story({
    badge: "Gestão",
    hook: `Do lead ao <span class="pill">dinheiro na conta</span>`,
    extra: lista([
      ["01", "Funil de leads", "Cada oportunidade com etapa, valor e próximo passo."],
      ["02", "Proposta e contrato", "A proposta aceita vira projeto sem redigitar."],
      ["03", "Financeiro", "Fluxo de caixa, faturas e contas do mesmo projeto."],
    ]),
  }),
  "story-gestao-02-leads": tela({
    badge: "Gestão",
    hook: `Cada lead na <span class="pill">sua etapa</span>`,
    body: "Do primeiro contato à negociação, com o valor de cada oportunidade.",
    img: "leads",
    w: 1500,
  }),
  "story-gestao-03-propostas": tela({
    badge: "Gestão",
    hook: `Toda proposta e o <span class="pill">status</span> dela`,
    body: "Rascunho, enviada ou aceita. A aceita vira projeto sem redigitar.",
    img: "propostas",
    w: 900,
    sangra: false,
  }),
  "story-gestao-05-financeiro": tela({
    badge: "Gestão",
    hook: `Quanto sobrou <span class="pill">este mês</span>`,
    body: "Lucro, receitas, despesas e o que falta receber, na mesma tela.",
    img: "financeiro",
    w: 1450,
  }),
  "story-gestao-07-enquete": enquete({
    badge: "Enquete",
    hook: `Sua proposta hoje sai <span class="pill">do Word</span>?`,
  }),
  "story-gestao-08-planos": cta({ badge: "Gestão" }),

  // Projetos: o módulo, duas telas, a passagem de bastão, enquete, convite.
  "story-projetos-01-modulo": story({
    badge: "Projetos",
    hook: `Disciplina, prazo e <span class="pill">responsável</span>`,
    extra: lista([
      ["01", "Escopo e aditivos", "O que foi contratado e o que entrou depois, separado."],
      ["02", "Cronograma por disciplina", "Concluiu uma disciplina, o próximo já sabe."],
      ["03", "Margem do projeto", "Quanto entrou e quanto custou, enquanto ele anda."],
    ]),
  }),
  "story-projetos-02-disciplinas": tela({
    badge: "Projetos",
    hook: `Cada disciplina com <span class="pill">dono e prazo</span>`,
    body: "Prioridade, status, início e previsão de cada etapa do projeto.",
    img: "disciplinas",
    w: 1550,
  }),
  "story-projetos-03-cronograma": tela({
    badge: "Projetos",
    hook: `Todos os projetos <span class="pill">numa linha do tempo</span>`,
    body: "O que está andando, o que já terminou e o que vem a seguir.",
    img: "cronograma",
    w: 1400,
  }),
  "story-projetos-04-proximo": story({
    badge: "Projetos",
    hook: `Concluiu uma disciplina, <span class="pill">o próximo já sabe</span>`,
    size: 104,
    extra: `<p class="body" style="font-size:44px">O responsável da etapa seguinte é avisado na hora. Ninguém fica esperando um e-mail para começar.</p>`,
  }),
  "story-projetos-05-enquete": enquete({
    badge: "Enquete",
    hook: `Você cobra a revisão extra ou faz <span class="pill">de graça</span>?`,
  }),
  "story-projetos-06-planos": cta({ badge: "Projetos" }),

  // Obras: o módulo, clima, diário, a dúvida do canteiro, portal do cliente, convite.
  "story-obras-01-modulo": story({
    badge: "Obras",
    hook: `A execução e a <span class="pill">conta da obra</span>`,
    extra: lista([
      ["01", "Avanço por frente", "Cada frente com seu percentual e seu prazo."],
      ["02", "Pilar Campo", "Diário, fotos e medição pelo celular. Sem sinal, sobe depois."],
      ["03", "Portal do cliente", "Andamento e parcelas por um link, sem conta e sem app."],
    ]),
  }),
  "story-obras-02-clima": tela({
    badge: "Obras",
    hook: `Vai chover na <span class="pill">concretagem</span>?`,
    body: "O cronograma cruza com a previsão do tempo e avisa antes.",
    img: "obra-clima",
    w: 1500,
  }),
  "story-obras-04-diario": tela({
    badge: "Obras",
    hook: `O canteiro conta, o diário <span class="pill">chega pronto</span>`,
    body: "O registro vira resumo do dia, e o cliente vê só o que você liberar.",
    img: "diario",
    w: 1300,
  }),
  "story-obras-06-sem-email": faq({
    badge: "Pergunta frequente",
    q: "Meu pessoal de obra não tem e-mail. Funciona?",
    a: `<span class="pill">Funciona.</span> O gestor gera usuário e senha e entrega na mão. Sem sinal, o registro fica no aparelho e sobe quando o sinal voltar.`,
  }),
  "story-obras-07-portal": story({
    badge: "Portal do cliente",
    hook: `Seu cliente acompanha <span class="pill">por um link</span>`,
    extra: marcas("", [
      ["sim", "Andamento da obra"],
      ["sim", "Parcelas e pagamentos"],
      ["sim", "O que você liberar do diário"],
      ["sim", "Sem conta e sem app"],
    ]),
  }),
  "story-obras-08-planos": cta({ badge: "Obras" }),

  // Agentes: o princípio, vídeo, as duas telas, a dúvida de confiança, convite.
  "story-agentes-01-principio": story({
    badge: "Agentes",
    hook: `A IA prepara. <span class="pill">Você aprova.</span>`,
    extra: lista([
      ["01", "Você conta o que aconteceu", "Escreve, solta o PDF do banco ou fala no canteiro."],
      ["02", "O sistema confere", "Acha o projeto, calcula a parcela, confere cada número."],
      ["03", "Nada grava sem o seu aval", "Aprovou, a margem do projeto se refaz na hora."],
    ]),
  }),
  "story-agentes-03-pendencias": tela({
    badge: "Agentes",
    hook: `O aditivo <span class="pill">chega montado</span>`,
    body: "Com o motivo e o valor. Aprovar ou rejeitar é um toque.",
    img: "pendencias",
    w: 900,
    sangra: false,
  }),
  "story-agentes-04-conversar": tela({
    badge: "Agentes",
    hook: `Pergunte, eles <span class="pill">consultam os seus dados</span>`,
    body: "Cinco agentes: Financeiro, Projetos, Comercial, Obras e Equipe.",
    img: "conversar",
    w: 900,
    sangra: false,
  }),
  "story-agentes-05-confiar": faq({
    badge: "Pergunta frequente",
    q: "Posso confiar no que a IA monta?",
    a: `A IA monta o rascunho, você revisa e confirma. <span class="pill">Nada é gravado</span> sem o seu aval, e o desfazer apaga exatamente o que aquela execução criou.`,
  }),
  "story-agentes-06-planos": cta({ badge: "Agentes" }),

  // ── Feed: primeiros posts (publicar na ordem 01 → 06) ──────────────
  // Plano, datas e legendas em brand/social/lancamento.md, seção 2. Tagline e convite seguem
  // DECISOES 2026-11-07 (frase "Gestão com agentes de IA...") e 2026-11-08 (convite "Veja os planos").

  // 01 · Só a logo, sobre a paisagem da marca.
  "post-01-logo": post({
    land: true,
    css: `.lg{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:64px;padding-bottom:300px;text-align:center}
.lg .frase{font-size:52px;line-height:1.2;font-weight:500;letter-spacing:-.02em;max-width:820px}
.cantos{position:absolute;left:90px;right:90px;bottom:64px;display:flex;justify-content:space-between;font-size:30px;font-weight:500;color:var(--ink)}`,
    body: `<div class="lg">${logoVertical(300)}<p class="frase">Gestão com agentes de IA para escritórios de engenharia e arquitetura.</p></div>
<div class="cantos"><span>pilarsoft.com.br</span><span>@pilarsoft.app</span></div>`,
  }),

  // 02 · Carrossel "Conheça a Pilar", 7 slides.
  "post-02-conheca-01-capa": post({
    body: `<span class="badge">Conheça a Pilar</span>
<div><h1 class="hook md">Gestão com agentes de IA para escritórios de engenharia e <span class="pill">arquitetura</span></h1>
<p class="body" style="margin-top:40px">O que é, como funciona e para quem é, em seis slides.</p></div>
<div style="display:flex;flex-direction:column;gap:48px"><span class="badge line" style="color:var(--ink)">Arraste &rarr;</span>${foot}</div>`,
  }),
  "post-02-conheca-02-problema": slide({
    i: 2,
    titulo: `Proposta no Word. Controle no Excel. Obra no <span class="pill">WhatsApp</span>.`,
    body: "Cada lugar guarda um pedaço. O mesmo número é digitado de novo em cada um, e o prejuízo só aparece no fim.",
  }),
  "post-02-conheca-03-gestao": slide({
    i: 3,
    n: "01",
    titulo: "Gestão: do lead ao dinheiro na conta",
    body: "Funil, proposta, contrato e financeiro. A proposta aceita vira projeto sem redigitar.",
    img: "propostas",
  }),
  "post-02-conheca-04-projetos": slide({
    i: 4,
    n: "02",
    titulo: "Projetos: disciplina, prazo e responsável",
    body: "Cada etapa com dono. Concluiu uma disciplina, o próximo já sabe.",
    img: "cronograma",
  }),
  "post-02-conheca-05-obras": slide({
    i: 5,
    n: "03",
    titulo: "Obras: a execução e a conta da obra",
    body: "Diário pelo celular, alerta de chuva no cronograma e o cliente acompanhando por um link.",
    img: "obra-clima",
  }),
  "post-02-conheca-06-agentes": slide({
    i: 6,
    titulo: `A IA prepara. O sistema confere. <span class="pill">Você aprova.</span>`,
    body: "Os agentes montam o aditivo, a parcela e o registro do dia. Nada grava sem o seu aval.",
    img: "pendencias",
  }),
  "post-02-conheca-07-final": post({
    land: true,
    body: `<span class="badge">Pilar</span>
<div style="margin-top:-80px"><h1 class="hook md">Um sistema só, do primeiro contato à <span class="pill">obra entregue</span></h1>
<p class="body" style="margin-top:40px">Usuários ilimitados, a plataforma inteira em todo plano. A partir de R$ 299 por mês.</p></div>
<div style="display:flex;flex-direction:column;gap:48px;margin-top:-140px"><span class="cta">Veja os planos · link na bio</span>${foot}</div>`,
  }),

  // 03 · Capa do Reel V-02 (os problemas). O essencial fica no miolo 3:4 do grid.
  "post-03-reel-v02-capa": reelCapa({
    badge: "Reel",
    hook: `Seu escritório roda em <span class="pill">três lugares</span>?`,
    visual: croquiTresLugares,
  }),

  // 04 · Foto-pergunta com croqui (P-01).
  "post-04-pergunta": post({
    body: `<span class="badge">Pergunta</span>
<div>${croquiRedigitado}<h1 class="hook md" style="margin-top:56px">Quantas vezes o mesmo número foi <span class="pill">digitado</span> esta semana?</h1></div>
${foot}`,
  }),

  // 05 · Capa do Reel V-03a (agentes).
  "post-05-reel-v03a-capa": reelCapa({
    badge: "Reel",
    hook: `O aditivo <span class="pill">chega pronto</span>`,
    visual: `<div class="shot"><img src="../../assets/social/lancamento/telas/pendencias.jpg"></div>`,
  }),

  // 06 · A assinatura dos agentes.
  "post-06-agentes": post({
    body: `<span class="badge">Agentes de IA</span>
<div><h1 class="hook md">A IA prepara. O sistema confere. <span class="pill">Você aprova.</span></h1>
<p class="body" style="margin-top:40px">Nada grava e nada vai ao cliente sem o seu aval. A conta não é da IA: sai do cálculo do sistema.</p></div>${foot}`,
  }),

  // ── Telas finais dos Reels (substituem o fecho antigo, de 4 caneluras) ──
  "reel-fim-v02": reelFim(
    `Gestão com agentes de IA para escritórios de engenharia e <span class="pill">arquitetura</span>.`
  ),
  "reel-fim-v03a": reelFim(`A IA prepara. O sistema confere. <span class="pill">Você aprova.</span>`),
};

const page = ({ w, h, css = "", body }) =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="social.css"><style>:root{--w:${w}px;--h:${h}px}${css}</style></head><body>${body}</body></html>`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const only = process.argv.slice(2);
for (const [nome, peca] of Object.entries(PECAS)) {
  if (only.length && !only.some((o) => nome.includes(o))) continue;
  const tmp = resolve(TPL, `_lanc-${nome}.html`);
  writeFileSync(tmp, page(peca));
  try {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: peca.w, height: peca.h });
    await p.goto(pathToFileURL(tmp).href);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: resolve(OUT, `${nome}.png`) });
    await p.close();
    console.log("ok", nome);
  } finally {
    unlinkSync(tmp);
  }
}
await browser.close();
