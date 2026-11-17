/**
 * Exportação dos dados da EMPRESA (saída de quem teve a assinatura suspensa).
 * Diferente de exportar-dados-titular, que copia os dados pessoais de um usuário.
 *
 * Puro: define em um lugar só quais tabelas saem, o que nunca sai e como cada linha
 * vira CSV. A busca no banco e o upload ficam no index.ts.
 */

type Linha = Record<string, unknown>;

/** Dados de negócio da empresa, por módulo. Tabela de sistema, auditoria e segredo não entra. */
export const TABELAS_EXPORTADAS = [
  // Cadastros
  "clientes",
  "pessoas",
  "fornecedores",
  // Projetos
  "projetos",
  "escopos",
  "disciplinas",
  "projeto_etapas",
  "projeto_orcamento_fases",
  "orcamento_versoes",
  "tarefas",
  "tarefa_etapas",
  "tarefa_responsaveis",
  "timesheet_lancamentos",
  // Comercial
  "propostas",
  "proposta_disciplinas",
  "leads",
  "lead_etapas",
  // Financeiro
  "receitas",
  "despesas",
  "contas",
  "cartoes",
  "faturas",
  "transferencias",
  "categorias_financeiras",
  "centros_custo",
  "folha_pagamento",
  "marcos_faturamento",
  "grupos_parcela",
  "cobrancas",
  // Obras
  "obras",
  "obra_frente",
  "obra_orcamento_etapa",
  "obra_planejamento_mes",
  "obra_material",
  "obra_material_mov",
  "obra_conta_lancamento",
  "obra_cotacao",
  "obra_rdo",
  "obra_registro",
] as const;

/** Teto por tabela e no total: a função roda em memória e o arquivo precisa caber no bucket. */
export const LIMITE_LINHAS_POR_TABELA = 50_000;
export const LIMITE_LINHAS_TOTAL = 250_000;

/**
 * Nunca saem, em tabela nenhuma: segredo, credencial, hash e caminho interno de arquivo.
 * Por padrão de nome, para pegar coluna nova sem precisar lembrar de listá-la.
 */
const CAMPO_PROIBIDO = /(token|secret|password|senha|hash|api_?key|credential|private_key|print_path|ip_address)/i;

export function campoProibido(nome: string): boolean {
  return CAMPO_PROIBIDO.test(nome);
}

/** Linha apagada (soft delete) não sai: o cliente exporta o que enxerga no sistema. */
export function linhaVisivel(linha: Linha): boolean {
  return linha.deleted_at == null;
}

export function limparLinha(linha: Linha): Linha {
  return Object.fromEntries(Object.entries(linha).filter(([k]) => !campoProibido(k)));
}

function celula(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  let texto: string;
  if (typeof valor === "object") texto = JSON.stringify(valor);
  else texto = String(valor);
  // Fórmula em planilha: texto que começa com = + - @ vira apóstrofo na frente.
  // Número de verdade (typeof number) passa intacto, inclusive o negativo.
  if (typeof valor === "string" && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV com ponto e vírgula e BOM UTF-8: abre direto no Excel em português, com acento certo. */
export function paraCsv(linhas: Linha[]): string {
  if (!linhas.length) return "\uFEFF";
  const colunas: string[] = [];
  for (const linha of linhas) {
    for (const k of Object.keys(linha)) if (!colunas.includes(k)) colunas.push(k);
  }
  const corpo = linhas.map((l) => colunas.map((c) => celula(l[c])).join(";"));
  return `\uFEFF${[colunas.join(";"), ...corpo].join("\r\n")}\r\n`;
}

export interface ResumoTabela {
  tabela: string;
  linhas: number;
  /** Bateu no limite: o arquivo tem só as primeiras linhas. */
  truncada: boolean;
  /** Tabela que não foi lida (erro de consulta): vai no LEIA-ME em vez de sumir calada. */
  indisponivel?: boolean;
}

export function montarLeiaMe(params: { empresaNome: string; geradoEm: string; resumo: ResumoTabela[] }): string {
  const { empresaNome, geradoEm, resumo } = params;
  const com = resumo.filter((r) => r.linhas > 0);
  const linhasTabelas = com.map(
    (r) => `- ${r.tabela}.csv: ${r.linhas} linha(s)${r.truncada ? " (truncada no limite)" : ""}`
  );
  const falhas = resumo.filter((r) => r.indisponivel).map((r) => `- ${r.tabela}`);
  return [
    `Exportação dos dados de ${empresaNome}`,
    `Gerada em ${geradoEm}`,
    "",
    "Formato: um CSV por tabela, separado por ponto e vírgula, UTF-8.",
    "Abre direto no Excel e no Google Planilhas. Datas em formato ISO (AAAA-MM-DD).",
    "",
    "Arquivos:",
    ...(linhasTabelas.length ? linhasTabelas : ["- nenhuma tabela com dados"]),
    "",
    "Não estão nesta cópia: arquivos anexados (documentos e fotos), segredos de integração e dados de outras empresas.",
    ...(resumo.some((r) => r.truncada)
      ? ["", `Tabelas truncadas em ${LIMITE_LINHAS_POR_TABELA} linhas: fale com o suporte para a cópia completa.`]
      : []),
    ...(falhas.length ? ["", "Tabelas que não puderam ser lidas nesta geração:", ...falhas] : []),
    "",
  ].join("\r\n");
}

export function nomeDoArquivo(empresaNome: string, geradoEm: Date): string {
  const slug = empresaNome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 40);
  return `dados-${slug || "empresa"}-${geradoEm.toISOString().slice(0, 10)}.zip`;
}

/** Sessão recente: a exportação é a porta de saída dos dados, então exige login feito há pouco. */
export const IDADE_MAXIMA_SESSAO_S = 15 * 60;

export function sessaoRecente(iatSegundos: number | null, agoraMs: number): boolean {
  if (iatSegundos === null) return false;
  return agoraMs / 1000 - iatSegundos <= IDADE_MAXIMA_SESSAO_S;
}

export function iatDoToken(authHeader: string | null): number | null {
  const token = (authHeader ?? "").replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return typeof json?.iat === "number" ? json.iat : null;
  } catch {
    return null;
  }
}
