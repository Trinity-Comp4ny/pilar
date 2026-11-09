// Regras puras do geocoding: o que é um endereço aceitável e qual cidade escolher
// quando o Open-Meteo devolve homônimas (há Santa Maria em seis estados).

export interface GeoResult {
  lat: string;
  lon: string;
  display_name?: string;
}

export interface OpenMeteoGeo {
  results?: Array<{ name?: string; latitude?: number; longitude?: number; admin1?: string; country_code?: string }>;
}

// O formulário salva a UF; o Open-Meteo devolve o nome do estado em `admin1`.
export const ESTADO_POR_UF: Record<string, string> = {
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

const MAX_CAMPO = 300;

type Endereco = { address?: string; street?: string; city?: string; state?: string; postalcode?: string };

/** Endereço do formulário: só texto, aparado, curto. Precisa de ao menos um campo. */
export function lerEndereco(
  corpo: unknown
): { ok: true; data: Endereco & { hasStructured: boolean } } | { ok: false; error: string } {
  const b = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const campos = ["address", "street", "city", "state", "postalcode"] as const;
  const data: Endereco = {};
  for (const c of campos) {
    const v = b[c];
    if (typeof v !== "string") continue;
    if (v.length > MAX_CAMPO) return { ok: false, error: "Endereço longo demais" };
    if (v.trim()) data[c] = v.trim();
  }
  const hasStructured = Boolean(data.street || data.city || data.state || data.postalcode);
  if (!hasStructured && !data.address) return { ok: false, error: "Endereço é obrigatório" };
  return { ok: true, data: { ...data, hasStructured } };
}

/** Escolhe a cidade do estado informado (UF ou nome); sem estado, a primeira com coordenada. */
export function escolherCidade(results: NonNullable<OpenMeteoGeo["results"]>, state?: string): GeoResult | null {
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

export interface CepGeo {
  coordenadas: GeoResult | null;
  city?: string;
  state?: string;
}

/**
 * Resposta do BrasilAPI CEP v2, lida com cuidado: `location.coordinates` vem vazio
 * em boa parte dos CEPs e latitude/longitude chegam como texto. Sem coordenada,
 * ainda serve city/state para cair no centro da cidade.
 */
export function lerCepGeo(raw: unknown): CepGeo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as {
    city?: unknown;
    state?: unknown;
    location?: { coordinates?: { latitude?: unknown; longitude?: unknown } };
  };
  const city = typeof r.city === "string" && r.city.trim() ? r.city.trim() : undefined;
  const state = typeof r.state === "string" && r.state.trim() ? r.state.trim() : undefined;
  if (!city && !state) return null;

  const lat = Number(r.location?.coordinates?.latitude);
  const lon = Number(r.location?.coordinates?.longitude);
  const temCoordenada =
    r.location?.coordinates?.latitude != null &&
    r.location?.coordinates?.longitude != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lon);

  return {
    coordenadas: temCoordenada
      ? { lat: String(lat), lon: String(lon), display_name: [city, state].filter(Boolean).join(", ") }
      : null,
    city,
    state,
  };
}

/** Provedores de geocodificação, injetados para a cascata ser testável sem rede. */
export interface Provedores {
  nominatim(params: URLSearchParams): Promise<GeoResult | null>;
  openMeteoCidade(city: string, state?: string): Promise<GeoResult | null>;
  brasilApiCep(postalcode: string): Promise<CepGeo | null>;
  /** Telemetria do fallback (só quando o Nominatim falhou). */
  fallback?(provider: "brasilapi-cep" | "open-meteo", found: boolean): void;
}

export type Resolucao =
  | { found: true; result: GeoResult }
  | {
      found: false;
      /** Algum provedor falhou (bloqueio do Nominatim, Open-Meteo fora) e nada o substituiu: tentar de novo depois pode achar. */
      indisponivel: boolean;
    };

/**
 * Cascata: Nominatim (endereço) → Nominatim (só cidade) → CEP quando falta a cidade →
 * centro da cidade no Open-Meteo. Endereço que nenhum provedor localiza não é erro:
 * volta `found: false`, com `indisponivel` dizendo se foi falha de provedor ou só ausência.
 */
export async function resolverEndereco(
  endereco: Endereco & { hasStructured: boolean },
  p: Provedores
): Promise<Resolucao> {
  const { address, street, city, state, postalcode, hasStructured } = endereco;

  const primary = new URLSearchParams({
    format: "json",
    limit: "1",
    country: "Brazil",
  });
  if (hasStructured) {
    if (street) primary.set("street", street);
    if (city) primary.set("city", city);
    if (state) primary.set("state", state);
    if (postalcode) primary.set("postalcode", postalcode);
  } else {
    primary.set("q", (address ?? "").trim());
    primary.set("countrycodes", "br");
  }

  let result: GeoResult | null = null;
  let falhouNominatim = false;
  let falhouFallback = false;
  try {
    result = await p.nominatim(primary);
    if (!result && city) {
      const soCidade = new URLSearchParams({
        format: "json",
        limit: "1",
        country: "Brazil",
        city,
      });
      if (state) soCidade.set("state", state);
      result = await p.nominatim(soCidade);
    }
  } catch {
    falhouNominatim = true;
  }

  let cidade = city;
  let estado = state;
  if (!result && !cidade && postalcode) {
    const cep = await p.brasilApiCep(postalcode).catch(() => null);
    result = cep?.coordenadas ?? null;
    cidade = cep?.city;
    estado = estado ?? cep?.state;
    if (falhouNominatim) p.fallback?.("brasilapi-cep", Boolean(result));
  }
  if (!result && cidade) {
    try {
      result = await p.openMeteoCidade(cidade, estado);
    } catch {
      falhouFallback = true;
    }
    if (falhouNominatim) p.fallback?.("open-meteo", Boolean(result));
  }

  if (result) return { found: true, result };
  return { found: false, indisponivel: falhouNominatim || falhouFallback };
}
