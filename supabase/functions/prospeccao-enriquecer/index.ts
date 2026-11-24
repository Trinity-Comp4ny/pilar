/**
 * prospeccao-enriquecer — consulta CNPJ na BrasilAPI e enriquece os leads (SPEC 172 fase 2).
 *
 * Deploy: supabase functions deploy prospeccao-enriquecer --no-verify-jwt
 * Cron diário com `Authorization: Bearer <CRON_SECRET>`. Dado público, sem chave e sem custo;
 * lote pequeno e sequencial para respeitar o limite da BrasilAPI. Para no primeiro 429.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry, captureException } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";
import { cronAutorizado } from "../_shared/cron-auth.ts";
import { fetchComTempo } from "../_shared/http.ts";
import { type CnpjBruto, enriquecer } from "./cnpj.ts";

const log = createLogger("prospeccao-enriquecer");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const LOTE = 20;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

serve(
  withSentry("prospeccao-enriquecer", async (req: Request) => {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
    if (!cronAutorizado(req.headers, CRON_SECRET)) return json({ error: "Não autorizado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: leads, error } = await admin.rpc("prospec_leads_para_enriquecer", { p_limite: LOTE });
    if (error) {
      captureException(error);
      return json({ error: "Falha ao ler os leads" }, 500);
    }

    let feitos = 0;
    for (const l of (leads ?? []) as Array<{ id: string; cnpj: string }>) {
      let dados: CnpjBruto | null = null;
      try {
        const resp = await fetchComTempo(`https://brasilapi.com.br/api/cnpj/v1/${l.cnpj}`);
        if (resp.status === 429) break;
        if (resp.ok) dados = (await resp.json()) as CnpjBruto;
      } catch (e) {
        captureException(e);
        continue;
      }
      // CNPJ inexistente (404): marca como consultado para não repetir todo dia.
      const { data: lead } = await admin.from("prospec_leads").select("segmento").eq("id", l.id).maybeSingle();
      const r = dados
        ? enriquecer(lead?.segmento ?? "", dados)
        : { razao_social: null, cnae: null, decisor: null, ajuste_nota: 0 };
      const { error: errReg } = await admin.rpc("prospec_registrar_enriquecimento", {
        p_lead: l.id,
        p_razao_social: r.razao_social,
        p_cnae: r.cnae,
        p_decisor: r.decisor,
        p_ajuste_nota: r.ajuste_nota,
      });
      if (errReg) captureException(errReg);
      else feitos++;
    }

    log.info("enriquecimento concluído", { feitos });
    return json({ feitos });
  })
);
