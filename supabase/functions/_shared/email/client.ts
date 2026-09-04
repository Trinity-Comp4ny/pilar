/**
 * Saída única de e-mail do Pilar (ADR 0039). Resend via fetch, retry com backoff,
 * text/plain automático, Idempotency-Key, remetente por classe.
 *
 * Classes:
 * - "plataforma": Pilar → usuário do Pilar (auth, trial, LGPD, notificação).
 * - "escritorio": escritório → cliente final, via Pilar (cobrança, proposta, portal).
 *   Exige `empresa`; `from` vira "<Empresa> via Pilar", `replyTo` vira o e-mail da empresa.
 *
 * Falha alta: sem RESEND_API_KEY lança erro, a menos que EMAIL_DRY_RUN=true (só .env local).
 */

import { BRAND } from "./brand.ts";
import { htmlToText } from "./html.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const DRY_RUN = (Deno.env.get("EMAIL_DRY_RUN") ?? "false") === "true";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

export type EmailClasse = "plataforma" | "escritorio";

export interface EmailEmpresa {
  id?: string;
  nome: string;
  email?: string | null;
}

export interface SendEmailInput {
  classe: EmailClasse;
  /** Identificador estável do e-mail (ex.: "auth_recovery", "cobranca_lembrete"). Vira tag no Resend. */
  tipo: string;
  to: string | string[];
  subject: string;
  html: string;
  /** Versão texto. Gerada do HTML quando omitida. */
  text?: string;
  /** Sobrescreve o reply-to calculado pela classe. */
  replyTo?: string;
  /** Obrigatório na classe "escritorio". */
  empresa?: EmailEmpresa;
  /** Chave natural pra não duplicar (ex.: "fatura-<id>-lembrete-2026-09-04"). Sem ela, uma por chamada. */
  idempotencyKey?: string;
  attachments?: { filename: string; content: string }[];
}

export type SendEmailResult = { ok: true; resendId: string | null } | { ok: false; skipped: "dry_run" };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extrai o endereço de "Nome <endereco>" (ou devolve a string se já for só endereço). */
export function fromAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

/** Display name sem caracteres que quebram o header. */
function safeDisplayName(nome: string): string {
  return (
    nome
      .replace(/["<>\r\n]/g, "")
      .trim()
      .slice(0, 60) || BRAND.nome
  );
}

export function resolveFrom(input: Pick<SendEmailInput, "classe" | "empresa">): string {
  if (input.classe === "escritorio" && input.empresa?.nome) {
    return `"${safeDisplayName(input.empresa.nome)} via ${BRAND.nome}" <${fromAddress(BRAND.from)}>`;
  }
  return BRAND.from;
}

export function resolveReplyTo(input: Pick<SendEmailInput, "classe" | "empresa" | "replyTo">): string | undefined {
  if (input.replyTo) return input.replyTo;
  if (input.classe === "escritorio" && input.empresa?.email) return input.empresa.email;
  return BRAND.replyTo || undefined;
}

/** Tags do Resend só aceitam ASCII letras, números, _ e -. */
function tagValue(v: string): string {
  return v.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (input.classe === "escritorio" && !input.empresa) {
    throw new Error("[email] classe 'escritorio' exige `empresa`");
  }

  const to = Array.isArray(input.to) ? input.to : [input.to];
  const text = input.text ?? htmlToText(input.html);
  const from = resolveFrom(input);
  const replyTo = resolveReplyTo(input);
  const idempotencyKey = (input.idempotencyKey ?? crypto.randomUUID()).slice(0, 256);

  if (DRY_RUN) {
    console.warn(`[email] DRY_RUN tipo=${input.tipo} to=${to.join(",")} subject="${input.subject}" from="${from}"`);
    return { ok: false, skipped: "dry_run" };
  }

  if (!RESEND_API_KEY) {
    throw new Error("[email] RESEND_API_KEY não configurada (defina EMAIL_DRY_RUN=true em dev local)");
  }

  const body = JSON.stringify({
    from,
    to,
    subject: input.subject,
    html: input.html,
    text,
    ...(replyTo && { reply_to: replyTo }),
    ...(input.attachments?.length && { attachments: input.attachments }),
    tags: [
      { name: "tipo", value: tagValue(input.tipo) },
      { name: "classe", value: input.classe },
    ],
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body,
      });

      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { id?: string } | null;
        return { ok: true, resendId: data?.id ?? null };
      }

      const errBody = await res.text();
      const retryable = res.status >= 500 || res.status === 429;
      lastError = new Error(`Resend ${res.status}: ${errBody}`);
      if (!retryable || attempt === MAX_RETRIES - 1) throw lastError;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_RETRIES - 1) throw lastError;
    }

    await sleep(BASE_DELAY_MS * 2 ** attempt);
  }

  throw lastError ?? new Error("[email] falha desconhecida");
}
