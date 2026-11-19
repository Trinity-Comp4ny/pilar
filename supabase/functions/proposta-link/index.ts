import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { checkDbRateLimit, getClientKey } from "../_shared/db-rate-limit.ts";
import { lerJson } from "../_shared/schemas.ts";
import { withSentry } from "../_shared/sentry.ts";

interface Versao {
  arquivo_path: string;
  empresa: string;
  numero: number;
  estado: string;
  aceita_em: string | null;
}

serve(
  withSentry("proposta-link", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Método indisponível", req);
    const entrada = await lerJson(req);
    const { token, acao } = entrada && typeof entrada === "object" ? (entrada as Record<string, unknown>) : {};
    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(token) ||
      (acao !== "abrir" && acao !== "aceitar")
    ) {
      return safeErrorResponse(400, "Link inválido", req);
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const limit = await checkDbRateLimit(admin, {
      bucket: "proposta_link",
      key: getClientKey(req),
      max: 30,
      windowSeconds: 60,
    });
    if (limit.rpcError) return safeErrorResponse(503, "Serviço temporariamente indisponível", req);
    if (!limit.allowed) return safeErrorResponse(429, "Muitas tentativas. Aguarde e tente novamente.", req);
    const { data, error } = await admin.rpc("acessar_link_proposta", { p_token: token, p_acao: acao });
    if (error) return safeErrorResponse(503, "Não foi possível processar a proposta", req);
    if (!data) return safeErrorResponse(404, "Proposta indisponível", req);
    const { arquivo_path, ...versao } = data as Versao;
    const { data: arquivo } = await admin.storage.from("proposta-pdfs").createSignedUrl(arquivo_path, 600, {
      download: `proposta-v${versao.numero}.pdf`,
    });
    const response = jsonResponse({ ...versao, pdf: arquivo?.signedUrl ?? null }, 200, req);
    response.headers.set("Cache-Control", "no-store");
    return response;
  })
);
