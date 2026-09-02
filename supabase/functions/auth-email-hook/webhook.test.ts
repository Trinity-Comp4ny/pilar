// Roda com: deno test --allow-env supabase/functions/auth-email-hook
//
// Cobre a verificação de assinatura HMAC do webhook do Supabase Auth (o elo
// mais provável de falhar em silêncio: se a assinatura não bater — secret
// rotacionado, clock skew — o hook rejeita com 401 e o convite/recovery falha
// SEM nenhum e-mail chegar a ser tentado no Resend).
//
// Precisa de AUTH_HOOK_SEND_EMAIL_SECRET setado no ambiente ANTES do módulo
// carregar (é lido uma vez no import). Usa um secret fixo só de teste.

import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const TEST_SECRET_RAW = "test-secret-nao-usar-em-producao";
const TEST_SECRET_B64 = btoa(TEST_SECRET_RAW);
Deno.env.set("AUTH_HOOK_SEND_EMAIL_SECRET", `v1,whsec_${TEST_SECRET_B64}`);

const { verifyWebhook, buildVerifyUrl } = await import("./webhook.ts");

async function sign(id: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(TEST_SECRET_B64), (c) => c.charCodeAt(0)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

function makeRequest(headers: Record<string, string>): Request {
  return new Request("https://example.com/webhook", { method: "POST", headers });
}

Deno.test("verifyWebhook aceita uma assinatura válida", async () => {
  const body = JSON.stringify({ hello: "world" });
  const id = "msg_1";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await sign(id, timestamp, body);

  const req = makeRequest({ "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": signature });
  assert(await verifyWebhook(req, body));
});

Deno.test("verifyWebhook rejeita assinatura de outro secret/corpo", async () => {
  const body = JSON.stringify({ hello: "world" });
  const id = "msg_2";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await sign(id, timestamp, "corpo diferente do enviado");

  const req = makeRequest({ "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": signature });
  assertFalse(await verifyWebhook(req, body));
});

Deno.test("verifyWebhook rejeita timestamp fora da tolerância (replay)", async () => {
  const body = JSON.stringify({ hello: "world" });
  const id = "msg_3";
  const staleTimestamp = String(Math.floor(Date.now() / 1000) - 10 * 60); // 10min atrás, tolerância é 5min
  const signature = await sign(id, staleTimestamp, body);

  const req = makeRequest({ "webhook-id": id, "webhook-timestamp": staleTimestamp, "webhook-signature": signature });
  assertFalse(await verifyWebhook(req, body));
});

Deno.test("verifyWebhook rejeita quando falta header obrigatório", async () => {
  const body = JSON.stringify({ hello: "world" });
  const req = makeRequest({ "webhook-timestamp": String(Math.floor(Date.now() / 1000)) });
  assertFalse(await verifyWebhook(req, body));
});

Deno.test("buildVerifyUrl monta a URL de verificação com token e tipo", () => {
  const url = buildVerifyUrl({
    site_url: "https://app.pilarsoft.com.br",
    token_hash: "abc123",
    email_action_type: "invite",
    redirect_to: "https://app.pilarsoft.com.br/profile-setup",
    token: "unused",
  });
  const parsed = new URL(url);
  assertEquals(parsed.pathname, "/auth/v1/verify");
  assertEquals(parsed.searchParams.get("token"), "abc123");
  assertEquals(parsed.searchParams.get("type"), "invite");
  assertEquals(parsed.searchParams.get("redirect_to"), "https://app.pilarsoft.com.br/profile-setup");
});

Deno.test("buildVerifyUrl força /reset-password em recovery, ignorando o redirect_to do cliente", () => {
  const url = buildVerifyUrl({
    site_url: "https://app.pilarsoft.com.br",
    token_hash: "xyz",
    email_action_type: "recovery",
    redirect_to: "https://app.pilarsoft.com.br/qualquer-outra-rota",
    token: "unused",
  });
  const parsed = new URL(url);
  assertEquals(parsed.searchParams.get("redirect_to"), "https://app.pilarsoft.com.br/reset-password");
});
