import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { dicaResposta, formatarData, urlAbsoluta } from "./regras.ts";

const APP = "https://app.pilarsoft.com.br/";

Deno.test("urlAbsoluta: relativo vira absoluto, sem barra dupla", () => {
  assertEquals(urlAbsoluta("/ultra-admin?tab=trials", APP), "https://app.pilarsoft.com.br/ultra-admin?tab=trials");
});

Deno.test("urlAbsoluta: sem link cai no painel; absoluto passa direto", () => {
  assertEquals(urlAbsoluta(null, APP), "https://app.pilarsoft.com.br/ultra-admin");
  assertEquals(urlAbsoluta("https://status.pilarsoft.co", APP), "https://status.pilarsoft.co");
});

Deno.test("dicaResposta: só novo cadastro convida a responder", () => {
  assertEquals(dicaResposta("novo_cadastro"), "Responda este e-mail para falar direto com quem se cadastrou.");
  assertEquals(dicaResposta("ativar_plano_bloqueado_carding"), null);
});

Deno.test("formatarData: usa o fuso de Brasília", () => {
  assertEquals(formatarData("2026-10-13T17:05:00Z"), "13/10/2026, 14:05");
});
