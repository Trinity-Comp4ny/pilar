/**
 * reverificar-documentos-pendentes — SPEC 098 Fase 1, requisito 11.
 *
 * Deploy: supabase functions deploy reverificar-documentos-pendentes --no-verify-jwt
 * Agendamento: cron diário via pg_cron (manual por ambiente, mesmo padrão de
 * trial-expiry-cron; ver docs/operations/DEPLOY_CHECKLIST.md), com:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Reconsulta a BrasilAPI pra toda empresa com documento_verificacao = 'pendente'
 * (CNPJ que ficou pendente porque a BrasilAPI estava fora do ar na hora do
 * cadastro). Some se a API confirmar ATIVA (vira 'verificado'), recusa o
 * documento se vier BAIXADA/INAPTA/SUSPENSA (o admin precisa informar de novo),
 * e simplesmente tenta de novo amanhã se a API continuar fora do ar.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { withSentry } from "../_shared/sentry.ts";
import { consultarCnpjBrasilApi, situacaoPermiteSubirNivel } from "../verificar-documento/documento.ts";

const log = createLogger("reverificar-documentos-pendentes");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

interface EmpresaPendente {
  id: string;
  cnpj: string;
  nome: string;
}

serve(
  withSentry("reverificar-documentos-pendentes", async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || !CRON_SECRET || token !== CRON_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: pendentes, error } = await svc
      .from("empresas")
      .select("id, cnpj, nome")
      .eq("documento_tipo", "cnpj")
      .eq("documento_verificacao", "pendente")
      .not("cnpj", "is", null);

    if (error) {
      log.error("failed to list pending documents", error);
      return new Response("Internal error", { status: 500 });
    }

    let verificadas = 0;
    let recusadas = 0;
    let aindaPendentes = 0;

    for (const empresa of (pendentes ?? []) as EmpresaPendente[]) {
      const consulta = await consultarCnpjBrasilApi(empresa.cnpj);

      if (consulta.status === "indisponivel") {
        aindaPendentes++;
        continue;
      }

      if (!situacaoPermiteSubirNivel(consulta.info.situacaoCadastral)) {
        await svc
          .from("empresas")
          .update({
            documento_verificacao: null,
            documento_tipo: null,
            cnpj: null,
            situacao_cadastral: consulta.info.situacaoCadastral,
          })
          .eq("id", empresa.id);
        recusadas++;
        log.warn("CNPJ pendente recusado na reverificação", {
          empresa_id: empresa.id,
          situacao: consulta.info.situacaoCadastral,
        });
        continue;
      }

      await svc
        .from("empresas")
        .update({
          documento_verificacao: "verificado",
          documento_verificado_em: new Date().toISOString(),
          razao_social: consulta.info.razaoSocial,
          situacao_cadastral: consulta.info.situacaoCadastral,
          cnae_principal: consulta.info.cnaePrincipal,
        })
        .eq("id", empresa.id);
      verificadas++;
    }

    log.info("reverificação concluída", { verificadas, recusadas, aindaPendentes, total: pendentes?.length ?? 0 });

    return new Response(JSON.stringify({ verificadas, recusadas, aindaPendentes }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  })
);
