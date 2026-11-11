/**
 * Protocolo MCP do conector da Pilar (SPEC 151): JSON-RPC 2.0 sobre "Streamable HTTP", sem
 * sessão e sem stream (cada POST recebe uma resposta JSON). É o mínimo que ChatGPT, Claude e
 * outros clientes MCP precisam para descobrir e chamar ferramentas: initialize, ping,
 * tools/list e tools/call. Notificação (mensagem sem id) recebe 202 sem corpo.
 *
 * Este módulo não sabe nada de HTTP nem de banco: recebe a mensagem e um contexto com as
 * ferramentas e devolve a resposta. Isso deixa o protocolo testável sem rede.
 */

/** Versões do protocolo que este servidor fala, da mais nova para a mais antiga. */
export const VERSOES_SUPORTADAS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const INFO_DO_SERVIDOR = { name: "pilar", title: "Pilar", version: "1.0.0" } as const;

/** Orientação ao modelo que usa o conector (vai no initialize). */
export const INSTRUCOES = [
  "Conector da Pilar, a gestão do escritório de engenharia e arquitetura do usuário.",
  "Acesso somente leitura: projetos, aditivos, propostas, leads, clientes e resumo financeiro da empresa de quem conectou.",
  "Cada usuário só vê o que o perfil dele vê no app; quem não vê dinheiro recebe os valores vazios.",
  "Valores em reais (BRL). Datas no formato AAAA-MM-DD.",
  "Para criar ou alterar algo, oriente o usuário a fazer na Pilar (app.pilarsoft.com.br).",
].join(" ");

export const ERRO_PARSE = -32700;
export const ERRO_REQUISICAO_INVALIDA = -32600;
export const ERRO_METODO_DESCONHECIDO = -32601;
export const ERRO_PARAMETROS_INVALIDOS = -32602;
export const ERRO_INTERNO = -32603;

type IdJsonRpc = string | number | null;

export interface RespostaJsonRpc {
  jsonrpc: "2.0";
  id: IdJsonRpc;
  result?: unknown;
  error?: { code: number; message: string };
}

/** Ferramenta como o cliente vê no tools/list. */
export interface DescricaoFerramenta {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, unknown>;
}

/** Resultado de uma ferramenta: texto para o modelo ler e o mesmo dado estruturado. */
export interface ResultadoFerramenta {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface ContextoMcp {
  ferramentas: DescricaoFerramenta[];
  /**
   * Executa a ferramenta. Devolve null quando o nome não existe (vira erro de parâmetro).
   * Erro de negócio (sem acesso, entrada inválida) volta como `isError`, para o modelo ler.
   */
  executar: (nome: string, argumentos: Record<string, unknown>) => Promise<ResultadoFerramenta | null>;
}

export function resultadoOk(dados: Record<string, unknown>): ResultadoFerramenta {
  return { content: [{ type: "text", text: JSON.stringify(dados, null, 2) }], structuredContent: dados };
}

export function resultadoErro(mensagem: string): ResultadoFerramenta {
  return { content: [{ type: "text", text: mensagem }], isError: true };
}

function erro(id: IdJsonRpc, code: number, message: string): RespostaJsonRpc {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function idValido(valor: unknown): valor is IdJsonRpc {
  return valor === null || typeof valor === "string" || (typeof valor === "number" && Number.isFinite(valor));
}

/** Versão a responder no initialize: a do cliente se a conhecemos, senão a mais nova nossa. */
export function negociarVersao(pedida: unknown): string {
  return typeof pedida === "string" && (VERSOES_SUPORTADAS as readonly string[]).includes(pedida)
    ? pedida
    : VERSOES_SUPORTADAS[0];
}

/** Processa uma mensagem JSON-RPC. Devolve null para notificação (sem resposta). */
export async function processarMensagem(mensagem: unknown, ctx: ContextoMcp): Promise<RespostaJsonRpc | null> {
  if (!ehObjeto(mensagem) || mensagem.jsonrpc !== "2.0" || typeof mensagem.method !== "string") {
    const id = ehObjeto(mensagem) && idValido(mensagem.id) ? mensagem.id : null;
    return erro(id, ERRO_REQUISICAO_INVALIDA, "Requisição JSON-RPC inválida");
  }

  // Sem id é notificação (notifications/initialized, notifications/cancelled...): não responde.
  if (!("id" in mensagem)) return null;
  if (!idValido(mensagem.id)) return erro(null, ERRO_REQUISICAO_INVALIDA, "id inválido");

  const id = mensagem.id;
  const params = ehObjeto(mensagem.params) ? mensagem.params : {};

  switch (mensagem.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: negociarVersao(params.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: INFO_DO_SERVIDOR,
          instructions: INSTRUCOES,
        },
      };

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: ctx.ferramentas } };

