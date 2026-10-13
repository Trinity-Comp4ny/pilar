/**
 * excluir-dados-titular: SPEC 116.
 *
 * O ultra admin decide um pedido de exclusão (LGPD art. 18 VI) na aba Pedidos LGPD.
 * Corpo: { request_id, acao: "aprovar" } ou { request_id, acao: "recusar", motivo }.
 *
 * Aprovar apaga o dado pessoal, anonimiza perfil e Auth e bloqueia o login
 * (_shared/encerrar-conta.ts); nada de registro de negócio sai. A confirmação vai para
 * o e-mail original, guardado antes da troca. Falha no meio deixa o pedido em `failed`
 * e pode ser aprovado de novo: cada passo é idempotente.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUltraAdmin } from "../_shared/admin-auth.ts";
import { logAction } from "../_shared/audit.ts";
import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateLgpdExclusaoConcluida, templateLgpdExclusaoRecusada } from "../_shared/email/index.ts";
import { anonimizarTitular } from "../_shared/encerrar-conta.ts";
import { createLogger } from "../_shared/logger.ts";
import { lerJson } from "../_shared/schemas.ts";
import { withSentry } from "../_shared/sentry.ts";
import { lerEntrada } from "./entrada.ts";
import { ehUnicoAdmin, recusaDaDecisao } from "./regras.ts";

const log = createLogger("excluir-dados-titular");

type Titular = {
  id: string;
  nome: string | null;
  first_name: string | null;
  email: string;
  role: string | null;
  empresa_id: string;
  desativado_em: string | null;
};

serve(
  withSentry("excluir-dados-titular", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await requireUltraAdmin(req);
    if (auth.error) return auth.error;
    const { svc, userId, actorEmail } = auth;

    const entrada = lerEntrada(await lerJson(req));
    if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
    const { request_id: requestId, acao } = entrada.data;
    const reqLog = log.child({ request_id: requestId, acao });

    const { data: pedido } = await svc
      .from("data_deletion_requests")
      .select("id, user_id, empresa_id, status")
      .eq("id", requestId)
      .maybeSingle<{ id: string; user_id: string; empresa_id: string | null; status: string }>();
    if (!pedido) return safeErrorResponse(404, "Pedido não encontrado", req);

    const { data: titular } = await svc
      .from("profiles")
      .select("id, nome, first_name, email, role, empresa_id, desativado_em")
      .eq("id", pedido.user_id)
      .maybeSingle<Titular>();
    if (!titular) return safeErrorResponse(404, "Titular não encontrado", req);

    const { count: outrosAdmins, error: countErr } = await svc
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", titular.empresa_id)
      .neq("id", titular.id)
      .in("role", ["admin", "owner"])
      .is("desativado_em", null);
    if (countErr) {
      reqLog.error("contagem de admins falhou", countErr);
      return safeErrorResponse(500, "Não foi possível conferir os admins da empresa. Tente de novo.", req);
    }

    const recusa = recusaDaDecisao(
      pedido.status,
      acao,
      ehUnicoAdmin(titular.role, titular.desativado_em, outrosAdmins ?? 0)
    );
    if (recusa) return safeErrorResponse(recusa.status, recusa.error, req);

    const nome = titular.first_name || titular.nome || "";
    const emailOriginal = titular.email;
    const auditoria = {
      actorId: userId,
      actorEmail,
      actorRole: "ultra_admin" as const,
      category: "user" as const,
      targetType: "data_deletion_request",
      targetId: pedido.id,
      targetName: `titular ${titular.id.slice(0, 8)}`,
      empresaId: pedido.empresa_id,
      req,
    };

    if (entrada.data.acao === "recusar") {
      const motivo = entrada.data.motivo;
      const { data: decidido } = await svc
        .from("data_deletion_requests")
        .update({ status: "rejected", processed_at: new Date().toISOString(), processed_by: userId, notes: motivo })
        .eq("id", pedido.id)
        .in("status", ["pending", "failed"])
        .select("id");
      if (!decidido?.length) return safeErrorResponse(409, "Outra pessoa decidiu este pedido agora.", req);

      try {
        await sendEmail({
          classe: "plataforma",
          tipo: "lgpd_exclusao_recusada",
          to: [emailOriginal],
          idempotencyKey: `lgpd-exclusao-recusada-${pedido.id}`,
          ...templateLgpdExclusaoRecusada({ nome, motivo }),
        });
      } catch (err) {
        reqLog.error("aviso de recusa ao titular falhou", err);
      }
      await logAction(svc, { ...auditoria, action: "lgpd_exclusao_recusada", metadata: { motivo } });
      return jsonResponse({ success: true, status: "rejected" }, 200, req);
    }

    // Trava: uma execução por pedido, mesmo com dois cliques.
    const { data: travado } = await svc
      .from("data_deletion_requests")
      .update({ status: "in_progress", processed_by: userId })
      .eq("id", pedido.id)
      .in("status", ["pending", "failed"])
      .select("id");
    if (!travado?.length) return safeErrorResponse(409, "Este pedido já está sendo atendido.", req);

    const resultado = await anonimizarTitular(svc, titular.id);
    if (!resultado.ok) {
      reqLog.error("exclusão falhou no meio", resultado.erro);
      await svc.from("data_deletion_requests").update({ status: "failed", notes: resultado.erro }).eq("id", pedido.id);
      await logAction(svc, { ...auditoria, action: "lgpd_exclusao_falhou", metadata: { erro: resultado.erro } });
      return safeErrorResponse(
        500,
        "A exclusão parou no meio. O que já foi feito fica; aprove de novo para terminar.",
        req
      );
    }

    await svc
      .from("data_deletion_requests")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        notes: "Dado pessoal apagado e conta anonimizada (SPEC 116).",
      })
      .eq("id", pedido.id);

    try {
      await sendEmail({
        classe: "plataforma",
        tipo: "lgpd_exclusao_concluida",
        to: [emailOriginal],
        idempotencyKey: `lgpd-exclusao-concluida-${pedido.id}`,
        ...templateLgpdExclusaoConcluida({ nome }),
      });
    } catch (err) {
      reqLog.error("confirmação ao titular falhou", err);
    }

    await logAction(svc, { ...auditoria, action: "lgpd_exclusao_atendida" });
    reqLog.info("exclusão atendida");
    return jsonResponse({ success: true, status: "completed" }, 200, req);
  })
);
