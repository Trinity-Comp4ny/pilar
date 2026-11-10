import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ambienteDrive, retornoSeguro, urlDeRetorno } from "./google-drive-conexao.ts";

Deno.test("ambiente sem as chaves do Google não liga a integração", () => {
  assertEquals(
    ambienteDrive(() => undefined),
    null
  );
  const env: Record<string, string> = {
    GOOGLE_DRIVE_CLIENT_ID: "c",
    GOOGLE_DRIVE_CLIENT_SECRET: "s",
    GOOGLE_DRIVE_TOKEN_KEY: "k",
    SUPABASE_URL: "https://abc.supabase.co/",
  };
  const amb = ambienteDrive((k) => env[k]);
  assertEquals(amb?.redirectUri, "https://abc.supabase.co/functions/v1/google-drive-oauth");
  assertEquals(amb?.siteUrl, "https://app.pilarsoft.com.br");
});

Deno.test("retorno só aceita caminho do próprio app", () => {
  assertEquals(retornoSeguro("/projetos/abc?aba=arquivos"), "/projetos/abc?aba=arquivos");
  assertEquals(retornoSeguro("//evil.com"), "/");
  assertEquals(retornoSeguro("https://evil.com"), "/");
  assertEquals(retornoSeguro("/\\evil.com"), "/");
  assertEquals(retornoSeguro(42), "/");
});

Deno.test("URL de retorno junta o status à query que já existe", () => {
  assertEquals(
    urlDeRetorno("https://app.pilarsoft.com.br", "/projetos/abc?aba=arquivos", "conectado"),
    "https://app.pilarsoft.com.br/projetos/abc?aba=arquivos&drive=conectado"
  );
  assertEquals(
    urlDeRetorno("https://app.pilarsoft.com.br", "//evil.com", "erro"),
    "https://app.pilarsoft.com.br/?drive=erro"
  );
});