    case "tools/call": {
      if (typeof params.name !== "string" || params.name === "") {
        return erro(id, ERRO_PARAMETROS_INVALIDOS, "Informe o nome da ferramenta");
      }
      const argumentos = params.arguments === undefined ? {} : params.arguments;
      if (!ehObjeto(argumentos)) {
        return erro(id, ERRO_PARAMETROS_INVALIDOS, "Os argumentos da ferramenta precisam ser um objeto");
      }
      const resultado = await ctx.executar(params.name, argumentos);
      if (!resultado) return erro(id, ERRO_PARAMETROS_INVALIDOS, `Ferramenta desconhecida: ${params.name}`);
      return { jsonrpc: "2.0", id, result: resultado };
    }

    default:
      return erro(id, ERRO_METODO_DESCONHECIDO, `Método não suportado: ${mensagem.method}`);
  }
}

/**
 * Processa o corpo do POST: uma mensagem ou um lote (versões antigas do protocolo mandam
 * lote). Devolve null quando nada precisa de resposta (só notificações).
 */
export async function processarCorpo(
  corpo: unknown,
  ctx: ContextoMcp
): Promise<RespostaJsonRpc | RespostaJsonRpc[] | null> {
  if (corpo === null || corpo === undefined) return erro(null, ERRO_PARSE, "JSON inválido");
  if (!Array.isArray(corpo)) return processarMensagem(corpo, ctx);
  if (corpo.length === 0) return erro(null, ERRO_REQUISICAO_INVALIDA, "Lote vazio");

  const respostas: RespostaJsonRpc[] = [];
  for (const mensagem of corpo) {
    const resposta = await processarMensagem(mensagem, ctx);
    if (resposta) respostas.push(resposta);
  }
  return respostas.length > 0 ? respostas : null;
}

// ---------------------------------------------------------------------------
// Autorização (OAuth 2.1, RFC 9728): como o cliente descobre onde fazer login
// ---------------------------------------------------------------------------

export interface EnderecosMcp {
  /** URL pública do servidor MCP, a mesma que o usuário cola no ChatGPT/Claude. */
  recurso: string;
  /** Emissor dos tokens (Supabase Auth): `<url pública da API>/auth/v1`. */
  servidorDeAutorizacao: string;
}

/** URL do documento de metadados do recurso protegido (RFC 9728). */
export function urlDosMetadados(enderecos: EnderecosMcp): string {
  return `${enderecos.recurso.replace(/\/$/, "")}/.well-known/oauth-protected-resource`;
}

/** Metadados do recurso protegido: dizem ao cliente qual servidor emite o token. */
export function metadadosDoRecurso(enderecos: EnderecosMcp): Record<string, unknown> {
  return {
    resource: enderecos.recurso,
    authorization_servers: [enderecos.servidorDeAutorizacao],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "email", "profile"],
    resource_name: "Pilar",
    resource_documentation: "https://www.pilarsoft.com.br",
  };
}

/** Cabeçalho WWW-Authenticate do 401: aponta o cliente para os metadados (início do OAuth). */
export function cabecalhoNaoAutorizado(enderecos: EnderecosMcp, tokenInvalido: boolean): string {
  const base = `Bearer resource_metadata="${urlDosMetadados(enderecos)}"`;
  return tokenInvalido ? `${base}, error="invalid_token"` : base;
}
