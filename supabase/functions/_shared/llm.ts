/**
 * Escolha do modelo de IA por configuração (SPEC 106).
 *
 *   AI_MODELO            padrão de todas as funções
 *   AI_MODELO_<TIPO>     por função (TIPO = o `tipo` da chamada, ex.: AI_MODELO_AI_CHAT)
 *
 * Formato: "gemini:<modelo>" (API do Google direto, como sempre foi) ou
 * "gateway:<fornecedor>/<modelo>" (Vercel AI Gateway, formato compatível com OpenAI: um
 * adaptador atende OpenAI, Anthropic, Google e os demais do catálogo). Sem variável, vale
 * MODELO_PADRAO e nada muda em relação a antes desta camada.
 *
 * Aqui ficam a leitura da configuração e o adaptador do gateway. O Gemini direto continua
 * em ai-client.ts; ai-client.ts escolhe o caminho por resolverModelo().
 */

export type Provedor = "gemini" | "gateway";

export interface ModeloAlvo {
  provedor: Provedor;
  modelo: string;
}

export const MODELO_PADRAO: ModeloAlvo = { provedor: "gemini", modelo: "gemini-2.5-flash" };

export const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

type LerEnv = (chave: string) => string | undefined;
const lerEnvDeno: LerEnv = (chave) => Deno.env.get(chave);

