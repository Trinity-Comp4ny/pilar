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
// a pontuação logo depois da pílula vai junto com ela (não cai sozinha na linha de baixo)
const hl = (t) => t.replace(/\*(.+?)\*([.,!?:;]?)/g, '<span style="white-space:nowrap"><span class="pill">$1</span>$2</span>');

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

/* ============ Leva 3 (10/11): layouts variados, não só o modelo de carrossel ============ */

/* Carrossel 5 · Mito × fato sobre IA: tela dividida (escuro em cima, claro embaixo) */
{
  const N = 6;
  const split = (i, mito, fato) =>
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(resolve(TPL, "social.css"))}"><style>${css}
      .half{position:absolute;left:0;right:0;padding:0 90px;display:flex;flex-direction:column;justify-content:center;gap:26px}
      .tag{font-size:30px;font-weight:600;letter-spacing:.12em;text-transform:uppercase}
      .t{font-size:66px;font-weight:500;letter-spacing:-.03em;line-height:1.08}</style></head><body>
      <div class="half" style="top:0;height:675px;background:#1A1A1A;color:#fff">${i ? `<div class="prog" style="position:absolute;top:120px;left:90px;right:90px">${Array.from({ length: N }, (_, k) => `<i style="background:${k < i ? "#fff" : "#3a3a3a"}"></i>`).join("")}</div>` : ""}
        <span class="tag" style="color:#F87171">✕ Mito</span><div class="t" style="color:#d8d8d8;text-decoration:line-through;text-decoration-thickness:4px;text-decoration-color:#F87171">${mito}</div></div>
      <div class="half" style="top:675px;height:675px;background:#FCFCFC"><span class="tag" style="color:#15803D">✓ Fato</span><div class="t">${fato}</div>
        <div style="position:absolute;left:90px;right:90px;bottom:90px">${foot}</div></div></body></html>`;
  POSTS["c5-mito-fato-01-capa"] = page(
    `<div class="stack"><span class="badge">Mito × fato</span><div class="hook">4 mitos sobre ${hl("*IA*")} no escritório de engenharia</div>
     <p class="body">E o que acontece de verdade na Pilar.</p></div><div class="row"><span class="badge line" style="font-size:26px">Arraste →</span></div>${foot}`,
    { land: true },
  );
  POSTS["c5-mito-fato-02"] = split(1, "A IA vai decidir pelo engenheiro.", "A IA prepara. Você aprova. Nada grava sem o seu ok.");
  POSTS["c5-mito-fato-03"] = split(2, "A IA inventa número.", "A conta é do sistema: projeto, valor e parcela são conferidos antes de chegar a você.");
  POSTS["c5-mito-fato-04"] = split(3, "Precisa aprender a mexer em IA.", "Você escreve como falaria: “recebi 128 mil do centro cirúrgico”.");
  POSTS["c5-mito-fato-05"] = split(4, "IA é coisa de escritório grande.", "Usuários ilimitados em todo plano, a partir de R$ 299 por mês.");
  POSTS["c5-mito-fato-06-final"] = page(
    `${prog(6, N)}<div class="stack"><span class="badge">Resumo</span><div class="hook md">A IA prepara. O sistema confere. ${hl("*Você_aprova.*").replace("_", " ")}</div></div>
     <span class="cta">Veja os planos · link na bio</span>${foot}`,
    { land: true },
  );
}

/* Carrossel 6 · O que a Pilar NÃO faz (lição da Attio: dizer o que a IA não muda). Fundo tinta. */
{
  const N = 7;
  const nao = (i, t, b) =>
    page(`<div class="prog">${Array.from({ length: N }, (_, k) => `<i style="background:${k < i ? "#fff" : "#3a3a3a"}"></i>`).join("")}</div>
      <div class="stack"><div style="font-size:220px;font-weight:600;letter-spacing:-.06em;line-height:.9;color:#A4EC86">Não.</div>
      <div class="title" style="color:#fff">${t}</div><p class="body">${b}</p></div>${foot}`, { ink: true });
  POSTS["c6-o-que-nao-faz-01-capa"] = page(
    `<span class="badge">Transparência</span><div class="hook" style="color:#fff">O que a Pilar ${hl("*não*")} faz.</div>
     <p class="body">Cinco limites de propósito. É por eles que dá para confiar no resto.</p>${foot}`,
    { ink: true },
  );
  POSTS["c6-o-que-nao-faz-02"] = nao(1, "Não aprova nada por você.", "A Pilar prepara o lançamento, o aditivo e o resumo. Quem aprova é você.");
  POSTS["c6-o-que-nao-faz-03"] = nao(2, "Não manda nada ao cliente sem o seu ok.", "O registro da obra nasce interno. Só vai ao portal quando você liberar.");
  POSTS["c6-o-que-nao-faz-04"] = nao(3, "Não inventa número.", "Valor, parcela e categoria saem do cálculo do sistema, não do texto da IA.");
  POSTS["c6-o-que-nao-faz-05"] = nao(4, "Não assina a ART nem o RRT.", "A responsabilidade técnica é de quem projeta. A Pilar cuida da gestão em volta.");
  POSTS["c6-o-que-nao-faz-06"] = nao(5, "Não cobra por usuário.", "O estagiário, o mestre de obras e o sócio entram no mesmo plano.");
  POSTS["c6-o-que-nao-faz-07-final"] = page(
    `<div class="stack"><span class="badge">O que ela faz</span><div class="hook md">Prepara o trabalho repetitivo. ${hl("*Você_decide.*").replace("_", " ")}</div>
     <p class="body">Gestão com agentes de IA para escritórios de engenharia e arquitetura.</p></div>
     <span class="cta">Veja os planos · link na bio</span>${foot}`,
    { land: true },
  );
}

/* Carrossel 7 · Checklist antes de começar um projeto (para salvar) */
{
  const itens = [
    ["Contrato com escopo por disciplina", "O que está dentro e o que está fora, escrito."],
    ["ART ou RRT registrada", "ART no CREA (engenharia), RRT no CAU (arquitetura), antes de começar."],
    ["Número de revisões combinado", "Quantas estão incluídas. A partir daí, é aditivo."],
    ["Cronograma com marcos de entrega", "Uma data por entrega, não só a data final."],
    ["Parcelas ligadas às entregas", "Entregou o anteprojeto, fatura a parcela 2."],
    ["Um responsável por disciplina", "Quem responde pelo estrutural, pelo elétrico, pelo hidrossanitário."],
  ];
  POSTS["c7-checklist-inicio-01-capa"] = page(
    `<div class="stack"><span class="badge">Salve este post</span><div class="hook md">6 coisas para ter ${hl("*antes*")} de começar um projeto</div>
     <p class="body">O checklist que evita a revisão de graça e a parcela atrasada.</p></div>
     <div class="row"><span class="badge line" style="font-size:26px">Arraste →</span></div>${foot}`,
    { land: true },
  );
  const lista = (part, n) =>
    page(
      `<span class="badge">Checklist · ${n} de 2</span><div class="chk">${part
        .map(([t, b]) => `<div style="align-items:flex-start;padding:40px 0"><b>✓</b><span><span style="font-weight:600;font-size:46px">${t}</span><br><span style="font-size:36px;color:var(--ink-soft)">${b}</span></span></div>`)
        .join("")}</div>${foot}`,
    );
  POSTS["c7-checklist-inicio-02-lista"] = lista(itens.slice(0, 3), 1);
  POSTS["c7-checklist-inicio-03-lista"] = lista(itens.slice(3), 2);
  POSTS["c7-checklist-inicio-04-final"] = page(
    `<div class="stack"><span class="badge">Na Pilar</span><div class="hook md">Proposta aceita vira projeto com disciplinas, responsáveis e ${hl("*parcelas*")}.</div>
     <p class="body">Sem redigitar o que já estava na proposta.</p></div>
     <span class="cta">Veja os planos · link na bio</span>${foot}`,
    { land: true },
  );
}

/* Carrossel 8 · Aditivo sem perder o cliente: 5 passos */
{
  const N = 7;
  POSTS["c8-aditivo-01-capa"] = page(
    `<div class="stack"><span class="badge">Conta aberta</span><div class="hook md">Como pedir um ${hl("*aditivo*")} sem perder o cliente</div>
     <p class="body">Cinco passos. O segredo é a base, não a coragem.</p></div>
     <div class="row"><span class="badge line" style="font-size:26px">Arraste →</span></div>${foot}`,
    { land: true },
  );
  const passos = [
    ["Combine no contrato", "Quantas revisões estão incluídas. O resto já nasce como aditivo, não como favor."],
    ["Registre o pedido no dia", "Data, quem pediu e o que muda. Pedido de corredor some na memória."],
    ["Estime antes de fazer", "Horas a mais por disciplina. Depois de feito, vira briga."],
    ["Mostre a base", "Horas, despesas e o porquê de cada valor. Número sem base parece cobrança."],
    ["Comece depois do ok", "Por escrito. É o que transforma pedido em receita."],
  ];
  passos.forEach(([t, b], i) => {
    POSTS[`c8-aditivo-0${i + 2}`] = page(
      `${prog(i + 1, N)}<div class="stack"><span class="num">0${i + 1}</span><div class="title" style="font-size:84px">${t}</div><p class="body">${b}</p></div>${foot}`,
    );
  });
  POSTS["c8-aditivo-07-final"] = page(
    `${prog(7, N)}<div class="stack"><span class="badge">Na Pilar</span><div class="hook md">Passou do orçado? O aditivo chega ${hl("*pronto*")}, citando as despesas.</div>
     <p class="body">Você revisa, aprova e manda. Nada vai ao cliente sem o seu ok.</p></div>
     <span class="cta">Veja os planos · link na bio</span>${foot}`,
    { land: true },
  );
}

/* Estático 4 · Assinatura em tipografia grande, sobre tinta */
POSTS["e4-assinatura"] = page(
  `<span class="badge">Pilar</span>
   <div style="font-size:150px;font-weight:600;letter-spacing:-.055em;line-height:.98;color:#fff">A IA<br>prepara.<br><span style="color:#8a8a8a">O sistema<br>confere.</span><br><span style="color:#A4EC86;font-style:italic">Você<br>aprova.</span></div>${foot}`,
  { ink: true },
);

/* Estático 5 · O arquivo (humor, pede marcação) */
POSTS["e5-arquivo-final"] = page(
  `<span class="badge">Marque quem tem</span>
   <div style="display:flex;flex-direction:column;align-items:center;gap:40px">
     <div style="width:300px;height:380px;border-radius:24px;background:#fff;box-shadow:0 0 0 3px #E2E2E2,0 40px 60px -30px rgba(0,0,0,.35);position:relative;display:grid;place-items:center">
       <div style="position:absolute;top:0;right:0;width:90px;height:90px;background:linear-gradient(225deg,#FCFCFC 50%,#E2E2E2 50%);border-bottom-left-radius:18px"></div>
       <div style="width:170px;height:170px;border-radius:20px;background:#DCFCE7;display:grid;place-items:center;font:700 80px Geist;color:#15803D">X</div></div>
     <div style="font-size:52px;font-weight:600;letter-spacing:-.02em;text-align:center">Controle_projetos_<br>FINAL_v7 (2) - Cópia.xlsx</div></div>
   <div class="hook sm" style="text-align:center">Todo escritório tem ${hl("*um*")}.</div>${foot}`,
  { land: true },
);

/* Estático 6 · Enquete nos comentários */
POSTS["e6-enquete-margem"] = page(
  `<span class="badge">Responda nos comentários</span>
   <div class="hook md">Você sabe a margem de ${hl("*cada*")} disciplina do projeto?</div>
   <div class="stack" style="gap:20px">${["A · Sim, toda semana", "B · No fim do projeto", "C · Sinceramente, não"]
     .map((t) => `<div style="border:3px solid #1A1A1A;border-radius:999px;padding:26px 40px;font-size:44px;font-weight:500">${t}</div>`)
     .join("")}</div>${foot}`,
);

/* Estático 7 · O que mudou na Pilar esta semana (lição do Linear: changelog fixo, toda sexta) */
POSTS["e7-novidades-2026-11-14"] = page(
  `<div class="row"><span class="badge">Novidades da semana</span><span style="font-size:30px;font-weight:500;color:var(--muted)">14/11/2026</span></div>
   <div class="hook sm">O que mudou na ${hl("*Pilar*")} esta semana</div>
   <div class="chk">${[
     ["@ chega por e-mail na hora", "Marcou alguém num comentário? Ela recebe no mesmo instante."],
     ["Cadastrou na Equipe, já tem acesso", "O convite sai junto com o cadastro."],
     ["Produtividade em % do projeto", "A folha paga a produção como percentual do valor do projeto."],
     ["A pagar e A receber, lado a lado", "Novas visões do financeiro, com painel lateral."],
   ]
     .map(([t, b]) => `<div style="align-items:flex-start;font-size:40px;padding:24px 0"><b style="width:52px;height:52px;font-size:30px;background:#A4EC86;border:0">+</b><span><span style="font-weight:600">${t}</span><br><span style="font-size:32px;color:var(--ink-soft)">${b}</span></span></div>`)
     .join("")}</div>${foot}`,
);

/* Estático 8 · Preço, direto */
POSTS["e8-preco"] = page(
  `<span class="badge">Planos</span>
   <div class="stack" style="gap:10px"><span class="ex">a partir de</span><div class="big" style="font-size:260px">R$ 299</div><span style="font-size:44px;font-weight:500">por mês, por escritório.</span></div>
   <div class="chk" style="border-top:0">${["Usuários ilimitados", "A plataforma inteira em todo plano", "O plano muda quanto, nunca o quê"].map((t) => `<div style="padding:18px 0;font-size:38px"><b style="width:44px;height:44px;font-size:26px">✓</b>${t}</div>`).join("")}</div>
   <span class="cta">Veja os planos · link na bio</span>${foot}`,
  { land: true },
);

/* Estático 9 · Posicionamento: engenharia não é interiores (verde cheio) */
POSTS["e9-engenharia-nao-e-interiores"] = page(
  `<span class="badge" style="background:#1A1A1A;color:#fff">Para quem é</span>
   <div style="font-size:120px;font-weight:600;letter-spacing:-.05em;line-height:1">Gestão de escritório não é só ${'<span style="font-style:italic;text-decoration:line-through;text-decoration-thickness:8px">interiores</span>'}.</div>
   <p class="body" style="color:#1A1A1A">Estrutural, MEP, hidrossanitário, elétrico. Quem projeta por disciplina também precisa de lucro na tela.</p>${foot}`,
).replace('<div class="canvas">', '<div class="canvas" style="background:linear-gradient(165deg,#D4F7C3 0%,#A4EC86 60%,#8FD46A 100%)">');

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

/* ============ Leva 4 (10/11): mais carrosséis, posts e os stories ============ */

const itemPage = (i, N, num, title, body, extra = "") =>
  page(`${prog(i, N)}<div class="stack"><span class="num">${num}</span><div class="title" style="font-size:80px">${title}</div>${extra}<p class="body">${body}</p></div>${foot}`);
const capa = (badge, hook, body) =>
  page(`<div class="stack"><span class="badge">${badge}</span><div class="hook md">${hook}</div><p class="body">${body}</p></div>
    <div class="row"><span class="badge line" style="font-size:26px">Arraste →</span></div>${foot}`, { land: true });
const final = (N, badge, hook, body) =>
  page(`${prog(N, N)}<div class="stack"><span class="badge">${badge}</span><div class="hook md">${hook}</div><p class="body">${body}</p></div>
    <span class="cta">Veja os planos · link na bio</span>${foot}`, { land: true });
const serie = (slug, N, capaArgs, itens, finalArgs) => {
  POSTS[`${slug}-01-capa`] = capa(...capaArgs);
  itens.forEach(([t, b, extra], i) => (POSTS[`${slug}-${String(i + 2).padStart(2, "0")}`] = itemPage(i + 1, N, String(i + 1).padStart(2, "0"), t, b, extra || "")));
  POSTS[`${slug}-${String(itens.length + 2).padStart(2, "0")}-final`] = final(N, ...finalArgs);
};

/* C9 · Honorário: por m², por hora ou por disciplina */
serie("c9-honorario", 6,
  ["Conta aberta", `Honorário: por m², por hora ou por ${hl("*disciplina*")}?`, "Os três jeitos de cobrar projeto, sem romantizar nenhum."],
  [
    ["Por m²", "Simples de explicar ao cliente. Mas ignora a complexidade: o m² de um hospital não é o m² de um galpão."],
    ["Por hora", "Justo com o escritório. Mas o cliente não gosta de conta aberta, e a negociação vira desconfiança."],
    ["Por disciplina", "Um preço por entrega (estrutural, elétrico, hidrossanitário), com as horas estimadas por trás de cada um."],
    ["O que muda o jogo", "Qualquer modelo funciona se você comparar a hora real com a estimada durante o projeto. É aí que mora o lucro."],
  ],
  ["Na Pilar", `Orçamento por disciplina e hora real ${hl("*lado_a_lado*").replace("_", " ").replace("_", " ")}.`, "Passou do estimado? O aditivo chega pronto, com a base."]);

/* C10 · Curva S em 5 slides */
serie("c10-curva-s", 6,
  ["Explicado", `A ${hl("*curva_S*").replace("_", " ")} em cinco slides`, "O gráfico que mostra se a obra está no ritmo, antes de virar atraso."],
  [
    ["O que é", "O avanço acumulado da obra no tempo. Começa devagar, acelera no meio e desacelera no fim: por isso o S."],
    ["Planejado × realizado", "Duas curvas no mesmo gráfico: a que você combinou e a que está acontecendo."],
    ["Como ler", "Realizado abaixo do planejado é atraso. A distância entre as curvas é o tamanho do problema."],
    ["Quando se preocupar", "Quando a distância cresce semana após semana. Uma semana ruim é ruído; três seguidas é tendência."],
  ],
  ["Na Pilar", `A curva S de cada obra, ${hl("*atualizada*")} pelo cronograma.`, "Planejado e realizado no mesmo gráfico, sem planilha paralela."]);

/* C11 · 7 documentos que todo projeto deveria ter */
{
  const docs = [
    ["Contrato assinado", "Com o escopo por disciplina."],
    ["Proposta aceita", "A versão que o cliente aprovou, com data."],
    ["ART ou RRT", "Registrada antes de começar."],
    ["Cronograma", "Com os marcos de entrega."],
    ["Registro de pedidos de revisão", "Quem pediu, quando e o que muda."],
    ["Diário da obra", "Quando o escritório acompanha a execução."],
    ["Termo de entrega", "O aceite do cliente em cada etapa."],
  ];
  POSTS["c11-sete-documentos-01-capa"] = capa("Salve este post", `7 documentos que todo projeto ${hl("*deveria*")} ter`, "Quando o cliente questiona, é isso que te protege.");
  const lst = (part, n, off) => page(`<span class="badge">Os 7 documentos · ${n} de 2</span><div class="chk">${part.map(([t, b], i) => `<div style="align-items:flex-start;padding:34px 0"><b style="font-size:30px">${off + i + 1}</b><span><span style="font-weight:600;font-size:46px">${t}</span><br><span style="font-size:36px;color:var(--ink-soft)">${b}</span></span></div>`).join("")}</div>${foot}`);
  POSTS["c11-sete-documentos-02"] = lst(docs.slice(0, 4), 1, 0);
  POSTS["c11-sete-documentos-03"] = lst(docs.slice(4), 2, 4);
  POSTS["c11-sete-documentos-04-final"] = final(4, "Na Pilar", `Proposta, projeto, diário e financeiro no ${hl("*mesmo*")} lugar.`, "O histórico do projeto não depende da memória de ninguém.");
}

/* C12 · De 5 para 15 pessoas: o que quebra primeiro */
serie("c12-crescer", 7,
  ["Gestão", `De 5 para 15 pessoas: o que ${hl("*quebra*")} primeiro`, "Crescer é bom. Mas o controle que funcionava na cabeça do sócio para de funcionar."],
  [
    ["A informação na cabeça do sócio", "Com 5, ele sabe tudo. Com 15, vira gargalo: tudo passa por ele."],
    ["As versões de arquivo", "Cada um salva a sua. Ninguém sabe qual é a certa."],
    ["A cobrança", "Parcela vence e ninguém percebe, porque cada um acha que o outro cobrou."],
    ["A margem", "Ninguém sabe qual projeto dá lucro. Só o que dá trabalho."],
    ["O cliente", "Liga para saber como está, e a resposta depende de quem atende."],
  ],
  ["Na Pilar", `O escritório cresce e o controle ${hl("*acompanha*")}.`, "Usuários ilimitados em todo plano: quem entra já entra no sistema."]);

/* C13 · Fechar o mês do escritório em 30 minutos */
serie("c13-fechar-o-mes", 7,
  ["Rotina", `Fechar o mês do escritório em ${hl("*30_minutos*").replace("_", " ")}`, "Cinco conferências, nessa ordem."],
  [
    ["Recebido × a receber", "O que entrou, o que venceu e não entrou, o que vence no mês que vem."],
    ["Despesas lançadas", "Tudo que saiu, na categoria certa e no projeto certo."],
    ["Horas por projeto", "Quanto cada projeto consumiu de hora da equipe."],
    ["Margem por projeto", "Preço menos custo e imposto. Quem puxou o mês para baixo?"],
    ["O que vence na semana", "Entregas, parcelas e contas. É a lista da segunda-feira."],
  ],
  ["Na Pilar", `Toda semana, o ${hl("*resumo*")} chega pronto no Início.`, "Escrito pela Pilar, com cada número conferido pelo sistema."]);

/* C14 · As perguntas que todo cliente faz */
serie("c14-perguntas-do-cliente", 6,
  ["Cliente", `As 4 perguntas que ${hl("*todo*")} cliente faz`, "E onde a resposta deveria estar, para ninguém parar o que está fazendo."],
  [
    ["“Como está?”", "No portal do cliente, com o andamento e o diário que você liberou."],
    ["“Quando termina?”", "No cronograma, com os marcos de entrega."],
    ["“Quanto falta pagar?”", "Nas parcelas, ligadas a cada entrega."],
    ["“Por que custou mais?”", "No aditivo, com as horas e as despesas que sustentam cada valor."],
  ],
  ["Na Pilar", `O cliente acompanha por um ${hl("*link*")}.`, "Ele vê só o que você liberar. O seu telefone descansa."]);

/* C15 · Carta do fundador (revisar com o Matheus antes de postar) */
{
  const N = 4;
  POSTS["c15-carta-do-fundador-01-capa"] = page(`<span class="badge">Carta do fundador</span>
    <div class="hook md">Por que eu estou construindo a ${hl("*Pilar*")}</div><p class="body">Matheus Rezende, fundador.</p>
    <div class="row"><span class="badge line" style="font-size:26px">Arraste →</span></div>${foot}`, { land: true });
  const carta = (i, t) => page(`${prog(i, N)}<div style="font-size:52px;line-height:1.4;letter-spacing:-.015em;font-weight:400">${t}</div>${foot}`);
  POSTS["c15-carta-do-fundador-02"] = carta(1, "Eu vi muito escritório de engenharia bom perdendo dinheiro sem perceber.<br><br>A proposta ficava num lugar, o controle em outro e a obra no grupo do WhatsApp. O lucro do projeto só aparecia quando ele já tinha acabado.");
  POSTS["c15-carta-do-fundador-03"] = carta(2, "Ninguém ali era desorganizado. Faltava um lugar onde o dado entrasse uma vez só e servisse para todo mundo.<br><br>E faltava alguém fazendo o trabalho repetitivo, para o sócio voltar a fazer engenharia.");
  POSTS["c15-carta-do-fundador-04-final"] = page(`${prog(4, N)}<div class="stack"><div class="hook md">Quem projeta merece ganhar pelo que ${hl("*projeta*")}.</div>
    <p class="body">É isso que eu construo. Se fizer sentido para você, me chama: eu leio toda mensagem.</p></div><span class="cta">Veja os planos · link na bio</span>${foot}`, { land: true });
}

/* C16 · Glossário (versão carrossel do vídeo) */
serie("c16-glossario", 7,
  ["Glossário", `5 termos que todo estagiário de ${hl("*projeto*")} precisa saber`, "Salve e mande para quem acabou de chegar."],
  [
    ["ART", "Anotação de Responsabilidade Técnica. Registrada no CREA, diz quem responde pelo projeto de engenharia."],
    ["RRT", "Registro de Responsabilidade Técnica. O equivalente da ART na arquitetura, registrado no CAU."],
    ["Aditivo", "O que muda no escopo e no valor depois do contrato assinado."],
    ["Curva S", "O avanço acumulado no tempo: planejado contra realizado."],
    ["Margem", "O que sobra do preço depois do custo e do imposto."],
  ],
  ["Na Pilar", `Contrato, aditivo, cronograma e margem no ${hl("*mesmo*")} sistema.`, "Gestão com agentes de IA para escritórios de engenharia e arquitetura."]);

/* Estáticos da leva 4 */
POSTS["e10-revisao-nao-e-favor"] = page(`<span class="badge">Manifesto</span>
  <div style="font-size:150px;font-weight:600;letter-spacing:-.06em;line-height:.98">Revisão<br>não é<br><span class="pill">favor.</span></div>
  <p class="body">É escopo. E escopo a mais tem nome: aditivo.</p>${foot}`, { land: true });
POSTS["e11-previsao-x-cronograma"] = page(`<span class="badge">Quem nunca?</span>
  <div class="stack" style="gap:24px">
    <div class="card" style="display:flex;gap:28px;align-items:center"><div style="font-size:70px">⛈</div><div><div class="ex">Previsão · sábado</div><div style="font-size:52px;font-weight:600;color:#B45309">94% de trovoada</div></div></div>
    <div class="card" style="display:flex;gap:28px;align-items:center"><div style="font-size:70px">🏗</div><div><div class="ex">Cronograma · sábado</div><div style="font-size:52px;font-weight:600">Concretagem da laje</div></div></div></div>
  <div class="hook sm">Marque quem precisa ser ${hl("*avisado*")} antes.</div>${foot}`, { land: true });
POSTS["e12-frase-do-fundador"] = page(`<div style="font-size:200px;line-height:.6;color:#A4EC86;font-weight:600">“</div>
  <div style="font-size:96px;font-weight:600;letter-spacing:-.045em;line-height:1.04;color:#fff">Quem projeta merece ganhar pelo que projeta.</div>
  <div style="font-size:36px;color:#a9aab0">Matheus Rezende, fundador da Pilar</div>${foot}`, { ink: true });
const dica = (n, t, b) => page(`<span class="badge">Dica rápida #${n}</span><div class="hook md">${t}</div><p class="body">${b}</p>${foot}`);
POSTS["e13-dica-1-pedido"] = dica(1, `Registre o pedido do cliente no ${hl("*dia*")} em que ele chega.`, "Data, quem pediu e o que muda. É a base do aditivo que você ainda vai pedir.");
POSTS["e14-dica-2-parcela"] = dica(2, `Ligue cada parcela a uma ${hl("*entrega*")}.`, "Entregou o anteprojeto, fatura a parcela 2. O cliente entende, e o caixa agradece.");
POSTS["e15-enquete-dor"] = page(`<span class="badge">Responda nos comentários</span>
  <div class="hook md">Qual é a sua maior ${hl("*dor*")} hoje?</div>
  <div class="stack" style="gap:18px">${["A · Margem dos projetos", "B · Prazo das entregas", "C · Cobrança das parcelas", "D · Cliente pedindo status"].map((t) => `<div style="border:3px solid #1A1A1A;border-radius:999px;padding:24px 40px;font-size:42px;font-weight:500">${t}</div>`).join("")}</div>${foot}`);
POSTS["e16-lancamento-19-01"] = page(`<span class="badge">Anote</span>
  <div style="font-size:300px;font-weight:600;letter-spacing:-.07em;line-height:.9">19.01</div>
  <div class="hook sm">Lançamento público da ${hl("*Pilar*")}.</div><p class="body">Gestão com agentes de IA para escritórios de engenharia e arquitetura.</p>${foot}`, { land: true });
POSTS["e17-por-usuario-x-pilar"] = page(`<span class="badge">Faça a conta · exemplo</span>
  <div class="hook sm">Escritório de 12 pessoas</div>
  <div class="card" style="font-size:38px"><div class="ex">Sistema que cobra por usuário (exemplo)</div><div style="font-size:72px;font-weight:600;margin-top:10px;white-space:nowrap">12 × R$ 89 = <span style="color:#DC2626">R$ 1.068</span></div></div>
  <div class="card" style="font-size:38px;box-shadow:0 0 0 4px #A4EC86"><div class="ex">Pilar Profissional</div><div style="font-size:84px;font-weight:600;margin-top:10px">R$ 499 <span style="font-size:36px;font-weight:500;color:#5F6572">usuários ilimitados</span></div></div>${foot}`);
POSTS["e18-em-uma-frase"] = page(`<span class="badge">Em uma frase</span>
  <div class="hook md">Gestão com agentes de IA para escritórios de engenharia e ${hl("*arquitetura*")}.</div>
  <p class="body">A Pilar prepara. O sistema confere. Você aprova.</p>${foot}`, { land: true });

/* ============ Stories (1080 × 1920): 250 px livres no topo, 340 px na base ============ */
const STORY = {};
const story = (body, { bg = "", ink = false, land = false } = {}) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(resolve(TPL, "social.css"))}"><style>${css}
:root{--h:1920px}.canvas{padding:250px 90px 340px;justify-content:flex-start;gap:60px}
.sticker{border:4px dashed rgba(26,26,26,.25);border-radius:40px;height:300px;display:grid;place-items:center;font-size:30px;font-weight:500;color:rgba(26,26,26,.4)}
.ink .sticker{border-color:rgba(255,255,255,.25);color:rgba(255,255,255,.45)}
.sfoot{position:absolute!important;left:90px;right:90px;bottom:200px}</style></head><body>
${land ? paisagem(1080, 1920, 1500, 420) : ""}<div class="canvas${ink ? " ink" : ""}${land ? " land" : ""}" ${bg ? `style="background:${bg}"` : ""}>${body}<div class="sfoot">${foot}</div></div></body></html>`;
const ESPACO = (t) => `<div class="sticker">${t}</div>`;
// ST1 enquete da margem
STORY["st1-enquete-margem-1"] = story(`<span class="badge">Enquete</span><div class="hook">Você sabe a margem de cada ${hl("*disciplina*")}?</div>${ESPACO("adesivo de enquete: Sim / Não")}`);
STORY["st1-enquete-margem-2"] = story(`<span class="badge">Por que importa</span><div class="hook md">A margem do projeto inteiro esconde a disciplina que dá ${hl("*prejuízo*")}.</div><p class="body">O estrutural pode pagar o elétrico, e ninguém percebe.</p>`);
STORY["st1-enquete-margem-3"] = story(`<span class="badge">Na Pilar</span><div class="hook md">Orçamento e hora real por ${hl("*disciplina*")}, durante o projeto.</div>${ESPACO("adesivo de link: planos")}`, { land: true });
// ST2 quiz
STORY["st2-quiz-1"] = story(`<span class="badge">Quiz</span><div class="hook md">O que precisa estar registrado antes de começar um projeto de ${hl("*engenharia*")}?</div>${ESPACO("adesivo de quiz: Alvará / ART / Logo")}`, { bg: "linear-gradient(165deg,#D4F7C3 0%,#A4EC86 60%,#8FD46A 100%)" });
STORY["st2-quiz-2"] = story(`<span class="badge" style="background:#1A1A1A;color:#fff">Resposta</span><div style="font-size:260px;font-weight:600;letter-spacing:-.06em">ART</div><p class="body" style="color:#1A1A1A">No CREA, antes de começar. Na arquitetura, o RRT, no CAU.</p>`, { bg: "linear-gradient(165deg,#D4F7C3 0%,#A4EC86 60%,#8FD46A 100%)" });
// ST3 caixinha
STORY["st3-caixinha"] = story(`<span class="badge">Pergunte ao fundador</span><div class="hook md">O que você quer saber sobre gestão de escritório de ${hl("*projeto*")}?</div>${ESPACO("adesivo de perguntas")}<p class="body">Eu respondo em vídeo.</p>`);
// ST4 isso ou aquilo
[["Planilha", "Sistema"], ["WhatsApp", "Portal do cliente"], ["Revisão de graça", "Aditivo"], ["Cobrar por hora", "Cobrar por disciplina"]].forEach(([a, b], i) => {
  STORY[`st4-isso-ou-aquilo-${i + 1}`] = story(`<span class="badge">Isso ou aquilo ${i + 1}/4</span>
    <div style="display:flex;flex-direction:column;gap:30px;margin-top:60px"><div class="card" style="font-size:72px;font-weight:600;text-align:center;padding:60px">${a}</div>
    <div style="text-align:center;font-size:40px;font-weight:500;color:var(--muted)">ou</div><div class="card" style="font-size:72px;font-weight:600;text-align:center;padding:60px;box-shadow:0 0 0 4px #A4EC86">${b}</div></div>${ESPACO("adesivo de enquete")}`);
});
// ST5 bastidor
STORY["st5-bastidor-1"] = story(`<span class="badge">Bastidor</span><div class="hook md">O que eu estou construindo esta ${hl("*semana*")}</div>${ESPACO("sua foto ou print da tela aqui")}`, { ink: true });
STORY["st5-bastidor-2"] = story(`<span class="badge">Bastidor</span><div class="hook md">Uma coisa que eu ${hl("*cortei*")} e por quê</div>${ESPACO("sua foto aqui")}<p class="body">Responde aqui: você teria cortado?</p>`, { ink: true });
// ST6 contagem
[10, 7, 3, 1].forEach((d) => {
  STORY[`st6-contagem-${String(d).padStart(2, "0")}`] = story(`<span class="badge">Lançamento público</span>
    <div style="font-size:${d > 9 ? 480 : 560}px;font-weight:600;letter-spacing:-.08em;line-height:.9;margin-top:40px">${d}</div>
    <div class="hook sm">${d === 1 ? "É amanhã." : "dias para o lançamento."}</div><p class="body">19 de janeiro. Ative o lembrete.</p>${ESPACO("adesivo de contagem regressiva")}`, { ink: true });
});
// ST7 novidades e ST8 link
STORY["st7-novidades"] = story(`<span class="badge">Novidades da semana</span><div class="hook md">4 coisas novas na ${hl("*Pilar*")} esta semana.</div><p class="body">Estão no post de hoje. Toca para ver.</p>${ESPACO("repost do post de novidades")}`);
STORY["st8-planos-link"] = story(`<span class="badge">Planos</span><div style="font-size:220px;font-weight:600;letter-spacing:-.06em;line-height:.9">R$ 299</div><div class="hook sm">por mês, usuários ${hl("*ilimitados*")}.</div>${ESPACO("adesivo de link: planos")}`, { land: true });

// ---------------- render ----------------
const filtro = process.argv[2];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
mkdirSync(resolve(OUT, "stories"), { recursive: true });
const ALL = [...Object.entries(POSTS).map(([n, h]) => [n, h, 1350, OUT]), ...Object.entries(STORY).map(([n, h]) => [n, h, 1920, resolve(OUT, "stories")])];
for (const [name, html, hgt, dir] of ALL) {
  if (filtro && !name.includes(filtro)) continue;
  const tmp = resolve(TPL, `_tmp-${name}.html`);
  writeFileSync(tmp, html);
  await pg.goto(pathToFileURL(tmp).href);
  await pg.evaluate(() => document.fonts.ready);
  await pg.setViewportSize({ width: 1080, height: hgt });
  await pg.screenshot({ path: resolve(dir, `${name}.png`) });
  unlinkSync(tmp);
  console.log("ok", name);
}
await browser.close();
