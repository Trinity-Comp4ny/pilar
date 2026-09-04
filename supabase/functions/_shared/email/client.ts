/**
 * Saída única de e-mail do Pilar (ADR 0039). Resend via fetch, retry com backoff,
 * text/plain automático, Idempotency-Key, remetente por classe, registro em
 * `email_envios` e recusa de endereço suprimido.
 *
 * Classes:
 * - "plataforma": Pilar → usuário do Pilar (auth, trial, LGPD, notificação).
 * - "escritorio": escritório → cliente final, via Pilar (cobrança, proposta, portal).
 *   Exige `empresa`; `from` vira "<Empresa> via Pilar", `replyTo` vira o e-mail da empresa.
 *
 * Falha alta: sem RESEND_API_KEY lança erro, a menos que EMAIL_DRY_RUN=true (só .env local).
 *
 * O log é best-effort: falha ao gravar em `email_envios` nunca impede o envio nem
 * derruba a função que chamou (um e-mail que sai sem linha de log é ruim; um
 * e-mail que não sai porque o log falhou é pior).
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  /** Identificador estável do e-mail (ex.: "auth_recovery", "cobranca_lembrete"). Vira tag e vai para o log. */
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
  /** Item do domínio a que este e-mail se refere, para auditoria. */
  referencia?: { tipo: string; id?: string | null };
  /** Chave natural pra não duplicar (ex.: "fatura-<id>-lembrete-2026-09-04"). Sem ela, uma por chamada. */
  idempotencyKey?: string;
  attachments?: { filename: string; content: string }[];
}

export type SendEmailResult =
  | { ok: true; resendId: string | null; envioId: string | null }
  | { ok: false; skipped: "suprimido" | "dry_run"; envioId: string | null };

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

// ---------------------------------------------------------------------------
// Registro em email_envios (service role; RLS não se aplica)
// ---------------------------------------------------------------------------

let logClient: SupabaseClient | null | undefined;

function getLogClient(): SupabaseClient | null {
  if (logClient !== undefined) return logClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  logClient = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  if (!logClient) console.warn("[email] sem SUPABASE_SERVICE_ROLE_KEY: envio não será registrado em email_envios");
  return logClient;
}

interface LogRow {
  empresa_id: string | null;
  classe: EmailClasse;
  tipo: string;
  destinatario: string;
  assunto: string;
  status: string;
  erro?: string | null;
  resend_id?: string | null;
  referencia_tipo?: string | null;
  referencia_id?: string | null;
  idempotency_key?: string | null;
}

async function logInsert(row: LogRow): Promise<string | null> {
  const db = getLogClient();
  if (!db) return null;
  const { data, error } = await db.from("email_envios").insert(row).select("id").single();
  if (error) {
    console.error(`[email] falha ao registrar envio (${row.tipo}): ${error.message}`);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

async function logUpdate(id: string | null, patch: Record<string, unknown>): Promise<void> {
  if (!id) return;
  const db = getLogClient();
  if (!db) return;
  const { error } = await db.from("email_envios").update(patch).eq("id", id);
  if (error) console.error(`[email] falha ao atualizar registro de envio: ${error.message}`);
}

/** Endereços suprimidos (bounce duro ou reclamação). Nunca recebem de novo. */
async function suprimidos(destinos: string[]): Promise<Set<string>> {
  const db = getLogClient();
  if (!db) return new Set();
  const { data, error } = await db
    .from("email_supressoes")
    .select("email")
    .in(
      "email",
      destinos.map((d) => d.toLowerCase())
    );
  if (error) {
    console.error(`[email] falha ao consultar supressões: ${error.message}`);
    return new Set();
  }
  return new Set(((data ?? []) as { email: string }[]).map((r) => r.email.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (input.classe === "escritorio" && !input.empresa) {
    throw new Error("[email] classe 'escritorio' exige `empresa`");
  }

  const todos = (Array.isArray(input.to) ? input.to : [input.to]).map((e) => e.trim()).filter(Boolean);
  if (todos.length === 0) throw new Error("[email] nenhum destinatário");

  const bloqueados = await suprimidos(todos);
  const to = todos.filter((e) => !bloqueados.has(e.toLowerCase()));

  const base: Omit<LogRow, "status"> = {
    empresa_id: input.empresa?.id ?? null,
    classe: input.classe,
    tipo: input.tipo,
    destinatario: todos.join(", "),
    assunto: input.subject,
    referencia_tipo: input.referencia?.tipo ?? null,
    referencia_id: input.referencia?.id ?? null,
    idempotency_key: input.idempotencyKey ?? null,
  };

  if (to.length === 0) {
    const envioId = await logInsert({ ...base, status: "suprimido", erro: "destinatário em email_supressoes" });
    console.warn(`[email] ${input.tipo}: todos os destinatários estão suprimidos, envio pulado`);
    return { ok: false, skipped: "suprimido", envioId };
  }

  const text = input.text ?? htmlToText(input.html);
  const from = resolveFrom(input);
  const replyTo = resolveReplyTo(input);
  const idempotencyKey = (input.idempotencyKey ?? crypto.randomUUID()).slice(0, 256);

  if (DRY_RUN) {
    const envioId = await logInsert({ ...base, status: "dry_run" });
    console.warn(`[email] DRY_RUN tipo=${input.tipo} to=${to.join(",")} subject="${input.subject}" from="${from}"`);
    return { ok: false, skipped: "dry_run", envioId };
  }

  if (!RESEND_API_KEY) {
    throw new Error("[email] RESEND_API_KEY não configurada (defina EMAIL_DRY_RUN=true em dev local)");
  }

  const envioId = await logInsert({ ...base, status: "enviando" });

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
        const resendId = data?.id ?? null;
        await logUpdate(envioId, { status: "enviado", resend_id: resendId, erro: null });
        return { ok: true, resendId, envioId };
      }

      const errBody = await res.text();
      const retryable = res.status >= 500 || res.status === 429;
      lastError = new Error(`Resend ${res.status}: ${errBody}`);
      if (!retryable || attempt === MAX_RETRIES - 1) throw lastError;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_RETRIES - 1) break;
    }

    await sleep(BASE_DELAY_MS * 2 ** attempt);
  }

  const erro = lastError ?? new Error("[email] falha desconhecida");
  await logUpdate(envioId, { status: "falhou", erro: erro.message.slice(0, 2000) });
  throw erro;
}
