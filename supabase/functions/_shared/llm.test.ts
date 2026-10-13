import { assertEquals, assertThrows } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  chaveDecisao,
  chaveDeTipo,
  extrairJson,
  lerAlvo,
  lerRespostaDecisao,
  lerEventoStream,
  lerRespostaGateway,
  MODELO_PADRAO,
  modeloEmUso,
  montarCorpoGateway,
  parteDoArquivo,
  resolverDecisao,
  resolverModelo,
  tokensDoGemini,
} from "./llm.ts";

// Escolha de modelo por configuração e adaptador do AI Gateway (SPEC 108).

const env = (vars: Record<string, string>) => (k: string) => vars[k];

Deno.test("chaveDeTipo: normaliza o tipo para o nome da variável", () => {
  assertEquals(chaveDeTipo("ai_chat"), "AI_MODELO_AI_CHAT");
  assertEquals(chaveDeTipo("rdo-voz"), "AI_MODELO_RDO_VOZ");
});

Deno.test("resolverModelo: sem variável é o Gemini de sempre", () => {
  assertEquals(resolverModelo("ai_chat", env({})), MODELO_PADRAO);
  assertEquals(modeloEmUso(undefined, env({})), "gemini-2.5-flash");
});

Deno.test("resolverModelo: por função vence o padrão geral", () => {
  const e = env({ AI_MODELO: "gateway:openai/gpt-5.4-mini", AI_MODELO_AI_CHAT: "gateway:anthropic/claude-haiku-5.5" });
  assertEquals(resolverModelo("ai_chat", e), { provedor: "gateway", modelo: "anthropic/claude-haiku-5.5" });
  assertEquals(resolverModelo("guardiao_margem", e), { provedor: "gateway", modelo: "openai/gpt-5.4-mini" });
});

Deno.test("lerAlvo: valor inválido é erro com a forma certa", () => {
  assertThrows(() => lerAlvo("claude-haiku"), Error, "gemini:<modelo>");
  assertThrows(() => lerAlvo("openai:gpt-5"), Error, "gemini:<modelo>");
  assertThrows(() => lerAlvo("gateway:gpt-5"), Error, "fornecedor");
  assertEquals(lerAlvo("gemini:gemini-3.8-flash"), { provedor: "gemini", modelo: "gemini-3.8-flash" });
});

Deno.test("montarCorpoGateway: JSON, sem temperature, texto simples sem anexo", () => {
  const corpo = montarCorpoGateway({
    modelo: "anthropic/claude-haiku-5.5",
    systemPrompt: "sistema",
    userMessage: "oi",
    json: true,
    maxTokens: 100,
  });
  assertEquals(corpo.response_format, { type: "json_object" });
  assertEquals("temperature" in corpo, false);
  assertEquals((corpo.messages as Array<{ content: unknown }>)[1].content, "oi");
});

Deno.test("montarCorpoGateway: imagem e PDF viram partes; stream pede uso no fim", () => {
  const corpo = montarCorpoGateway({
    modelo: "openai/gpt-5.4-mini",
    systemPrompt: "s",
    userMessage: "leia",
    files: [
      { mimeType: "image/png", dataBase64: "AAA" },
      { mimeType: "application/pdf", dataBase64: "BBB" },
    ],
    json: false,
    maxTokens: 10,
    stream: true,
  });
  const partes = (corpo.messages as Array<{ content: Array<{ type: string }> }>)[1].content.map((p) => p.type);
  assertEquals(partes, ["text", "image_url", "file"]);
  assertEquals(corpo.stream_options, { include_usage: true });
});

Deno.test("parteDoArquivo: áudio fora do Gemini é recusado com orientação", () => {
  assertThrows(
    () => parteDoArquivo({ mimeType: "audio/webm", dataBase64: "x" }, "anthropic/claude-haiku-5.5"),
    Error,
    "gemini:<modelo>"
  );
});

Deno.test("extrairJson e lerRespostaGateway: cerca de código, texto e tokens", () => {
  assertEquals(extrairJson('```json\n{"a":1}\n```'), '{"a":1}');
  assertEquals(extrairJson('{"a":1}'), '{"a":1}');
  const r = lerRespostaGateway(
    {
      choices: [{ message: { content: '```json\n{"modo":"consulta"}\n```' } }],
      usage: { prompt_tokens: 12, completion_tokens: 5 },
    },
    true
  );
  assertEquals(r, { text: '{"modo":"consulta"}', tokensEntrada: 12, tokensSaida: 5 });
  assertEquals(lerRespostaGateway({ choices: [] }, true).text, "{}");
});

Deno.test("lerEventoStream: pedaço de texto, uso final e linha quebrada", () => {
  assertEquals(lerEventoStream('{"choices":[{"delta":{"content":"Olá"}}]}').texto, "Olá");
  const fim = lerEventoStream('{"choices":[],"usage":{"prompt_tokens":40,"completion_tokens":9}}');
  assertEquals([fim.tokensEntrada, fim.tokensSaida], [40, 9]);
  assertEquals(lerEventoStream('{"choices":[{"del'), {});
});

Deno.test("tokensDoGemini: raciocínio conta como saída", () => {
  // Resposta real do gemini-2.5-flash: 30 tokens de texto e 92 de raciocínio.
  assertEquals(tokensDoGemini({ promptTokenCount: 410, candidatesTokenCount: 30, thoughtsTokenCount: 92 }), {
    tokensEntrada: 410,
    tokensSaida: 122,
  });
});

Deno.test("tokensDoGemini: sem raciocínio ou sem usage não quebra", () => {
  assertEquals(tokensDoGemini({ promptTokenCount: 10, candidatesTokenCount: 5 }), { tokensEntrada: 10, tokensSaida: 5 });
  assertEquals(tokensDoGemini(undefined), { tokensEntrada: 0, tokensSaida: 0 });
});

Deno.test("resolverDecisao: desligado sem variável; só aceita modelo do gateway", () => {
  assertEquals(chaveDecisao("ai_chat"), "AI_DECISAO_AI_CHAT");
  assertEquals(resolverDecisao("ai_chat", env({})), null);
  assertEquals(resolverDecisao("ai_chat", env({ AI_DECISAO_AI_CHAT: "gateway:typesafe-ai/jev" })), {
    provedor: "gateway",
    modelo: "typesafe-ai/jev",
  });
  assertThrows(() => resolverDecisao("ai_chat", env({ AI_DECISAO_AI_CHAT: "gemini:gemini-2.5-flash" })));
});

Deno.test("lerRespostaDecisao: escolha com a probabilidade dela e tokens", () => {
  const r = lerRespostaDecisao({
    model: "typesafe-ai/jev",
    answers: {
      modo: { type: "choice", choice: "acao", probabilities: { consulta: 0.1, acao: 0.85, operacao: 0.05 } },
      quebrada: { type: "choice" },
      nota: { type: "score", score: 2 },
    },
    usage: { inputTokens: 1399, outputTokens: 356 },
  });
  assertEquals(r.respostas, { modo: { choice: "acao", confianca: 0.85 } });
  assertEquals(r.tokensEntrada, 1399);
  assertEquals(r.tokensSaida, 356);
});
