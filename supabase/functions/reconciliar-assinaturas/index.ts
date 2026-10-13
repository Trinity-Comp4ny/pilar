/**
 * reconciliar-assinaturas: SPEC 114.
 *
 * Deploy: supabase functions deploy reconciliar-assinaturas --no-verify-jwt
 * Agendado por reconciliar_assinaturas_disparar() (pg_cron, 6h30), com
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Compara cada assinatura do Pilar com a assinatura e as últimas cobranças no Asaas
 * da plataforma e avisa o ultra admin (sino e e-mail) das divergências. Não corrige:
 * mudar status de cobrança mexe no acesso do cliente, a correção é humana.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRecentSubscriptionPayments, getSubscription } from "../_shared/asaas-platform.ts";
import { cronAutorizado } from "../_shared/cron-auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { withSentryCron } from "../_shared/sentry.ts";
import { assinaturaDaLista, compararAssinatura, deveAvisar } from "./regras.ts";

const log = createLogger("reconciliar-assinaturas");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

interface Linha {
  id: string;
  empresa_id: string;
  status: string;
  billing_cycle: string | null;
  asaas_subscription_id: string;
  plano: { preco_mensal: number | null; preco_anual: number | null } | null;
  empresa: { nome: string | null } | null;
}

const AUDITORIA = { actor_id: null, actor_email: "system@pilar", actor_role: "ultra_admin", category: "billing" };

serve(
  withSentryCron("reconciliar-assinaturas", "reconciliar-assinaturas-daily", async (req) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (!cronAutorizado(req.headers, CRON_SECRET)) return new Response("Unauthorized", { status: 401 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data, error } = await admin
      .from("pilar_subscriptions")
      .select(
        "id, empresa_id, status, billing_cycle, asaas_subscription_id, plano:pilar_subscription_plans(preco_mensal, preco_anual), empresa:empresas(nome)"
      )
      .not("asaas_subscription_id", "is", null)
      .neq("status", "expired");

    if (error) {
      log.error("falha ao listar assinaturas", error);
      return new Response(JSON.stringify({ error: "query failed" }), { status: 500 });
    }

    const agora = Date.now();
    let verificadas = 0;
    let divergentes = 0;
    let avisadas = 0;
    let falhas = 0;

    // Em série de propósito: são dezenas de assinaturas e o Asaas limita requisições.
    for (const sub of (data ?? []) as unknown as Linha[]) {
      try {
        const [asaas, cobrancas] = await Promise.all([
          getSubscription(sub.asaas_subscription_id),
          getRecentSubscriptionPayments(sub.asaas_subscription_id),
        ]);
        verificadas++;

        const divergencias = compararAssinatura(
          {
            status: sub.status,
            billing_cycle: sub.billing_cycle,
            preco_mensal: sub.plano?.preco_mensal ?? null,
            preco_anual: sub.plano?.preco_anual ?? null,
          },
          asaas,
          cobrancas,
          agora
        );
        if (divergencias.length === 0) continue;
        divergentes++;

        const { data: ultimo } = await admin
          .from("admin_audit_logs")
          .select("created_at, metadata")
          .eq("action", "reconciliacao_divergencia")
          .eq("target_id", sub.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ created_at: string; metadata: { chave?: string; avisado?: boolean } | null }>();
        // Só conta como "último aviso" o registro que de fato avisou.
        const ultimoAviso =
          ultimo?.metadata?.avisado && ultimo.metadata.chave
            ? { chave: ultimo.metadata.chave, em: ultimo.created_at }
            : null;

        const avisar = deveAvisar(divergencias, ultimoAviso, agora);
        const nome = sub.empresa?.nome ?? "empresa";
        if (avisar) {
          const { error: avisoErr } = await admin.rpc("notificar_ultra_admins", {
            p_empresa_id: sub.empresa_id,
            p_tipo: "reconciliacao_divergente",
            p_titulo: `Cobrança divergente: ${nome}`,
            p_mensagem: divergencias.map((d) => d.descricao).join(" "),
            p_link: "/ultra-admin?tab=empresas",
          });
          if (avisoErr) log.error("falha ao avisar ultra admin", avisoErr, { subscription_id: sub.id });
          else avisadas++;
        }

        await admin.from("admin_audit_logs").insert({
          ...AUDITORIA,
          action: "reconciliacao_divergencia",
          target_type: "pilar_subscription",
          target_id: sub.id,
          target_name: nome,
          empresa_id: sub.empresa_id,
          metadata: { chave: assinaturaDaLista(divergencias), divergencias, avisado: avisar },
        });
      } catch (err) {
        falhas++;
        log.error("falha ao reconciliar assinatura", err, { subscription_id: sub.id });
      }
    }

    const resumo = { verificadas, divergentes, avisadas, falhas, total: (data ?? []).length };
    await admin.from("admin_audit_logs").insert({
      ...AUDITORIA,
      action: "reconciliacao_rodada",
      target_type: "pilar_subscription",
      target_id: null,
      target_name: "reconciliação diária",
      empresa_id: null,
      metadata: resumo,
    });
    log.info("reconciliação concluída", resumo);

    return new Response(JSON.stringify(resumo), { status: 200, headers: { "Content-Type": "application/json" } });
  })
);
