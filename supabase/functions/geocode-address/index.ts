import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { recordMetric, withSentry } from "../_shared/sentry.ts";
import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { getRateLimitKey, RateLimiter } from "../_shared/rate-limiter.ts";

// User-Agent exigido pelo fair-use do Nominatim. Sem ele o IP é bloqueado.
const NOMINATIM_UA = "PilarSoft/1.0 (contato@pilarsoft.com.br)";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
// Fallback em nível de cidade. O Nominatim bloqueia faixas de IP de nuvem (403
// vindo da própria edge, PILAR-2W) e aí o projeto não entrava no mapa.
const OPEN_METEO_GEO = "https://geocoding-api.open-meteo.com/v1/search";

// O formulário salva a UF; o Open-Meteo devolve o nome do estado em `admin1`.
const ESTADO_POR_UF: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

// Só o formulário de projeto chama, uma vez por endereço salvo. O teto protege a
// cota do Nominatim (fair-use de 1 req/s por IP): sem ele, qualquer um com a
// chave pública usava a função como proxy e o IP da edge acabava bloqueado.
const limiter = new RateLimiter(30, 60_000);
const MAX_CAMPO = 300;

interface GeocodeBody {
  // Query livre (compatível com o contrato antigo)
  address?: string;
  // Query estruturada (preferida)
  street?: string;
  city?: string;
  state?: string;
  postalcode?: string;
}

interface GeoResult {
  lat: string;
  lon: string;
  display_name?: string;
}

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

interface OpenMeteoGeo {
  results?: Array<{ name?: string; latitude?: number; longitude?: number; admin1?: string; country_code?: string }>;
}

/** Centro da cidade pelo Open-Meteo. Só cidade + UF: posiciona o pino no município. */
async function queryOpenMeteoCidade(city: string, state?: string): Promise<GeoResult | null> {
  const params = new URLSearchParams({ name: city, count: "10", language: "pt", countryCode: "BR" });
  const response = await fetch(`${OPEN_METEO_GEO}?${params}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Open-Meteo retornou ${response.status}`);

  const { results = [] } = (await response.json()) as OpenMeteoGeo;
  const estado = state ? (ESTADO_POR_UF[state.trim().toUpperCase()] ?? state.trim()) : undefined;
  const candidatos = results.filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number");
  const escolhido =
    (estado && candidatos.find((r) => r.admin1?.localeCompare(estado, "pt", { sensitivity: "base" }) === 0)) ||
    candidatos[0];
  if (!escolhido) return null;
  return {
    lat: String(escolhido.latitude),
    lon: String(escolhido.longitude),
    display_name: [escolhido.name, escolhido.admin1].filter(Boolean).join(", "),
  };
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
      const body = (await req.json()) as GeocodeBody;
      const { address, street, city, state, postalcode } = body;

      const longo = [address, street, city, state, postalcode].some(
        (v) => typeof v === "string" && v.length > MAX_CAMPO
      );
      if (longo) return jsonResponse({ error: "Endereço longo demais" }, 400, req);

      const hasStructured = Boolean(street || city || state || postalcode);
      const hasAddress = typeof address === "string" && address.trim().length > 0;

      if (!hasStructured && !hasAddress) {
        return jsonResponse({ error: "Endereço é obrigatório" }, 400, req);
      }

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
