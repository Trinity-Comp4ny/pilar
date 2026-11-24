/**
 * prospeccao-mapeador — busca estabelecimentos no Google Places e grava leads (SPEC 172 fase 1).
 *
 * Deploy: supabase functions deploy prospeccao-mapeador --no-verify-jwt
 * Cron semanal (domingo 22h BRT) com `Authorization: Bearer <CRON_SECRET>`.
 *
 * Nasce desligado (prospec_config.ativo). Para sozinho no teto semanal de buscas
 * (prospec_proximas_celulas já desconta o que a semana gastou), então nunca estoura a conta.
 * A chave fica no secret GOOGLE_PLACES_API_KEY: nunca no repo.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry, captureException } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";
import { cronAutorizado } from "../_shared/cron-auth.ts";
import { fetchComTempo } from "../_shared/http.ts";
import { consultaTexto, mapearLugares, type PlaceBruto, TERMO_BUSCA } from "./places.ts";

const log = createLogger("prospeccao-mapeador");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const PLACES_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY") ?? "";

const CAMPOS =
  "places.id,places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.formattedAddress,places.businessStatus";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

serve(
  withSentry("prospeccao-mapeador", async (req: Request) => {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
    if (!cronAutorizado(req.headers, CRON_SECRET)) return json({ error: "Não autorizado" }, 401);
    if (!PLACES_KEY) return json({ error: "GOOGLE_PLACES_API_KEY não configurada" }, 503);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: celulas, error } = await admin.rpc("prospec_proximas_celulas");
    if (error) {
      captureException(error);
      return json({ error: "Falha ao ler as células" }, 500);
    }

    let novos = 0;
    let buscas = 0;
    for (const c of (celulas ?? []) as Array<{ id: string; uf: string; cidade: string; segmento: string }>) {
      const termo = TERMO_BUSCA[c.segmento];
      if (!termo) continue;
      let lugares: PlaceBruto[] = [];
      let erroBusca: string | null = null;
      try {
        const resp = await fetchComTempo("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": PLACES_KEY,
            "X-Goog-FieldMask": CAMPOS,
          },
          body: JSON.stringify({
            textQuery: consultaTexto(termo, c.cidade, c.uf),
            languageCode: "pt-BR",
            regionCode: "BR",
            pageSize: 20,
          }),
        });
        if (!resp.ok) {
          erroBusca = `Places HTTP ${resp.status}`;
        } else {
          lugares = ((await resp.json()) as { places?: PlaceBruto[] }).places ?? [];
        }
      } catch (e) {
        erroBusca = e instanceof Error ? e.message.slice(0, 200) : "falha de rede";
      }
      buscas++;
      const { data: n, error: errReg } = await admin.rpc("prospec_registrar_busca", {
        p_celula: c.id,
        p_leads: mapearLugares(lugares),
        p_erro: erroBusca,
      });
      if (errReg) captureException(errReg);
      else novos += Number(n ?? 0);
      // Quota do Google estourou ou chave inválida: não adianta insistir nas próximas células.
      if (erroBusca?.includes("429") || erroBusca?.includes("403")) break;
    }

    log.info("mapeamento concluído", { buscas, novos });
    return json({ buscas, novos });
  })
);
