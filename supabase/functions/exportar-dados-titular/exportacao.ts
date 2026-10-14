/**
 * Monta a cópia dos dados da conta do titular (SPEC 115). Puro: recebe as linhas já
 * buscadas e devolve o JSON final. Define em um lugar só o que entra e o que nunca
 * sai (segredo, dado de terceiro, conteúdo de negócio da empresa).
 */

type Linha = Record<string, unknown>;

export interface Fontes {
  perfil: Linha | null;
  preferenciasNotificacao: Linha[];
  consentimentosCookies: Linha[];
  aceitesTermos: Linha[];
  consentimentosCobranca: Linha[];
  notificacoes: Linha[];
  conversasIa: Array<Linha & { mensagens: Linha[] }>;
  feedbacks: Linha[];
  horasLancadas: Linha[];
  usoIa: Linha[];
  acoes: Linha[];
  pedidosExportacao: Linha[];
  pedidosExclusao: Linha[];
}

/** Limites por seção: a cópia fica utilizável e o limite aparece no próprio arquivo. */
export const LIMITES = { notificacoes: 2000, acoes: 5000, usoIa: 5000, horasLancadas: 5000, conversasIa: 500 };

// Nunca saem, em seção nenhuma: segredo de autenticação, conteúdo alterado por outras
// pessoas na trilha de auditoria e caminho interno de arquivo.
const CAMPOS_PROIBIDOS = new Set([
  "diff",
  "metadata",
  "print_path",
  "sentry_event_id",
  "code_hash",
  "codigo_hash",
  "token",
  "token_hash",
  "asaas_credit_card_token",
  "ip_address",
]);

function limpar(linha: Linha | null): Linha | null {
  if (!linha) return null;
  return Object.fromEntries(Object.entries(linha).filter(([k]) => !CAMPOS_PROIBIDOS.has(k)));
}

const lista = (linhas: Linha[] | null | undefined, limite?: number) =>
  (linhas ?? []).slice(0, limite ?? Number.MAX_SAFE_INTEGER).map((l) => limpar(l) as Linha);

export function montarExportacao(fontes: Fontes, geradoEm: string) {
  return {
    sobre: {
      gerado_em: geradoEm,
      base_legal: "LGPD, art. 18, II (acesso) e V (portabilidade)",
      conteudo:
        "Dados da sua conta no Pilar. Projetos, clientes, financeiro e cadastro de equipe são dados da sua empresa e são exportados pelo administrador dela.",
      limites: LIMITES,
    },
    perfil: limpar(fontes.perfil),
    preferencias_de_notificacao: lista(fontes.preferenciasNotificacao),
    consentimentos: {
      cookies: lista(fontes.consentimentosCookies),
      termos: lista(fontes.aceitesTermos),
      cobranca: lista(fontes.consentimentosCobranca),
    },
    notificacoes_recebidas: lista(fontes.notificacoes, LIMITES.notificacoes),
    conversas_com_ia: (fontes.conversasIa ?? [])
      .slice(0, LIMITES.conversasIa)
      .map((c): Linha => ({ ...(limpar(c) as Linha), mensagens: lista(c.mensagens) })),
    feedbacks_enviados: lista(fontes.feedbacks),
    horas_lancadas: lista(fontes.horasLancadas, LIMITES.horasLancadas),
    uso_de_ia: lista(fontes.usoIa, LIMITES.usoIa),
    historico_de_acoes: lista(fontes.acoes, LIMITES.acoes),
    pedidos_lgpd: {
      exportacao: lista(fontes.pedidosExportacao),
      exclusao: lista(fontes.pedidosExclusao),
    },
  };
}
