// Roda com: deno test --no-check --allow-env supabase/functions/resend-webhook
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { destinatarioDoEvento, deveSuprimir, statusDoEvento, verifySignature } from "./svix.ts";

const SECRET_RAW = new Uint8Array(32).map((_, i) => i + 1);
const SECRET = `whsec_${btoa(String.fromCharCode(...SECRET_RAW))}`;

async function assinar(id: string, ts: string, body: string, secret = SECRET_RAW): Promise<string> {
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

function req(headers: Record<string, string>): Request {
  return new Request("https://x/resend-webhook", { method: "POST", headers });
}

Deno.test("aceita assinatura válida nos headers svix-*", async () => {
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "re_1" } });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = await assinar("msg_1", ts, body);
  assert(await verifySignature(req({ "svix-id": "msg_1", "svix-timestamp": ts, "svix-signature": sig }), body, SECRET));
});

Deno.test("aceita também os headers webhook-* e várias assinaturas no header", async () => {
  const body = "{}";
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = await assinar("m", ts, body);
  assert(
    await verifySignature(
      req({ "webhook-id": "m", "webhook-timestamp": ts, "webhook-signature": `v1,AAAA ${sig}` }),
      body,
      SECRET
    )
  );
});

Deno.test("recusa assinatura de outro secret, corpo alterado e timestamp velho", async () => {
  const body = "{}";
  const ts = String(Math.floor(Date.now() / 1000));
  const outra = await assinar("m", ts, body, new Uint8Array(32).fill(9));
  assertFalse(
    await verifySignature(req({ "svix-id": "m", "svix-timestamp": ts, "svix-signature": outra }), body, SECRET)
  );
  const sig = await assinar("m", ts, body);
  assertFalse(
    await verifySignature(req({ "svix-id": "m", "svix-timestamp": ts, "svix-signature": sig }), body + " ", SECRET)
  );
  const velho = String(Math.floor(Date.now() / 1000) - 3600);
  const sigVelha = await assinar("m", velho, body);
  assertFalse(
    await verifySignature(req({ "svix-id": "m", "svix-timestamp": velho, "svix-signature": sigVelha }), body, SECRET)
  );
});

Deno.test("sem secret configurado, recusa tudo", async () => {
  assertFalse(
    await verifySignature(req({ "svix-id": "m", "svix-timestamp": "1", "svix-signature": "v1,x" }), "{}", "")
  );
});

Deno.test("mapeia eventos para status e ignora os não rastreados", () => {
  assertEquals(statusDoEvento("email.delivered"), "entregue");
  assertEquals(statusDoEvento("email.delivery_delayed"), "atrasado");
  assertEquals(statusDoEvento("email.bounced"), "bounce");
  assertEquals(statusDoEvento("email.complained"), "reclamacao");
  assertEquals(statusDoEvento("email.sent"), null);
  assertEquals(statusDoEvento("email.opened"), null);
});

Deno.test("suprime reclamação e bounce permanente, não bounce transitório", () => {
  assert(deveSuprimir({ type: "email.complained" }));
  assert(deveSuprimir({ type: "email.bounced", data: { bounce: { type: "Permanent" } } }));
  assert(deveSuprimir({ type: "email.bounced" }), "sem tipo, trata como permanente");
  assertFalse(deveSuprimir({ type: "email.bounced", data: { bounce: { type: "Transient" } } }));
  assertFalse(deveSuprimir({ type: "email.delivered" }));
});

Deno.test("destinatário do evento em minúsculas, primeiro da lista", () => {
  assertEquals(destinatarioDoEvento({ type: "x", data: { to: ["  Ana@X.com ", "b@x.com"] } }), "ana@x.com");
  assertEquals(destinatarioDoEvento({ type: "x", data: { to: "B@Y.com" } }), "b@y.com");
  assertEquals(destinatarioDoEvento({ type: "x" }), null);
});
