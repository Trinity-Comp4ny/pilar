import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateLgpdExclusaoDados } from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";
import { withSentry } from "../_shared/sentry.ts";

/**
 * send-data-deletion-notification
 *
 * Dispara email para o admin da empresa quando um usuário solicita exclusão
 * dos próprios dados via /privacidade (LGPD Art. 18 IV).
 *
 * Idempotente: se `notified_at` já estiver setado, retorna 200 sem reenviar.
 *
 * Auth model: chamada via pg_net (server-side), via service role JWT no header,
 * ou via trigger pg_notify + worker. Não exige usuário autenticado — valida
 * que o caller tem service role OR fornece um shared secret via x-pilar-secret.
 *
 * Body: { request_id: UUID }
 */

const log = createLogger("send-data-deletion-notification");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://app.pilarsoft.com.br";
const SHARED_SECRET = Deno.env.get("DATA_DELETION_NOTIFY_SECRET") ?? "";
const FALLBACK_DPO = Deno.env.get("LGPD_DPO_EMAIL") ?? "privacidade@trnty.com.br";

interface DeletionRequest {
  id: string;
  user_id: string;
  empresa_id: string | null;
  motivo: string | null;
  requested_at: string;
  notified_at: string | null;
  status: string;
}

interface EmpresaAdmin {
  id: string;
  email: string | null;
  nome?: string | null;
  full_name?: string | null;
}

function verifyCaller(req: Request): boolean {
  // Aceita: (a) Authorization Bearer com service role key OR (b) header x-pilar-secret
  const auth = req.headers.get("Authorization") ?? "";
  if (SERVICE_ROLE_KEY && auth === `Bearer ${SERVICE_ROLE_KEY}`) return true;
  const secret = req.headers.get("x-pilar-secret") ?? "";
  if (SHARED_SECRET && secret === SHARED_SECRET) return true;
  return false;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

serve(
  withSentry("send-data-deletion-notification", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    if (!verifyCaller(req)) {
      log.warn("unauthorized caller");
      return safeErrorResponse(401, "Unauthorized", req);
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      log.error("missing supabase env vars");
      return safeErrorResponse(500, "Server misconfigured", req);
    }

    let payload: { request_id?: string };
    try {
      payload = await req.json();
    } catch {
      return safeErrorResponse(400, "Invalid JSON body", req);
    }

    const requestId = payload.request_id;
    if (!isUUID(requestId)) return safeErrorResponse(400, "request_id inválido", req);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const reqLog = log.child({ request_id: requestId });

    // 1) Buscar request
    const { data: ddr, error: ddrErr } = await admin
      .from("data_deletion_requests")
      .select("id, user_id, empresa_id, motivo, requested_at, notified_at, status")
      .eq("id", requestId)
      .single<DeletionRequest>();

    if (ddrErr || !ddr) {
      reqLog.warn("deletion request not found", { err: ddrErr?.message });
      return safeErrorResponse(404, "Solicitação não encontrada", req);
    }

    // 2) Idempotência
    if (ddr.notified_at) {
      reqLog.info("already notified, skipping", { notified_at: ddr.notified_at });
      return jsonResponse({ success: true, skipped: "already_notified" }, 200, req);
    }

    // 3) Buscar dados do solicitante (email/nome)
    const { data: solicitante } = await admin
      .from("profiles")
      .select("email, first_name, last_name, full_name")
      .eq("id", ddr.user_id)
      .maybeSingle();

    let solicitanteEmail = (solicitante as { email?: string | null } | null)?.email ?? null;
    if (!solicitanteEmail) {
      // Fallback: auth.users
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(ddr.user_id);
        solicitanteEmail = authUser?.user?.email ?? null;
      } catch (err) {
        reqLog.warn("failed to fetch auth user email", { err: (err as Error).message });
      }
    }

    const solicitanteNome =
      ((solicitante as { full_name?: string | null; first_name?: string | null; last_name?: string | null } | null)
        ?.full_name ??
        [
          (solicitante as { first_name?: string | null } | null)?.first_name,
          (solicitante as { last_name?: string | null } | null)?.last_name,
        ]
          .filter(Boolean)
          .join(" ")) ||
      undefined;

    // 4) Buscar empresa + admin destinatário
    let empresaNome = "sua empresa";
    const recipients: string[] = [];
    let adminNome = "admin";

    if (ddr.empresa_id) {
      const { data: empresa } = await admin.from("empresas").select("nome").eq("id", ddr.empresa_id).maybeSingle();
      if ((empresa as { nome?: string | null } | null)?.nome) {
        empresaNome = (empresa as { nome: string }).nome;
      }

      const { data: admins } = await admin
        .from("profiles")
        .select("id, email, first_name, last_name, full_name")
        .eq("empresa_id", ddr.empresa_id)
        .eq("role", "admin");

      const adminRows = (admins ?? []) as EmpresaAdmin[];
      for (const a of adminRows) {
        if (a.email) recipients.push(a.email);
      }
      if (adminRows.length > 0) {
        const first = adminRows[0] as EmpresaAdmin & { first_name?: string | null };
        adminNome = first.full_name || first.first_name || "admin";
      }
    }

    // Sempre envia também pro DPO global (compliance interna)
    if (FALLBACK_DPO && !recipients.includes(FALLBACK_DPO)) recipients.push(FALLBACK_DPO);

    if (recipients.length === 0) {
      reqLog.error("no recipients available");
      return safeErrorResponse(500, "Nenhum destinatário disponível", req);
    }

    const adminPanelUrl = `${APP_URL.replace(/\/$/, "")}/admin?tab=privacidade&request=${ddr.id}`;

    const email = templateLgpdExclusaoDados({
      adminNome,
      empresaNome,
      solicitanteEmail: solicitanteEmail ?? "(email não disponível)",
      solicitanteNome,
      motivo: ddr.motivo,
      requestedAt: formatDate(ddr.requested_at),
      adminPanelUrl,
      requestId: ddr.id,
    });

    try {
      await sendEmail({
        classe: "plataforma",
        tipo: "lgpd_exclusao_dados",
        to: recipients,
        idempotencyKey: `lgpd-exclusao-${ddr.id}`,
        ...email,
      });
    } catch (err) {
      reqLog.error("resend send failed", err);
      return safeErrorResponse(502, "Falha ao enviar email", req);
    }

    // 5) Marcar notified_at (best-effort; idempotência via UPDATE condicional)
    const { error: updErr } = await admin
      .from("data_deletion_requests")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", ddr.id)
      .is("notified_at", null);

    if (updErr) {
      reqLog.warn("failed to set notified_at (email já foi)", { err: updErr.message });
    }

    reqLog.info("notification sent", { recipients_count: recipients.length });
    return jsonResponse({ success: true, recipients_count: recipients.length }, 200, req);
  })
);
