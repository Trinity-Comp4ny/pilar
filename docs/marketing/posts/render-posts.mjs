/**
 * Posts do feed do Instagram (@pilarsoft.app) depois do kit de lançamento: carrosséis e
 * estáticos das semanas 2 a 4 do calendário (docs/marketing/05-plano-de-marketing.md).
 *
 *   node docs/marketing/posts/render-posts.mjs            todas as peças
 *   node docs/marketing/posts/render-posts.mjs hora       só as que contêm "hora" no nome
 *
 * Usa brand/social/templates/social.css (tokens e tipografia do kit) e sai em PNG 1080 × 1350 em
 * docs/marketing/posts/out/. Regras visuais: brand/social-instagram.md. O símbolo vai numa cor
 * só (ábaco opaco), como no vídeo, por pedido do CEO em 2026-11-09.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const TPL = resolve(ROOT, "brand/social/templates");
const OUT = resolve(HERE, "out");
const STILLS = resolve(ROOT, "docs/marketing/video-v2/stills");
const HANDLE = "@pilarsoft.app";

const MARK = `<path d="M.8 .8H26.8"/><path d="M2.8 4.8H24.8"/><path d="M6.8 7.8V21.8"/><path d="M13.8 7.8V21.8"/><path d="M20.8 7.8V21.8"/>`;
const mark = (stroke = "currentColor", sw = 1.6) =>
  `<svg viewBox="0 0 27.6 22.6" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" aria-hidden="true">${MARK}</svg>`;
const foot = `<div class="foot"><span class="who">${mark()}<span>Pilar</span></span><span>${HANDLE}</span></div>`;

// Paisagem da marca (céu e três morros), a mesma do kit de lançamento e da hero da landing.
const paisagem = (w, h, topo, alt) => {
  const sx = (w / 1440).toFixed(5);
  const sy = (alt / 270).toFixed(5);
  const m = (d, f, op) => `<path d="${d}" fill="url(#${f})" opacity="${op}" transform="translate(0 ${topo}) scale(${sx} ${sy})"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" style="position:absolute;inset:0"><defs>
<linearGradient id="lc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="62%" stop-color="#EFF9FB"/><stop offset="100%" stop-color="#A6EC88" stop-opacity="0.22"/></linearGradient>
<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#AEE0CF"/><stop offset="100%" stop-color="#A6EC88" stop-opacity="0.7"/></linearGradient>
<linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#A6EC88"/><stop offset="100%" stop-color="#AED651"/></linearGradient>
<linearGradient id="g3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#89C841"/><stop offset="100%" stop-color="#598A38"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#lc)"/>
${m("M0 100 C160 50 260 74 400 62 C560 48 640 0 800 16 C960 32 1060 70 1200 58 C1320 48 1380 66 1440 78 V270 H0Z", "g1", 0.75)}
${m("M0 162 C180 124 300 152 460 140 C620 128 720 92 880 110 C1020 126 1140 154 1280 142 C1350 136 1400 146 1440 154 V270 H0Z", "g2", 0.8)}
${m("M0 216 C200 188 340 210 520 202 C700 194 800 168 980 182 C1140 194 1260 212 1440 204 V270 H0Z", "g3", 0.72)}
<rect y="${topo + alt - 1}" width="${w}" height="${Math.max(0, h - topo - alt + 1)}" fill="#7DA74A"/></svg>`;
};

// *palavra* vira a pílula verde (uma por peça)
const hl = (t) => t.replace(/\*(.+?)\*/g, '<span class="pill">$1</span>');

// recorte de uma tela real (px CSS da tela 1440 × 900), como imagem com borda e sombra
const tela = (still, r, w) => {
  const k = w / r.w;
  return `<div class="tela" style="width:${w}px;height:${Math.round(r.h * k)}px;background-image:url(${pathToFileURL(resolve(STILLS, still + ".jpg"))});background-size:${1440 * k}px ${900 * k}px;background-position:${-r.x * k}px ${-r.y * k}px"></div>`;
};