/** "ai_chat" → "AI_MODELO_AI_CHAT"; "rdo-voz" → "AI_MODELO_RDO_VOZ". */
export function chaveDeTipo(tipo: string): string {
  return `AI_MODELO_${tipo.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

/** Lê "gemini:x" ou "gateway:fornecedor/modelo". Valor inválido é erro, não silêncio. */
export function lerAlvo(valor: string): ModeloAlvo {
  const i = valor.indexOf(":");
  const provedor = valor.slice(0, i).trim();
  const modelo = valor.slice(i + 1).trim();
  if (i <= 0 || !modelo || (provedor !== "gemini" && provedor !== "gateway")) {
    throw new Error(
      `Configuração de modelo inválida: "${valor}". Use "gemini:<modelo>" ou "gateway:<fornecedor>/<modelo>".`
    );
  }
  if (provedor === "gateway" && !modelo.includes("/")) {
    throw new Error(`Modelo do gateway precisa do fornecedor: "${valor}" (ex.: gateway:anthropic/claude-haiku-5.5).`);
  }
  return { provedor, modelo };
}

/** Modelo da função `tipo`: AI_MODELO_<TIPO>, depois AI_MODELO, depois o padrão. */
export function resolverModelo(tipo?: string, lerEnv: LerEnv = lerEnvDeno): ModeloAlvo {
  const especifico = tipo ? lerEnv(chaveDeTipo(tipo))?.trim() : undefined;
  if (especifico) return lerAlvo(especifico);
  const geral = lerEnv("AI_MODELO")?.trim();
  if (geral) return lerAlvo(geral);
  return MODELO_PADRAO;
}

/** Nome do modelo como fica no débito de tokens, no agent_runs e no Sentry. */
export function modeloEmUso(tipo?: string, lerEnv: LerEnv = lerEnvDeno): string {
  return resolverModelo(tipo, lerEnv).modelo;
}

// ---------------------------------------------------------------------------
// Adaptador do gateway (formato chat/completions da OpenAI)
// ---------------------------------------------------------------------------

export interface Arquivo {
  mimeType: string;
  dataBase64: string;
}

type ParteConteudo =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

/** Arquivo no formato do gateway. Áudio fica de fora: só o Gemini direto aceita hoje. */
export function parteDoArquivo(f: Arquivo, modelo: string): ParteConteudo {
  const dataUrl = `data:${f.mimeType};base64,${f.dataBase64}`;
  if (f.mimeType.startsWith("image/")) return { type: "image_url", image_url: { url: dataUrl } };
  if (f.mimeType === "application/pdf")
    return { type: "file", file: { filename: "documento.pdf", file_data: dataUrl } };
  throw new Error(
    `O modelo ${modelo} (gateway) não recebe ${f.mimeType} por aqui. Para áudio, configure esta função com "gemini:<modelo>".`
  );
}

export function montarCorpoGateway(o: {
  modelo: string;
  systemPrompt: string;
  userMessage: string;
  files?: Arquivo[];
  json: boolean;
  maxTokens: number;
  stream?: boolean;
}): Record<string, unknown> {
  const conteudo: ParteConteudo[] = [{ type: "text", text: o.userMessage }];
  for (const f of o.files ?? []) conteudo.push(parteDoArquivo(f, o.modelo));
  return {
    model: o.modelo,
    messages: [
      { role: "system", content: o.systemPrompt },
      { role: "user", content: o.files?.length ? conteudo : o.userMessage },
    ],
    max_tokens: o.maxTokens,
    // Sem temperature: modelos de raciocínio (GPT-5, Gemini 3) recusam valor diferente
    // do padrão. Cada modelo usa o próprio padrão.
    ...(o.json && { response_format: { type: "json_object" } }),
    ...(o.stream && { stream: true, stream_options: { include_usage: true } }),
  };
}

/** Tira a cerca de código que alguns modelos põem em volta do JSON (```json ... ```). */
export function extrairJson(texto: string): string {
  const t = texto.trim();
  const cerca = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(t);
  return cerca ? cerca[1].trim() : t;
}

export interface RespostaModelo {
  text: string;
  tokensEntrada: number;
  tokensSaida: number;
}

/** Texto e tokens de uma resposta chat/completions. */
export function lerRespostaGateway(corpo: unknown, json: boolean): RespostaModelo {
  const c = corpo as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const bruto = c.choices?.[0]?.message?.content ?? "";
  return {
    text: json ? extrairJson(bruto) || "{}" : bruto,
    tokensEntrada: c.usage?.prompt_tokens ?? 0,
    tokensSaida: c.usage?.completion_tokens ?? 0,
  };
}

function chaveGateway(): string {
  const chave = Deno.env.get("AI_GATEWAY_API_KEY");
  if (!chave) throw new Error("AI_GATEWAY_API_KEY não definida: necessária para modelos gateway:*");
  return chave;
}

export async function chamarGateway(
  alvo: ModeloAlvo,
  o: {
    systemPrompt: string;
    userMessage: string;
    files?: Arquivo[];
    json: boolean;
    maxTokens: number;
    timeoutMs: number;
  }
): Promise<RespostaModelo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chaveGateway()}` },
      body: JSON.stringify(montarCorpoGateway({ modelo: alvo.modelo, ...o })),
      signal: controller.signal,
    });
    if (!res.ok)
      throw new Error(`AI Gateway error (${res.status}) em ${alvo.modelo}: ${(await res.text()).slice(0, 500)}`);
    return lerRespostaGateway(await res.json(), o.json);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`AI Gateway timeout após ${o.timeoutMs}ms em ${alvo.modelo}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Uma linha "data: {...}" do stream: o pedaço de texto e, no fim, os tokens. */
export function lerEventoStream(payload: string): { texto?: string; tokensEntrada?: number; tokensSaida?: number } {
  try {
    const d = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
    };
    return {
      texto: d.choices?.[0]?.delta?.content ?? undefined,
      tokensEntrada: d.usage?.prompt_tokens,
      tokensSaida: d.usage?.completion_tokens,
    };
  } catch {
    return {};
  }
}

export async function* streamGateway(
  alvo: ModeloAlvo,
  o: { systemPrompt: string; userMessage: string; maxTokens: number; timeoutMs: number }
): AsyncGenerator<string, { tokensEntrada: number; tokensSaida: number }, unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  let tokensEntrada = 0;
  let tokensSaida = 0;
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chaveGateway()}` },
      body: JSON.stringify(montarCorpoGateway({ modelo: alvo.modelo, json: false, stream: true, ...o })),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(
        `AI Gateway error (${res.status}) em ${alvo.modelo}: ${res.body ? (await res.text()).slice(0, 500) : "sem corpo"}`
      );
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const linha = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!linha.startsWith("data:")) continue;
        const payload = linha.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        const ev = lerEventoStream(payload);
        if (ev.texto) yield ev.texto;
        if (ev.tokensEntrada !== undefined) tokensEntrada = ev.tokensEntrada;
        if (ev.tokensSaida !== undefined) tokensSaida = ev.tokensSaida;
      }
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`AI Gateway timeout após ${o.timeoutMs}ms em ${alvo.modelo}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  return { tokensEntrada, tokensSaida };
}
