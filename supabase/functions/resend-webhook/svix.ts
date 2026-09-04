// Verificação da assinatura Svix dos webhooks do Resend, separada do index.ts de
// propósito: index.ts chama serve(...) no top-level, então importá-lo de um teste
// ligaria um listener HTTP. Este arquivo não tem side effect.
//
// O Resend assina no mesmo esquema do hook de e-mail do Supabase (standard-webhooks):
//   assinatura = base64(HMAC_SHA256(secret, "<id>.<timestamp>.<body>"))
// Headers: svix-id / svix-timestamp / svix-signature (aceitamos também webhook-*).

import { createLogger } from "../_shared/logger.ts";

const log = createLogger("resend-webhook");

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

/** Eventos que mudam o estado de um envio. Os demais (opened, clicked) são ignorados. */
export type ResendEventType =
  "email.sent" | "email.delivered" | "email.delivery_delayed" | "email.bounced" | "email.complained";

export interface ResendEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
  };
}

/** Status de `email_envios` para cada evento. `null` = evento que não interessa. */
export function statusDoEvento(type: string): string | null {
  switch (type) {
    case "email.delivered":
      return "entregue";
    case "email.delivery_delayed":
      return "atrasado";
    case "email.bounced":
      return "bounce";
    case "email.complained":
      return "reclamacao";
    default:
      // email.sent não muda nada (já gravamos 'enviado' na resposta da API);
      // opened/clicked não são rastreados de propósito.
      return null;
  }
}

/**
 * Bounce transitório (caixa cheia, servidor fora) não vira supressão: o endereço
 * pode voltar. Sem informação de tipo, trata como permanente para proteger a
 * reputação do domínio, que é o custo mais caro de errar aqui.
 */
export function deveSuprimir(evento: ResendEvent): boolean {
  if (evento.type === "email.complained") return true;
  if (evento.type !== "email.bounced") return false;
  const tipo = evento.data?.bounce?.type?.toLowerCase() ?? "";
  return tipo !== "transient";
}

function decodeSecret(secret: string): Uint8Array {
  const b64 = secret.replace(/^v1,whsec_/, "").replace(/^whsec_/, "");
  const chars = atob(b64);
  const arr = new Uint8Array(chars.length);
  for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
  return arr;
}

function header(req: Request, nome: string): string | null {
  return req.headers.get(`svix-${nome}`) ?? req.headers.get(`webhook-${nome}`);
}

export async function verifySignature(req: Request, body: string, secret: string): Promise<boolean> {
  if (!secret) {
    log.error("RESEND_WEBHOOK_SECRET não configurado, webhook recusado");
    return false;
  }

  const id = header(req, "id");
  const timestamp = header(req, "timestamp");
  const signatureHeader = header(req, "signature");
  if (!id || !timestamp || !signatureHeader) {
    log.error("headers de assinatura ausentes", undefined, {
      hasId: !!id,
      hasTimestamp: !!timestamp,
      hasSignature: !!signatureHeader,
    });
    return false;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const tsNum = parseInt(timestamp, 10);
  if (!Number.isFinite(tsNum) || Math.abs(nowSec - tsNum) > SIGNATURE_TOLERANCE_SECONDS) {
    log.error("timestamp fora da tolerância", undefined, { tsNum, nowSec });
    return false;
  }

  const key = await crypto.subtle.importKey("raw", decodeSecret(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  // O header pode trazer várias assinaturas separadas por espaço (rotação de secret).
  return signatureHeader.split(" ").some((s) => s === `v1,${expected}`);
}

/** Primeiro destinatário do evento, em minúsculas. É a chave de supressão. */
export function destinatarioDoEvento(evento: ResendEvent): string | null {
  const to = evento.data?.to;
  const primeiro = Array.isArray(to) ? to[0] : to;
  return primeiro ? primeiro.trim().toLowerCase() : null;
}
