/**
 * Extrai uma mensagem útil de um erro de Supabase/RPC. As RPCs do agente usam RAISE EXCEPTION
 * com textos em PT ("A folha de 7/2026 já foi fechada", "Sem permissão para..."), então
 * mostrá-los ao usuário é melhor que um genérico. Cai no fallback para erros de rede sem mensagem.
 */
export function msgErro(e: unknown, fallback = "Tente de novo em instantes."): string {
  if (e && typeof e === "object" && "message" in e) {
    const m = String((e as { message?: unknown }).message ?? "").trim();
    if (m && !/fetch|network|failed to/i.test(m)) return m;
  }
  return fallback;
}

/**
 * Mensagem de erro para o envio ao ai-chat. Diz o que houve e o próximo passo.
 * `functions.invoke` devolve FunctionsHttpError (com `context` = Response e o status
 * real da edge function) ou FunctionsFetchError (rede/abort). Em timeout ou cancelamento
 * o fetch é abortado; quem chama sinaliza via `porTimeout`.
 */
export function msgErroChat(e: unknown, porTimeout = false): string {
  if (porTimeout) {
    return "A resposta demorou demais e foi interrompida. Tente de novo ou simplifique o pedido.";
  }
  const err = e as { name?: string; context?: { status?: number } } | null;
  const status = err?.context?.status;
  if (status === 429) {
    return "Muitas chamadas de IA em sequência. Aguarde um minuto e tente de novo.";
  }
  if (status === 402) {
    return "Os tokens de IA da empresa acabaram neste ciclo. Aguarde a renovação ou fale com o administrador.";
  }
  if (status === 401 || status === 403) {
    return "Você não tem permissão para essa ação. Fale com um administrador da empresa.";
  }
  if (err?.name === "FunctionsFetchError") {
    return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
  }
  return "Não consegui processar agora. Tente reformular ou tente de novo em instantes.";
}
