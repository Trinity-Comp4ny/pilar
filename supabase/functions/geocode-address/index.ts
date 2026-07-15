import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";

// User-Agent exigido pelo fair-use do Nominatim. Sem ele o IP é bloqueado.
const NOMINATIM_UA = "PilarSoft/1.0 (contato@pilarsoft.com.br)";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";

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

serve(
  withSentry("geocode-address", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);

    try {
      const body = (await req.json()) as GeocodeBody;
      const { address, street, city, state, postalcode } = body;

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

      let result = await queryNominatim(primary);

      // Fallback: cidade + estado (ao menos posiciona no mapa em nível de cidade).
      if (!result && city) {
        const fallback = new URLSearchParams({ format: "json", limit: "1", country: "Brazil" });
        fallback.set("city", city);
        if (state) fallback.set("state", state);
        result = await queryNominatim(fallback);
      }

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
