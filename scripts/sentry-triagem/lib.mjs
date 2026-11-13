// Regras puras da triagem automática de issues do Sentry (sem rede, sem efeito colateral).
// Testadas em lib.test.ts. O que fala com a API do Sentry fica em sentry.mjs.

/** Títulos que nunca viram PR: rede do usuário, sessão expirada, erro esperado de negócio. */
const RUIDO = [
  { motivo: "rede do usuário (fetch falhou)", re: /^(Auth\w*Error|TypeError|Error): (TypeError: )?(Failed to fetch|Load failed|NetworkError|network error)/i },
  { motivo: "rede do usuário (módulo não carregou)", re: /(Importing a module script failed|Failed to fetch dynamically imported module)/i },
  { motivo: "sessão expirada (refresh token)", re: /refresh_token_not_found|refresh_token_already_used/i },
  { motivo: "código MFA digitado errado", re: /mfa_verification_failed/i },
  { motivo: "cartão recusado pelo Asaas", re: /Asaas: Transação não autorizada|cobrança imediata recusada/i },
  { motivo: "ruído do navegador", re: /ResizeObserver loop|Non-Error promise rejection|Script error\.?$/i },
];

/** Devolve o motivo se o título é ruído conhecido, senão null. */
export function classificarRuido(titulo) {
  const t = String(titulo ?? "");
  return RUIDO.find((r) => r.re.test(t))?.motivo ?? null;
}

/** Caminhos que o agente nunca pode alterar (CI, segredos de pipeline, dependências, ferramenta de triagem). */
const PROIBIDOS = [
  /^\.github\//,
  /^\.claude\//,
  /^scripts\//,
  /^package(-lock)?\.json$/,
  /^apps\/marketing\/package\.json$/,
  /^vercel\.json$/,
  /^\.env/,
  /^\.sentry-triagem\//,
];

export function caminhoProibido(caminho) {
  const c = String(caminho).replace(/^\.\//, "");
  return PROIBIDOS.some((re) => re.test(c));
}

/** Texto vindo do Sentry é dado, não instrução: tira controle, corta e limita tamanho. */
export function sanitizarTexto(valor, max = 400) {
  const s = String(valor ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

const ACOES = ["corrigir", "ruido", "humano"];

/** Valida o veredito que o agente escreveu. Lança com mensagem clara se estiver fora do contrato. */
export function lerVeredito(texto) {
  let v;
  try {
    v = JSON.parse(texto);
  } catch {
    throw new Error("veredito não é JSON válido");
  }
  if (!v || typeof v !== "object") throw new Error("veredito vazio");
  if (!ACOES.includes(v.acao)) throw new Error(`acao inválida: ${String(v.acao)}`);
  const motivo = sanitizarTexto(v.motivo, 600);
  if (!motivo) throw new Error("veredito sem motivo");
  const titulo = sanitizarTexto(v.titulo_pr, 90);
  if (v.acao === "corrigir" && !titulo) throw new Error("acao corrigir exige titulo_pr");
  return { acao: v.acao, motivo, titulo_pr: titulo, resumo: sanitizarTexto(v.resumo, 1500) };
}

/** Escolhe quais issues entram nesta rodada: sem ruído, sem trabalho já aberto, no máximo `max`. */
export function selecionar(issues, { jaTratadas = new Set(), max = 3 } = {}) {
  const ruido = [];
  const candidatas = [];
  for (const i of issues) {
    const motivo = classificarRuido(i.title);
    if (motivo) {
      ruido.push({ issue: i, motivo });
      continue;
    }
    if (jaTratadas.has(i.shortId)) continue;
    candidatas.push(i);
  }
  // Mais gente afetada primeiro, depois mais ocorrências.
  candidatas.sort((a, b) => Number(b.userCount) - Number(a.userCount) || Number(b.count) - Number(a.count));
  return { ruido, candidatas: candidatas.slice(0, max) };
}
