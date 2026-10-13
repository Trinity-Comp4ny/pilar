import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { recordMetric, withSentry } from "../_shared/sentry.ts";
import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { getRateLimitKey, RateLimiter } from "../_shared/rate-limiter.ts";
import { escolherCidade, type GeoResult, lerEndereco, type OpenMeteoGeo } from "./endereco.ts";

// User-Agent exigido pelo fair-use do Nominatim. Sem ele o IP é bloqueado.
const NOMINATIM_UA = "PilarSoft/1.0 (contato@pilarsoft.com.br)";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
// Fallback em nível de cidade. O Nominatim bloqueia faixas de IP de nuvem (403
// vindo da própria edge, PILAR-2W) e aí o projeto não entrava no mapa.
const OPEN_METEO_GEO = "https://geocoding-api.open-meteo.com/v1/search";

// Só o formulário de projeto chama, uma vez por endereço salvo. O teto por usuário
// respeita a cota do Nominatim (fair-use de 1 req/s), que é por IP da edge e
// compartilhada entre todas as empresas.
const limiter = new RateLimiter(30, 60_000);

async function queryNominatim(params: URLSearchParams): Promise<GeoResult | null> {
  const response = await fetch(`${NOMINATIM_BASE}?${params}`, {
    headers: {
      "User-Agent": NOMINATIM_UA,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim retornou ${response.status}`);
  }

  const results = (await response.json()) as GeoResult[];
  if (!results || results.length === 0) return null;

  const first = results[0];
  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);
  if (isNaN(lat) || isNaN(lon)) return null;
  return first;
}

/** Centro da cidade pelo Open-Meteo. Só cidade + UF: posiciona o pino no município. */
async function queryOpenMeteoCidade(city: string, state?: string): Promise<GeoResult | null> {
  const params = new URLSearchParams({ name: city, count: "10", language: "pt", countryCode: "BR" });
  const response = await fetch(`${OPEN_METEO_GEO}?${params}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Open-Meteo retornou ${response.status}`);

  const { results = [] } = (await response.json()) as OpenMeteoGeo;
  return escolherCidade(results, state);
}

serve(
  withSentry("geocode-address", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    if (!limiter.allow(getRateLimitKey(req, auth.user.id))) {
      return safeErrorResponse(429, "Muitas buscas de endereço. Aguarde um minuto e tente de novo.", req);
    }

    try {
      const endereco = lerEndereco(await req.json().catch(() => null));
      if (!endereco.ok) return jsonResponse({ error: endereco.error }, 400, req);
      const { address, street, city, state, postalcode, hasStructured } = endereco.data;

      // Query principal: estruturada quando há campos, senão query livre.
      const primary = new URLSearchParams({ format: "json", limit: "1", country: "Brazil" });
      if (hasStructured) {
        if (street) primary.set("street", street);
        if (city) primary.set("city", city);
        if (state) primary.set("state", state);
        if (postalcode) primary.set("postalcode", postalcode);
      } else {
        primary.set("q", address!.trim());
        primary.set("countrycodes", "br");
      }

      let result: GeoResult | null = null;
      let falhaNominatim: unknown = null;
      try {
        result = await queryNominatim(primary);

        // Fallback: cidade + estado (ao menos posiciona no mapa em nível de cidade).
        if (!result && city) {
          const fallback = new URLSearchParams({ format: "json", limit: "1", country: "Brazil" });
          fallback.set("city", city);
          if (state) fallback.set("state", state);
          result = await queryNominatim(fallback);
        }
      } catch (err) {
        falhaNominatim = err;
      }

      // Nominatim fora do ar ou bloqueando o IP da edge: cai pro centro da cidade.
      if (!result && city) {
        result = await queryOpenMeteoCidade(city, state);
        if (falhaNominatim) {
          recordMetric("geocode.fallback", 1, { tags: { provider: "open-meteo", found: Boolean(result) } });
        }
      }

      if (!result && falhaNominatim) throw falhaNominatim;

      if (!result) {
        return jsonResponse({ lat: null, lng: null, found: false }, 200, req);
      }

      return jsonResponse(
        {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          display_name: result.display_name,
          found: true,
        },
        200,
        req
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao geocodificar";
      return jsonResponse({ error: message }, 400, req);
    }
  })
);
