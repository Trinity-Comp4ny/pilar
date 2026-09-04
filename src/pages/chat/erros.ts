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
 * Motivo do bloqueio 402 (spec 094): `saldo_empresa` (mensagem atual) ou
 * `limite_usuario` (teto pessoal, oferece pedir mais ao admin). `functions.invoke`
 * devolve `context` como a Response real (ainda não lida); `enviarStream` (fetch
 * direto) já lê o body e embute `motivo` num objeto plano — os dois formatos são
 * cobertos aqui.
 */
export async function extrairMotivoBloqueioTokens(e: unknown): Promise<string | undefined> {
  const err = e as { context?: unknown } | null;
  const context = err?.context;
  if (context && typeof context === "object" && "motivo" in context) {
    const motivo = (context as { motivo?: unknown }).motivo;
    return typeof motivo === "string" ? motivo : undefined;
  }
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      return typeof body?.motivo === "string" ? body.motivo : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Mensagem de erro para o envio ao ai-chat. Diz o que houve e o próximo passo.
 * `functions.invoke` devolve FunctionsHttpError (com `context` = Response e o status
 * real da edge function) ou FunctionsFetchError (rede/abort). Em timeout ou cancelamento
 * o fetch é abortado; quem chama sinaliza via `porTimeout`. `motivoBloqueio` só é
 * usado quando `status === 402` (extraído antes via extrairMotivoBloqueioTokens).
 */
export function msgErroChat(e: unknown, porTimeout = false, motivoBloqueio?: string): string {
  if (porTimeout) {
    return "A resposta demorou demais e foi interrompida. Tente de novo ou simplifique o pedido.";
  }
  const err = e as { name?: string; context?: { status?: number } } | null;
  const status = err?.context?.status;
  if (status === 429) {
    return "Muitas chamadas de IA em sequência. Aguarde um minuto e tente de novo.";
  }
  if (status === 402) {
    if (motivoBloqueio === "limite_usuario") {
      return "Você atingiu seu limite de tokens de IA deste mês. Peça mais tokens ao administrador da sua empresa em Configurações > Uso.";
    }
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