const css = `
.canvas.land{background:transparent}
.canvas.land>.foot,.canvas.land>*{position:relative}
.prog{display:flex;gap:10px}.prog i{height:6px;flex:1;border-radius:3px;background:var(--line)}.prog i.on{background:var(--ink)}
.num{font-size:120px;font-weight:300;letter-spacing:-.04em;line-height:1;color:var(--ink)}
.big{font-size:200px;font-weight:500;letter-spacing:-.05em;line-height:.95;font-variant-numeric:tabular-nums}
.big.red{color:#DC2626}
.ex{font-size:28px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.title{font-size:72px;font-weight:500;letter-spacing:-.03em;line-height:1.06}
.stack{display:flex;flex-direction:column;gap:36px}
.tela{border-radius:22px;box-shadow:0 0 0 2px #E6E6E6,0 30px 60px -30px rgba(26,40,20,.35);background-repeat:no-repeat;background-color:#fff}
.cta{display:inline-flex;width:fit-content;align-items:center;gap:18px;height:96px;padding:0 46px;border-radius:999px;background:var(--ink);color:#fff;font-size:38px;font-weight:500}
.chk{display:flex;flex-direction:column;border-top:2px solid var(--line)}
.chk div{display:flex;gap:28px;align-items:center;padding:30px 0;border-bottom:2px solid var(--line);font-size:40px;line-height:1.25}
.chk b{flex:none;width:56px;height:56px;border-radius:14px;border:3px solid var(--ink);display:grid;place-items:center;font-size:34px}
.sum{font-size:44px;line-height:1.35;font-variant-numeric:tabular-nums}
.sum .row{border-bottom:2px solid var(--line);padding:22px 0}.sum .row:last-child{border:0;font-weight:600}
.bubble{background:#ECECEC;border-radius:30px;padding:30px 36px;font-size:40px;line-height:1.35;align-self:flex-end;max-width:820px}
.card{background:#fff;border-radius:30px;box-shadow:0 0 0 2px #E6E6E6;padding:34px 38px;font-size:36px}
.card .r{display:flex;justify-content:space-between;padding:18px 0;border-bottom:2px solid #EFEFEF}.card .r:last-child{border:0}
.card .k{color:var(--muted)}
.ok{display:inline-flex;align-items:center;gap:10px;font-size:26px;font-weight:600;color:#166534;background:#DCFCE7;border-radius:999px;padding:8px 18px}
`;

