/**
 * retencao-pos-trial — SPEC 098 Fase 3 (ADR 0042 + ADR 0043).
 *
 * Deploy: supabase functions deploy retencao-pos-trial --no-verify-jwt
 *
 * Deve ser chamada via cron com:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Responsabilidades, para toda empresa com leitura_desde setado (modo
 * somente leitura pós-trial) e preservar_dados = false:
 *  - Dia 60 e 85: envia aviso por email (templateRetencaoAviso)
 *  - Dia 90: chama excluir_empresa_retencao() (anonimiza fiscal, apaga o
 *    resto, soft-deleta empresas) e depois apaga os auth.users da empresa
 *    (a RPC não alcança o schema auth, só o public). Só exclui com o aviso
 *    do dia 85 enviado há 5 dias ou mais (regras.ts)
 *  - Idempotente: usa retencao_aviso_60d_sent_at/_85d_sent_at pra não
 *    reenviar; deleted_at marcado pela RPC tira a empresa da consulta
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { withSentryCron } from "../_shared/sentry.ts";
import { sendEmail, templateRetencaoAviso } from "../_shared/email/index.ts";
import { cronAutorizado } from "../_shared/cron-auth.ts";
import { type EmpresaEmLeitura, proximaAcao } from "./regras.ts";

const log = createLogger("retencao-pos-trial");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const APP_URL = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://app.pilarsoft.com.br")
  .split(",")[0]
  .trim()
  .replace(/\/$/, "");

serve(
  withSentryCron("retencao-pos-trial", "retencao-pos-trial-daily", async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!cronAutorizado(req.headers, CRON_SECRET)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let avisados = 0;
    let excluidos = 0;

    const { data: empresas, error: queryErr } = (await admin
      .from("empresas")
      .select("id, nome, leitura_desde, retencao_aviso_60d_sent_at, retencao_aviso_85d_sent_at")
      .not("leitura_desde", "is", null)
      .eq("preservar_dados", false)
      .is("deleted_at", null)) as { data: EmpresaEmLeitura[] | null; error: unknown };

    if (queryErr) {
      log.error("falha ao buscar empresas em leitura", queryErr as Error);
      return new Response(JSON.stringify({ error: "query failed" }), { status: 500 });
    }

    for (const empresa of empresas ?? []) {
      const acao = proximaAcao(empresa, Date.now());
      if (!acao) continue;
      const { diasEmLeitura } = acao;

      try {
        // Exclusão: só com o aviso final enviado e o prazo depois dele cumprido
        // (regras.ts). Cron atrasado avisa primeiro e exclui depois.
        if (acao.tipo === "excluir") {
          const { data: profiles } = await admin.from("profiles").select("id").eq("empresa_id", empresa.id);
          const userIds = (profiles ?? []).map((p) => p.id);

          const { error: rpcErr } = await admin.rpc("excluir_empresa_retencao", {
            p_empresa_id: empresa.id,
            p_motivo: `Retenção pós-trial: ${diasEmLeitura} dias em modo leitura sem plano ativo (cron retencao-pos-trial)`,
          });

          if (rpcErr) {
            throw new Error(`excluir_empresa_retencao falhou: ${rpcErr.message}`);
          }

          for (const userId of userIds) {
            const { error: deleteUserErr } = await admin.auth.admin.deleteUser(userId);
            if (deleteUserErr) {
              log.error("falha ao apagar auth.users", deleteUserErr, { empresa_id: empresa.id, user_id: userId });
            }
          }

          excluidos++;
          continue;
        }

        // Aviso do dia 60 ou 85, idempotente.
        const janela = acao;

        const { data: admins } = (await admin
          .from("profiles")
          .select("email")
          .eq("empresa_id", empresa.id)
          .in("role", ["owner", "admin", "ultra_admin"])
          .is("desativado_em", null)) as { data: { email: string | null }[] | null };
        const recipients = (admins ?? []).map((p) => p.email).filter((e): e is string => !!e);

        if (recipients.length > 0) {
          await sendEmail({
            classe: "plataforma",
            tipo: `retencao_aviso_${janela.dias}d`,
            to: recipients,
            idempotencyKey: `retencao-${empresa.id}-${janela.dias}d`,
            ...templateRetencaoAviso({
              empresaNome: empresa.nome,
              diasRestantes: janela.diasRestantes,
              billingUrl: `${APP_URL}/billing`,
            }),
          });
        }

        await admin
          .from("empresas")
          .update({ [janela.coluna]: new Date().toISOString() })
          .eq("id", empresa.id);

        await admin.from("admin_audit_logs").insert({
          actor_id: null,
          actor_email: "system@pilar",
          actor_role: "ultra_admin",
          action: `retencao_aviso_sent_d${janela.dias}`,
          category: "billing",
          target_type: "empresa",
          target_id: empresa.id,
          target_name: empresa.nome,
          empresa_id: empresa.id,
          metadata: { dias_em_leitura: diasEmLeitura, recipients },
        });

        avisados++;
      } catch (err) {
        log.error("falha ao processar retenção da empresa", err, {
          empresa_id: empresa.id,
          dias_em_leitura: diasEmLeitura,
        });
        // Falha individual não interrompe o loop das demais empresas.
      }
    }

    log.info("cron finalizado", { avisados, excluidos, total: (empresas ?? []).length });

    return new Response(JSON.stringify({ avisados, excluidos }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  })
);
