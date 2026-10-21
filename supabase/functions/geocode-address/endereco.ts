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
