import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createOwnerSchema, parseAllowedOrigins, verificarRequisicao } from "./portao.ts";

const env = {
  allowedOrigins: "https://app.pilarsoft.com.br, https://staging.pilarsoft.com.br/",
  superAdminKey: "chave-certa",
};
const valida = {
  method: "POST",
  contentType: "application/json; charset=utf-8",
  origin: "https://app.pilarsoft.com.br",
  superAdminKey: "chave-certa",
};

const status = (r: ReturnType<typeof verificarRequisicao>) => (r.ok ? 200 : r.status);

Deno.test("requisição válida passa e devolve a origin normalizada", () => {
  assertEquals(verificarRequisicao(valida, env), { ok: true, origin: "https://app.pilarsoft.com.br" });
  assertEquals(verificarRequisicao({ ...valida, origin: "https://staging.pilarsoft.com.br/" }, env), {
    ok: true,
    origin: "https://staging.pilarsoft.com.br",
  });
});

Deno.test("só POST", () => {
  assertEquals(status(verificarRequisicao({ ...valida, method: "GET" }, env)), 405);
});

Deno.test("form-encoded, multipart ou sem Content-Type: 415 (vetor de CSRF)", () => {
  for (const contentType of ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain", null]) {
    assertEquals(status(verificarRequisicao({ ...valida, contentType }, env)), 415, String(contentType));
  }
});

Deno.test("origin ausente, fora da allowlist ou parecida: 403", () => {
  for (const origin of [
    null,
    "",
    "https://evil.com",
    "https://app.pilarsoft.com.br.evil.com",
    "http://app.pilarsoft.com.br",
  ]) {
    assertEquals(status(verificarRequisicao({ ...valida, origin }, env)), 403, String(origin));
  }
});

Deno.test("allowlist vazia não libera tudo: é erro de configuração (500)", () => {
  assertEquals(status(verificarRequisicao(valida, { ...env, allowedOrigins: " , " })), 500);
});

Deno.test("chave ausente ou errada: 401; chave não configurada no servidor: 500", () => {
  assertEquals(status(verificarRequisicao({ ...valida, superAdminKey: null }, env)), 401);
  assertEquals(status(verificarRequisicao({ ...valida, superAdminKey: "chave-errada" }, env)), 401);
  assertEquals(status(verificarRequisicao({ ...valida, superAdminKey: "chave-cert" }, env)), 401);
  assertEquals(status(verificarRequisicao(valida, { ...env, superAdminKey: undefined })), 500);
  assertEquals(status(verificarRequisicao(valida, { ...env, superAdminKey: "" })), 500);
});

Deno.test("checagens anônimas vêm antes da chave: origin errada com chave certa ainda é 403", () => {
  assertEquals(status(verificarRequisicao({ ...valida, origin: "https://evil.com" }, env)), 403);
});

Deno.test("parseAllowedOrigins tira espaço, barra final e item vazio", () => {
  assertEquals(parseAllowedOrigins(" https://a.com/ ,,https://b.com"), ["https://a.com", "https://b.com"]);
});

Deno.test("entrada: e-mail normalizado, nome da empresa obrigatório", () => {
  const r = createOwnerSchema.safeParse({ email: " Dono@Empresa.COM ", company_name: "Escritório X" });
  assertEquals(r.success && r.data.email, "dono@empresa.com");
  assertEquals(createOwnerSchema.safeParse({ email: "dono@empresa.com" }).success, false);
  assertEquals(createOwnerSchema.safeParse({ email: "não-é-email", company_name: "X Ltda" }).success, false);
});
