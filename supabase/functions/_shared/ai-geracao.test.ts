import { assertEquals, assertThrows } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ErroIa } from "./ai-erros.ts";
import { configDeGeracao, exigirParadaUtil, motivoDeParada } from "./ai-geracao.ts";

Deno.test("configDeGeracao: JSON sai com temperatura 0 e teto de raciocínio em 1/4 do limite", () => {
  assertEquals(configDeGeracao("gemini-2.5-flash", { modo: "json", maxOutputTokens: 4096 }), {
    temperature: 0,
    maxOutputTokens: 4096,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingBudget: 1024 },
  });
  const guardiao = configDeGeracao("gemini-2.5-flash", { modo: "json", maxOutputTokens: 2048 });
  assertEquals(guardiao.thinkingConfig, { thinkingBudget: 512 });
});

Deno.test("configDeGeracao: texto livre mantém 0.7 e não pede JSON", () => {
  const c = configDeGeracao("gemini-2.5-flash", { modo: "texto", maxOutputTokens: 4096 });
  assertEquals(c.temperature, 0.7);
  assertEquals("responseMimeType" in c, false);
  assertEquals(c.thinkingConfig, { thinkingBudget: 1024 });
});

Deno.test("configDeGeracao: fora da família 2.5 não manda thinkingBudget", () => {
  const c = configDeGeracao("gemini-3.8-flash", { modo: "json", maxOutputTokens: 4096 });
  assertEquals("thinkingConfig" in c, false);
  assertEquals(c.temperature, 0);
});

Deno.test("motivoDeParada: lê o candidato ou o bloqueio do prompt", () => {
  assertEquals(motivoDeParada({ candidates: [{ finishReason: "STOP" }] }), "STOP");
  assertEquals(motivoDeParada({ candidates: [{ finishReason: "MAX_TOKENS" }] }), "MAX_TOKENS");
  assertEquals(motivoDeParada({ promptFeedback: { blockReason: "SAFETY" } }), "PROMPT_BLOCKED");
  assertEquals(motivoDeParada({}), undefined);
});

Deno.test("exigirParadaUtil: MAX_TOKENS vira saida_truncada, filtro vira bloqueada, STOP passa", () => {
  const truncada = assertThrows(() => exigirParadaUtil("MAX_TOKENS", "gemini-2.5-flash"), ErroIa) as ErroIa;
  assertEquals(truncada.tipo, "saida_truncada");
  const bloqueada = assertThrows(() => exigirParadaUtil("SAFETY", "gemini-2.5-flash"), ErroIa) as ErroIa;
  assertEquals(bloqueada.tipo, "bloqueada");
  exigirParadaUtil("STOP", "gemini-2.5-flash");
  exigirParadaUtil(undefined, "gemini-2.5-flash");
});