const page = (body, { land = false, ink = false } = {}) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(resolve(TPL, "social.css"))}"><style>${css}</style></head><body>
${land ? paisagem(1080, 1350, 1000, 300) : ""}<div class="canvas${land ? " land" : ""}${ink ? " ink" : ""}">${body}</div></body></html>`;

const prog = (i, n) => `<div class="prog">${Array.from({ length: n }, (_, k) => `<i class="${k < i ? "on" : ""}"></i>`).join("")}</div>`;

// ---------------- peças ----------------
const POSTS = {};

/* Carrossel 1 · Conta aberta: quanto custa a hora do sócio (território "conta aberta") */
{
  const N = 6;
  POSTS["c1-hora-do-socio-01-capa"] = page(
    `<div class="stack"><span class="badge">Conta aberta</span>
     <div class="hook">Quanto custa uma ${hl("*hora*")} do sócio?</div><p class="body">A conta em quatro linhas, com número de exemplo. Troque pelos do seu escritório.</p></div>
     <div class="row"><span class="badge line" style="font-size:26px">Arraste →</span></div>${foot}`,
    { land: true },
  );
  const item = (i, ex, num, big, red, title, body) =>
    page(`${prog(i, N)}<div class="stack"><span class="num">${num}</span><span class="ex">${ex}</span>
      <div class="big${red ? " red" : ""}">${big}</div><div class="title">${title}</div><p class="body">${body}</p></div>${foot}`);
  POSTS["c1-hora-do-socio-02"] = item(1, "Exemplo", "01", "R$ 24.000", false, "O que o sócio tira por mês", "Pró-labore mais a distribuição média. É o custo dele para o escritório.");
  POSTS["c1-hora-do-socio-03"] = item(2, "Exemplo", "02", "140 h", false, "As horas que viram trabalho", "Das 176 h do mês, tire reunião, deslocamento e imprevisto.");
  POSTS["c1-hora-do-socio-04"] = item(3, "R$ 24.000 ÷ 140 h", "03", "R$ 171", false, "Cada hora do sócio", "É o que custa cada hora que ele passa fora da engenharia.");
  POSTS["c1-hora-do-socio-05"] = item(4, "6 h × 4,3 semanas × R$ 171", "04", "R$ 4.400", true, "Por mês, em retrabalho", "Seis horas por semana redigitando proposta na planilha, cobrando status e montando relatório.");
  POSTS["c1-hora-do-socio-06-final"] = page(
    `${prog(6, N)}<div class="stack"><span class="badge">A conta que importa</span>
     <div class="hook md">Devolver ${hl("*2_horas*").replace("_", " ")} por semana já paga o sistema.</div>
     <div class="sum"><div class="row" style="display:flex;justify-content:space-between"><span>2 h × 4,3 × R$ 171</span><span>R$ 1.470/mês</span></div>
     <div class="row" style="display:flex;justify-content:space-between"><span>Plano Profissional da Pilar</span><span>R$ 499/mês</span></div></div></div>
     <span class="cta">Veja os planos · link na bio</span>${foot}`,
    { land: true },
  );
}

/* Carrossel 2 · Dica: 5 sinais de que o escritório passou da planilha (território "dor nomeada") */
{
  const N = 7;
  POSTS["c2-cinco-sinais-01-capa"] = page(
    `<div class="stack"><span class="badge">Checklist</span>
     <div class="hook">5 sinais de que seu escritório ${hl("*passou*")} da planilha</div>
     <p class="body">Conte quantos você reconhece.</p></div>
     <div class="row"><span class="badge line" style="font-size:26px">Arraste →</span></div>${foot}`,
    { land: true },
  );
  const sinais = [
    ["Ninguém sabe qual é a versão certa", "Controle_v7_FINAL (2).xlsx, e cada um atualiza a sua."],
    ["O prejuízo aparece quando o projeto acaba", "A hora estourou em junho, a conta chegou em novembro."],
    ["O cliente liga para saber como está", "E alguém para o que estava fazendo para montar a resposta."],
    ["Proposta aceita vira digitação de novo", "Disciplinas, valores e parcelas, redigitados no controle e no financeiro."],
    ["O diário da obra está no WhatsApp", "Foto, áudio e recado no grupo. Na hora do relatório, ninguém acha."],
  ];
  sinais.forEach(([t, b], i) => {
    POSTS[`c2-cinco-sinais-0${i + 2}`] = page(
      `${prog(i + 1, N)}<div class="stack"><span class="num">0${i + 1}</span><div class="title" style="font-size:84px">${t}</div><p class="body">${b}</p></div>${foot}`,
    );
  });
  POSTS["c2-cinco-sinais-07-final"] = page(
    `${prog(7, N)}<div class="stack"><span class="badge">Resultado</span>
     <div class="hook md">Três ou mais? O escritório cresceu e o ${hl("*controle*")} ficou para trás.</div>
     <p class="body">A Pilar junta proposta, projeto, obra e financeiro num sistema só, com usuários ilimitados em todo plano.</p></div>
     <span class="cta">Veja os planos · link na bio</span>${foot}`,
    { land: true },
  );
}

/* Carrossel 3 · Agentes na prática: como a IA trabalha na Pilar (com tela real) */
{
  const N = 6;
  POSTS["c3-como-a-ia-trabalha-01-capa"] = page(
    `<div class="stack"><span class="badge">Agentes de IA</span>
     <div class="hook md">A IA prepara. O sistema confere. ${hl("*Você aprova.*")}</div>
     <p class="body">Como funciona, em quatro passos, com a tela real.</p></div>
     <div class="row"><span class="badge line" style="font-size:26px">Arraste →</span></div>${foot}`,
    { land: true },
  );
  POSTS["c3-como-a-ia-trabalha-02"] = page(
    `${prog(1, N)}<div class="stack"><span class="num">01</span><div class="title">Você conta como falaria</div>
     <div class="bubble">Recebi 128 mil do centro cirúrgico, primeira de três parcelas</div>
     <p class="body">Na aba Agentes, sem formulário.</p></div>${foot}`,
  );
  POSTS["c3-como-a-ia-trabalha-03"] = page(
    `${prog(2, N)}<div class="stack"><span class="num">02</span><div class="title">A IA prepara o lançamento</div>
     <div class="card"><div class="r"><span class="k">Projeto</span><span>Climatização, centro cirúrgico</span></div>
     <div class="r"><span class="k">Valor</span><span>R$ 128.400,00</span></div><div class="r"><span class="k">Parcela</span><span>1 de 3, vence 18/09</span></div></div>
     <p class="body">Ela acha o projeto pelo nome e mostra antes de gravar.</p></div>${foot}`,
  );
  POSTS["c3-como-a-ia-trabalha-04"] = page(
    `${prog(3, N)}<div class="stack"><span class="num">03</span><div class="title">O sistema confere</div>
     <div class="stack" style="gap:18px"><span class="ok">✓ Projeto encontrado pelo nome</span><span class="ok">✓ Parcela calculada pelo contrato</span><span class="ok">✓ Categoria do seu plano de contas</span></div>
     <p class="body">A conta não é da IA: sai do cálculo do sistema.</p></div>${foot}`,
  );
  POSTS["c3-como-a-ia-trabalha-05"] = page(
    `${prog(4, N)}<div class="stack"><span class="num">04</span><div class="title">Você aprova. Só então grava.</div>
     ${tela("pendencias", { x: 488, y: 365, w: 738, h: 212 }, 900)}
     <p class="body">Vale para o aditivo também: ele chega pronto, citando as despesas de cada valor.</p></div>${foot}`,
  );
  POSTS["c3-como-a-ia-trabalha-06-final"] = page(
    `${prog(6, N)}<div class="stack"><span class="badge">O que já roda hoje</span>
     <div class="chk"><div><b>✓</b>Lançamento, lead e projeto a partir do que você conta</div><div><b>✓</b>Aditivo quando o projeto passa do orçamento</div><div><b>✓</b>Resumo da semana com número conferido</div><div><b>✓</b>Diário da obra organizado a partir do áudio</div></div></div>
     <span class="cta">Veja os planos · link na bio</span>${foot}`,
    { land: true },
  );
}

/* Carrossel 4 · Conta aberta: quanto cobrar por um projeto, disciplina por disciplina.
   Conta conferida: 420 h × R$ 95 = R$ 39.900; ÷ (1 − 15% − 25%) = R$ 66.500
   (impostos R$ 9.975 + lucro R$ 16.625 + custo R$ 39.900 = R$ 66.500). Números de exemplo. */
{
  const N = 7;
  POSTS["c4-preco-por-disciplina-01-capa"] = page(
    `<div class="stack"><span class="badge">Conta aberta</span>
     <div class="hook md">Quanto cobrar por um projeto, ${hl("*disciplina*")} por disciplina?</div>
     <p class="body">O método em cinco passos, com números de exemplo. Troque pelos do seu escritório.</p></div>
     <div class="row"><span class="badge line" style="font-size:26px">Arraste →</span></div>${foot}`,
    { land: true },
  );
  const item = (i, num, title, inner, body) =>
    page(`${prog(i, N)}<div class="stack"><span class="num">${num}</span><div class="title">${title}</div>${inner}<p class="body">${body}</p></div>${foot}`);
  const linhas = (rows, total) =>
    `<div class="sum">${rows.map(([a, b]) => `<div class="row" style="display:flex;justify-content:space-between"><span>${a}</span><span>${b}</span></div>`).join("")}${total ? `<div class="row" style="display:flex;justify-content:space-between"><span>${total[0]}</span><span>${total[1]}</span></div>` : ""}</div>`;
  POSTS["c4-preco-por-disciplina-02"] = item(1, "01", "Estime as horas de cada disciplina",
    linhas([["Estrutural", "220 h"], ["Hidrossanitário", "90 h"], ["Elétrico", "110 h"]], ["Total", "420 h"]),
    "Use o histórico dos projetos parecidos, não o feeling.");
  POSTS["c4-preco-por-disciplina-03"] = item(2, "02", "Descubra o custo da hora da equipe",
    `<div class="big" style="font-size:170px">R$ 95</div>`,
    "Salários, encargos e o rateio do escritório (aluguel, software, contador), divididos pelas horas que viram projeto.");
  POSTS["c4-preco-por-disciplina-04"] = item(3, "03", "Calcule o custo do projeto",
    linhas([["420 h × R$ 95", ""]], ["Custo", "R$ 39.900"]),
    "É o que o projeto custa para o escritório, antes de imposto e de lucro.");
  POSTS["c4-preco-por-disciplina-05"] = item(4, "04", "Ponha imposto e lucro por dentro",
    linhas([["Custo ÷ (1 − 15% − 25%)", ""], ["Impostos (15%)", "R$ 9.975"], ["Lucro (25%)", "R$ 16.625"]], ["Preço", "R$ 66.500"]),
    "Somar 40% em cima do custo dá menos: o imposto incide sobre o preço, não sobre o custo.");
  POSTS["c4-preco-por-disciplina-06"] = item(5, "05", "Acompanhe as horas reais",
    `<div class="big red" style="font-size:150px">+40 h</div>`,
    "Se o estrutural passou de 220 h, ou é aditivo ou é lucro indo embora. Descobrir no fim não adianta.");
  POSTS["c4-preco-por-disciplina-07-final"] = page(
    `${prog(7, N)}<div class="stack"><span class="badge">Na Pilar</span>
     <div class="hook md">As horas de cada disciplina, contra o orçado, ${hl("*durante*")} o projeto.</div>
     <p class="body">Passou do orçamento? A Pilar prepara o aditivo, citando as despesas de cada valor. Você aprova.</p></div>
     <span class="cta">Veja os planos · link na bio</span>${foot}`,
    { land: true },
  );
}

/* Estático 1 · Número: 4× (território "dor nomeada") */
POSTS["e1-numero-4x"] = page(
  `<div class="stack"><span class="badge">O dado redigitado</span>
   <div class="big" style="font-size:300px">4×</div>
   <div class="title">O mesmo valor de contrato, digitado na proposta, na planilha, no financeiro e no WhatsApp.</div>
   <p class="body">Cada redigitação é uma hora do sócio e um erro possível.</p></div>${foot}`,
  { land: true },
);

/* Estático 2 · Pergunta: concretagem e chuva (território "obra e clima") */
POSTS["e2-pergunta-chuva"] = page(
  `<span class="badge">Pergunta</span>
   <div class="card" style="display:flex;gap:34px;align-items:center;font-size:34px">
     <div style="width:120px;height:120px;border-radius:30px;background:#FEF3C7;display:grid;place-items:center;font-size:72px">⛈</div>
     <div><div class="ex">Concretagem da laje · Sáb 07/11</div><div style="font-size:64px;font-weight:600;color:#B45309;margin-top:6px">94% <span style="font-size:32px;font-weight:500;color:#3D3D3D">de trovoada</span></div></div></div>
   <div class="hook md">Quem marcou a concretagem para o dia da ${hl("*chuva*")}?</div>
   ${foot}`,
  { land: true },
);

/* Estático 3 · Posicionamento: para quem projeta (território "base") */
POSTS["e3-para-quem-projeta"] = page(
  `<div class="stack"><span class="badge">Para quem é</span>
   <div class="hook md">Software de obra é feito para construtora. A Pilar é feita para quem ${hl("*projeta*")}.</div>
   <p class="body">Escritórios de engenharia e arquitetura que vendem projeto por disciplina e acompanham a obra do próprio projeto.</p></div>
   ${foot}`,
  { land: true },
);

// ---------------- render ----------------
const filtro = process.argv[2];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
for (const [name, html] of Object.entries(POSTS)) {
  if (filtro && !name.includes(filtro)) continue;
  const tmp = resolve(TPL, `_tmp-${name}.html`);
  writeFileSync(tmp, html);
  await pg.goto(pathToFileURL(tmp).href);
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: resolve(OUT, `${name}.png`) });
  unlinkSync(tmp);
  console.log("ok", name);
}
await browser.close();
