/**
 * exportar-dados-titular: SPEC 115.
 *
 * Deploy: supabase functions deploy exportar-dados-titular --no-verify-jwt
 * Chamada pelo trigger notify_data_export_request (pg_net), autenticada como o aviso
 * de exclusão: service role ou x-pilar-secret. Corpo: { request_id }.
 *
 * Monta a cópia dos dados da conta, guarda no bucket privado lgpd-exportacoes e manda
 * ao titular um link assinado de 7 dias. Na falha, o encarregado recebe o aviso para
 * atender à mão (LGPD art. 19: 15 dias).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateLgpdExportacaoDados, templateLgpdExportacaoPronta } from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";
import { lerJson } from "../_shared/schemas.ts";
import { withSentry } from "../_shared/sentry.ts";
import { chamadorAutorizado, lerEntrada } from "../send-data-deletion-notification/entrada.ts";
import { type Fontes, LIMITES, montarExportacao } from "./exportacao.ts";

const log = createLogger("exportar-dados-titular");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SHARED_SECRET = Deno.env.get("DATA_DELETION_NOTIFY_SECRET") ?? "";
const DPO = Deno.env.get("LGPD_DPO_EMAIL") ?? "privacidade@pilarsoft.com.br";

const BUCKET = "lgpd-exportacoes";
const VALIDADE_S = 7 * 24 * 60 * 60;

type Linha = Record<string, unknown>;

async function linhas(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Linha[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Linha[];
}

async function buscarFontes(admin: SupabaseClient, userId: string): Promise<Fontes> {
  const doUsuario = (tabela: string, coluna = "user_id") => admin.from(tabela).select("*").eq(coluna, userId);

  const [perfil, sessoes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, nome, first_name, last_name, email, contato, role, empresa_id, avatar_url, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle(),
    linhas(
      admin
        .from("chat_sessions")
        .select("id, titulo, created_at, updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(LIMITES.conversasIa)
    ),
  ]);
  if (perfil.error) throw new Error(perfil.error.message);

  const ids = sessoes.map((s) => s.id as string);
  const mensagens = ids.length
    ? await linhas(
        admin
          .from("chat_messages")
          .select("session_id, role, content, created_at")
          .in("session_id", ids)
          .order("created_at")
      )
    : [];

  const [prefs, cookies, termos, cobranca, notificacoes, feedbacks, horas, usoIa, acoes, exportacoes, exclusoes] =
    await Promise.all([
      linhas(doUsuario("notificacao_preferencias")),
      linhas(doUsuario("cookie_consents")),
      linhas(doUsuario("terms_acceptances")),
      linhas(doUsuario("consentimentos_cobranca")),
      linhas(
        admin
          .from("notificacoes")
          .select("tipo, categoria, titulo, mensagem, link, created_at, lido_em, arquivada_em")
          .eq("destinatario_id", userId)
          .order("created_at", { ascending: false })
          .limit(LIMITES.notificacoes)
      ),
      linhas(
        admin
          .from("feature_suggestions")
          .select("tipo, titulo, descricao, contexto, created_at")
          .eq("created_by", userId)
      ),
      linhas(
        admin
          .from("timesheet_lancamentos")
          .select("data, horas, descricao, status, projeto_id, created_at")
          .eq("user_id", userId)
          .order("data", { ascending: false })
          .limit(LIMITES.horasLancadas)
      ),
      linhas(doUsuario("ai_token_ledger").order("created_at", { ascending: false }).limit(LIMITES.usoIa)),
      linhas(
        admin
          .from("audit_logs")
          .select("action, target_table, created_at")
          .eq("actor_id", userId)
          .order("created_at", { ascending: false })
          .limit(LIMITES.acoes)
      ),
      linhas(doUsuario("data_export_requests")),
      linhas(doUsuario("data_deletion_requests")),
    ]);

  return {
    perfil: (perfil.data as Linha | null) ?? null,
    preferenciasNotificacao: prefs,
    consentimentosCookies: cookies,
    aceitesTermos: termos,
    consentimentosCobranca: cobranca,
    notificacoes,
    conversasIa: sessoes.map((s) => ({ ...s, mensagens: mensagens.filter((m) => m.session_id === s.id) })),
    feedbacks,
    horasLancadas: horas,
    usoIa,
    acoes,
    pedidosExportacao: exportacoes,
    pedidosExclusao: exclusoes,
  };
}

function dataBr(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

serve(
  withSentry("exportar-dados-titular", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);
    if (!chamadorAutorizado(req.headers, { serviceRoleKey: SERVICE_ROLE_KEY, sharedSecret: SHARED_SECRET })) {
      return safeErrorResponse(401, "Unauthorized", req);
    }

    const entrada = lerEntrada(await lerJson(req));
    if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
    const requestId = entrada.data.request_id;
    const reqLog = log.child({ request_id: requestId });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: pedido } = await admin
      .from("data_export_requests")
      .select("id, user_id, status, requested_at")
      .eq("id", requestId)
      .maybeSingle<{ id: string; user_id: string; status: string; requested_at: string }>();
    if (!pedido) return safeErrorResponse(404, "Solicitação não encontrada", req);
    if (pedido.status !== "pending") return jsonResponse({ success: true, skipped: pedido.status }, 200, req);

    // Trava: só um processamento por pedido, mesmo que o trigger seja reenviado.
    const { data: travado } = await admin
      .from("data_export_requests")
      .update({ status: "processing" })
      .eq("id", pedido.id)
      .eq("status", "pending")
      .select("id");
    if (!travado?.length) return jsonResponse({ success: true, skipped: "em_andamento" }, 200, req);

    try {
      const fontes = await buscarFontes(admin, pedido.user_id);
      const agora = new Date();
      const arquivo = JSON.stringify(montarExportacao(fontes, agora.toISOString()), null, 2);

      // Cópias anteriores do mesmo titular saem: o bucket guarda só a última.
      const { data: antigos } = await admin.storage.from(BUCKET).list(pedido.user_id);
      if (antigos?.length) {
        await admin.storage.from(BUCKET).remove(antigos.map((a) => `${pedido.user_id}/${a.name}`));
      }

      const caminho = `${pedido.user_id}/${pedido.id}.json`;
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(caminho, new Blob([arquivo], { type: "application/json" }), { upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      const { data: assinado, error: urlErr } = await admin.storage.from(BUCKET).createSignedUrl(caminho, VALIDADE_S, {
        download: `meus-dados-pilar-${agora.toISOString().slice(0, 10)}.json`,
      });
      if (urlErr || !assinado?.signedUrl) throw new Error(`signed url: ${urlErr?.message ?? "vazio"}`);

      const email = (fontes.perfil?.email as string | undefined) ?? null;
      if (!email) throw new Error("titular sem e-mail no perfil");
      const expira = new Date(agora.getTime() + VALIDADE_S * 1000);

      await sendEmail({
        classe: "plataforma",
        tipo: "lgpd_exportacao_pronta",
        to: [email],
        idempotencyKey: `lgpd-exportacao-pronta-${pedido.id}`,
        ...templateLgpdExportacaoPronta({
          nome: (fontes.perfil?.first_name as string | undefined) || (fontes.perfil?.nome as string | undefined) || "",
          link: assinado.signedUrl,
          validoAte: dataBr(expira),
        }),
      });

      await admin
        .from("data_export_requests")
        .update({
          status: "completed",
          completed_at: agora.toISOString(),
          download_url: caminho,
          expires_at: expira.toISOString(),
        })
        .eq("id", pedido.id);

      reqLog.info("exportação entregue", { bytes: arquivo.length });
      return jsonResponse({ success: true }, 200, req);
    } catch (err) {
      reqLog.error("exportação automática falhou", err);
      await admin.from("data_export_requests").update({ status: "failed" }).eq("id", pedido.id);
      // Na falha o prazo legal continua correndo: o encarregado atende à mão.
      try {
        await sendEmail({
          classe: "plataforma",
          tipo: "lgpd_exportacao_dados",
          to: [DPO],
          idempotencyKey: `lgpd-exportacao-falha-${pedido.id}`,
          ...templateLgpdExportacaoDados({
            empresaNome: "geração automática falhou, atender à mão",
            solicitanteEmail: pedido.user_id,
            requestedAt: dataBr(new Date(pedido.requested_at)),
            requestId: pedido.id,
          }),
        });
      } catch (mailErr) {
        reqLog.error("aviso ao encarregado também falhou", mailErr);
      }
      return safeErrorResponse(500, "Falha ao gerar a exportação", req);
    }
  })
);
