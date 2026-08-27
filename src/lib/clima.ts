/**
 * Clima via Open-Meteo (grátis, sem chave de API, CORS liberado — ideal para
 * repo público). Geocoding (cidade → lat/long) e previsão. A API de previsão
 * trabalha por COORDENADA; a cidade só serve para achar a lat/long.
 * O mapeamento dos códigos WMO e utilitários são puros e testáveis.
 * Docs: https://open-meteo.com/en/docs
 *
 * Chamadas direto do browser (sem proxy de edge function): CSP já libera os
 * domínios e nenhum já quebrou em produção, diferente do CEP (ADR 0033). Toda
 * resposta passa por schema Zod na fronteira; se o formato mudar, reporta pro
 * Sentry em vez de deixar `undefined` se propagar silencioso pela UI.
 */

import { z } from "zod";
import { monitoring } from "./monitoring";

const GEO_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";

/** Reporta mudança de formato de resposta de API externa (não captura sozinho, chame no catch/branch de falha). */
function reportShapeMismatch(fn: string, provider: string, issues: unknown, raw: unknown): void {
  monitoring.captureException(
    new Error(`${provider}: formato de resposta mudou`),
    { fn, provider, issues, raw },
    { tags: { provider, reason: "shape-mismatch" } }
  );
}

const numArr = z.array(z.number().nullable());
const strArr = z.array(z.string());

const geoResponseSchema = z
  .object({
    results: z
      .array(
        z
          .object({
            name: z.string(),
            latitude: z.number(),
            longitude: z.number(),
            admin1: z.string().optional(),
            country: z.string().optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

const forecastResponseSchema = z
  .object({
    current: z
      .object({
        temperature_2m: z.number().optional(),
        apparent_temperature: z.number().optional(),
        relative_humidity_2m: z.number().optional(),
        precipitation: z.number().optional(),
        weather_code: z.number().optional(),
        wind_speed_10m: z.number().optional(),
        wind_gusts_10m: z.number().optional(),
        wind_direction_10m: z.number().optional(),
        is_day: z.number().optional(),
      })
      .passthrough()
      .optional(),
    hourly: z
      .object({
        time: strArr,
        temperature_2m: z.array(z.number()),
        weather_code: z.array(z.number()),
        precipitation_probability: numArr,
        precipitation: numArr,
        is_day: numArr,
      })
      .passthrough()
      .optional(),
    daily: z
      .object({
        time: strArr,
        weather_code: z.array(z.number()),
        temperature_2m_max: z.array(z.number()),
        temperature_2m_min: z.array(z.number()),
        precipitation_probability_max: numArr,
        precipitation_sum: numArr,
        wind_speed_10m_max: numArr,
        uv_index_max: numArr,
        sunrise: strArr,
        sunset: strArr,
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const historicoResponseSchema = z
  .object({
    daily: z.object({ precipitation_sum: numArr }).passthrough().optional(),
  })
  .passthrough();

const reverseGeoResponseSchema = z
  .object({
    city: z.string().optional(),
    locality: z.string().optional(),
    principalSubdivision: z.string().optional(),
  })
  .passthrough();

export type CategoriaClima = "sol" | "nuvem" | "chuva" | "tempestade" | "neve" | "nevoa";
/** Enum de clima do RDO (spec 015), para autofill futuro do diário. */
export type ClimaRdo = "ensolarado" | "nublado" | "chuvoso" | "chuva_forte";

export interface CodigoClima {
  label: string;
  categoria: CategoriaClima;
  chuva: boolean;
  rdo: ClimaRdo;
}

/** Tabela WMO → PT (https://open-meteo.com/en/docs, "Weather variable documentation"). */
export function climaPorCodigo(code: number | null | undefined): CodigoClima {
  const c = code ?? -1;
  if (c === 0) return { label: "Céu limpo", categoria: "sol", chuva: false, rdo: "ensolarado" };
  if (c === 1) return { label: "Predomínio de sol", categoria: "sol", chuva: false, rdo: "ensolarado" };
  if (c === 2) return { label: "Parcialmente nublado", categoria: "nuvem", chuva: false, rdo: "nublado" };
  if (c === 3) return { label: "Nublado", categoria: "nuvem", chuva: false, rdo: "nublado" };
  if (c === 45 || c === 48) return { label: "Névoa", categoria: "nevoa", chuva: false, rdo: "nublado" };
  if (c >= 51 && c <= 57) return { label: "Garoa", categoria: "chuva", chuva: true, rdo: "chuvoso" };
  if (c === 61 || c === 63) return { label: "Chuva", categoria: "chuva", chuva: true, rdo: "chuvoso" };
  if (c === 65) return { label: "Chuva forte", categoria: "chuva", chuva: true, rdo: "chuva_forte" };
  if (c === 66 || c === 67) return { label: "Chuva congelante", categoria: "chuva", chuva: true, rdo: "chuvoso" };
  if (c >= 71 && c <= 77) return { label: "Neve", categoria: "neve", chuva: false, rdo: "nublado" };
  if (c === 80 || c === 81) return { label: "Pancadas de chuva", categoria: "chuva", chuva: true, rdo: "chuvoso" };
  if (c === 82) return { label: "Pancadas fortes", categoria: "chuva", chuva: true, rdo: "chuva_forte" };
  if (c === 85 || c === 86) return { label: "Pancadas de neve", categoria: "neve", chuva: false, rdo: "nublado" };
  if (c === 95) return { label: "Trovoada", categoria: "tempestade", chuva: true, rdo: "chuva_forte" };
  if (c === 96 || c === 99)
    return { label: "Trovoada com granizo", categoria: "tempestade", chuva: true, rdo: "chuva_forte" };
  return { label: "Indisponível", categoria: "nuvem", chuva: false, rdo: "nublado" };
}

/** Graus → rosa dos ventos (8 pontos). */
export function direcaoVento(graus: number | null | undefined): string {
  if (graus == null) return "";
  const pts = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  return pts[Math.round(graus / 45) % 8];
}

/** Índice UV → rótulo de risco (escala OMS). */
export function nivelUV(uv: number | null | undefined): string {
  const v = uv ?? 0;
  if (v < 3) return "Baixo";
  if (v < 6) return "Moderado";
  if (v < 8) return "Alto";
  if (v < 11) return "Muito alto";
  return "Extremo";
}

export interface LocalGeo {
  nome: string;
  latitude: number;
  longitude: number;
  admin1: string | null;
  pais: string | null;
  /** Rótulo pronto: "Curitiba, Paraná, Brasil". */
  rotulo: string;
}

function montarRotulo(nome: string, admin1?: string | null, pais?: string | null): string {
  return [nome, admin1, pais].filter(Boolean).join(", ");
}

/**
 * Busca locais por "cidade" ou "cidade, estado". Retorna vários resultados para
 * o usuário desambiguar. Se um estado é informado, os que casam vêm primeiro.
 */
export async function buscarLocais(consulta: string): Promise<LocalGeo[]> {
  const [nomeRaw, ufRaw] = consulta.split(",").map((s) => s.trim());
  const nome = nomeRaw ?? "";
  if (nome.length < 2) return [];
  const url = `${GEO_BASE}?name=${encodeURIComponent(nome)}&count=10&language=pt&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar a cidade");
  const raw = await res.json();
  const parsed = geoResponseSchema.safeParse(raw);
  if (!parsed.success) {
    reportShapeMismatch("buscarLocais", "open-meteo-geocoding", parsed.error.issues, raw);
    throw new Error("Falha ao buscar a cidade");
  }
  const json = parsed.data;
  const locais: LocalGeo[] = (json.results ?? []).map((r) => ({
    nome: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    admin1: r.admin1 ?? null,
    pais: r.country ?? null,
    rotulo: montarRotulo(r.name, r.admin1, r.country),
  }));
  if (ufRaw) {
    const uf = ufRaw.toLowerCase();
    locais.sort((a, b) => {
      const am = (a.admin1 ?? "").toLowerCase().includes(uf) ? 0 : 1;
      const bm = (b.admin1 ?? "").toLowerCase().includes(uf) ? 0 : 1;
      return am - bm;
    });
  }
  return locais;
}

/** Compat: primeira coordenada de uma cidade (usado no geocode do CEP da obra). */
export async function geocodarCidade(nome: string): Promise<LocalGeo[]> {
  return buscarLocais(nome);
}

export interface CondicaoAtual {
  temp: number;
  sensacao: number;
  umidade: number;
  vento: number;
  rajada: number;
  direcao: string;
  precipitacao: number;
  code: number;
  ehDia: boolean;
}

export interface DiaPrevisao {
  data: string;
  code: number;
  tempMax: number;
  tempMin: number;
  chuvaProb: number;
  chuvaMm: number;
  ventoMax: number;
  uvMax: number;
  nascer: string | null;
  ocaso: string | null;
}

export interface HoraPrevisao {
  hora: string;
  code: number;
  temp: number;
  chuvaProb: number;
  chuvaMm: number;
  ehDia: boolean;
}

/**
 * Cor da temperatura (escala fria → quente), para a barra de min-máx.
 * Paradas em °C → matiz: azul → ciano → verde → amarelo → laranja → vermelho.
 * Calibrado para a faixa brasileira (típico 5–35°C tem variação visível).
 */
const TEMP_STOPS: ReadonlyArray<readonly [number, number]> = [
  [5, 222],
  [12, 200],
  [17, 175],
  [21, 135],
  [25, 58],
  [29, 32],
  [33, 12],
  [38, 2],
];
export function corTemperatura(t: number): string {
  const stops = TEMP_STOPS;
  let hue = stops[0][1];
  if (t <= stops[0][0]) hue = stops[0][1];
  else if (t >= stops[stops.length - 1][0]) hue = stops[stops.length - 1][1];
  else {
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, h0] = stops[i - 1];
        const [t1, h1] = stops[i];
        hue = h0 + ((h1 - h0) * (t - t0)) / (t1 - t0);
        break;
      }
    }
  }
  return `hsl(${Math.round(hue)} 68% 50%)`;
}

export interface Previsao {
  atual: CondicaoAtual;
  dias: DiaPrevisao[];
  horas: HoraPrevisao[];
}

/** Clima atual + previsão horária (hoje) + diária (14 dias) para uma coordenada. */
export async function buscarPrevisao(latitude: number, longitude: number): Promise<Previsao> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day",
    hourly: "temperature_2m,weather_code,precipitation_probability,precipitation,is_day",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset",
    timezone: "auto",
    forecast_days: "16",
  });
  const res = await fetch(`${FORECAST_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error("Falha ao buscar a previsão");
  const raw = await res.json();
  const parsed = forecastResponseSchema.safeParse(raw);
  if (!parsed.success) {
    reportShapeMismatch("buscarPrevisao", "open-meteo-forecast", parsed.error.issues, raw);
    throw new Error("Falha ao buscar a previsão");
  }
  const j = parsed.data;

  const cur = j.current ?? {};
  const d = j.daily;
  const dias: DiaPrevisao[] = d
    ? d.time.map((data, i) => ({
        data,
        code: d.weather_code[i],
        tempMax: Math.round(d.temperature_2m_max[i]),
        tempMin: Math.round(d.temperature_2m_min[i]),
        chuvaProb: d.precipitation_probability_max[i] ?? 0,
        chuvaMm: Math.round((d.precipitation_sum[i] ?? 0) * 10) / 10,
        ventoMax: Math.round(d.wind_speed_10m_max[i] ?? 0),
        uvMax: Math.round(d.uv_index_max[i] ?? 0),
        nascer: d.sunrise[i] ?? null,
        ocaso: d.sunset[i] ?? null,
      }))
    : [];

  const horas = proximasHoras(j.hourly);

  return {
    atual: {
      temp: Math.round(cur.temperature_2m ?? 0),
      sensacao: Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 0),
      umidade: Math.round(cur.relative_humidity_2m ?? 0),
      vento: Math.round(cur.wind_speed_10m ?? 0),
      rajada: Math.round(cur.wind_gusts_10m ?? 0),
      direcao: direcaoVento(cur.wind_direction_10m),
      precipitacao: Math.round((cur.precipitation ?? 0) * 10) / 10,
      code: cur.weather_code ?? -1,
      ehDia: (cur.is_day ?? 1) === 1,
    },
    dias,
    horas,
  };
}

/** Próximas 48 horas a partir de agora (hora local do local consultado). */
function proximasHoras(hourly?: {
  time: string[];
  temperature_2m: number[];
  weather_code: number[];
  precipitation_probability: (number | null)[];
  precipitation: (number | null)[];
  is_day: (number | null)[];
}): HoraPrevisao[] {
  if (!hourly) return [];
  const agora = Date.now();
  const idx = hourly.time.findIndex((t) => new Date(t).getTime() >= agora);
  const inicio = idx < 0 ? 0 : idx;
  return hourly.time.slice(inicio, inicio + 48).map((hora, k) => {
    const i = inicio + k;
    return {
      hora,
      code: hourly.weather_code[i],
      temp: Math.round(hourly.temperature_2m[i]),
      chuvaProb: hourly.precipitation_probability[i] ?? 0,
      chuvaMm: Math.round((hourly.precipitation[i] ?? 0) * 10) / 10,
      ehDia: (hourly.is_day?.[i] ?? 1) === 1,
    };
  });
}

/** Dias com chuva relevante (prob >= 60% ou código de chuva/tempestade). */
export function diasComChuva(dias: DiaPrevisao[]): DiaPrevisao[] {
  return dias.filter((d) => d.chuvaProb >= 60 || climaPorCodigo(d.code).chuva);
}

/** Vento forte para obra (içamento/andaime/grua): rajada/vento máx >= 50 km/h. */
export const VENTO_FORTE_KMH = 50;

export interface Historico {
  totalDias: number;
  diasChuva: number;
  chuvaMm: number;
}

/** Chuva dos últimos N dias (padrão 14), via past_days do Open-Meteo. */
export async function buscarHistorico(latitude: number, longitude: number, dias = 14): Promise<Historico> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: "precipitation_sum",
    past_days: String(dias),
    forecast_days: "1",
    timezone: "auto",
  });
  const res = await fetch(`${FORECAST_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error("Falha ao buscar o histórico");
  const raw = await res.json();
  const parsed = historicoResponseSchema.safeParse(raw);
  if (!parsed.success) {
    reportShapeMismatch("buscarHistorico", "open-meteo-forecast", parsed.error.issues, raw);
    throw new Error("Falha ao buscar o histórico");
  }
  const j = parsed.data;
  const somas = (j.daily?.precipitation_sum ?? []).slice(0, dias);
  const comChuva = somas.filter((mm) => (mm ?? 0) >= 1).length;
  const total = somas.reduce<number>((acc, mm) => acc + (mm ?? 0), 0);
  return { totalDias: dias, diasChuva: comChuva, chuvaMm: Math.round(total) };
}

// --- Clima × cronograma (spec 040): alerta de etapa sensível vs previsão ------

/** Tarefa do cronograma com sensibilidade a clima e janela prevista. */
export interface TarefaSensivel {
  id: string;
  titulo: string;
  /** Tipo de sensibilidade (`concretagem`, `icamento`...); null = não sensível. */
  sensivel_clima: string | null;
  data_inicio: string | null;
  prazo: string | null;
  status?: string | null;
}

export interface AlertaClima {
  tarefaId: string;
  titulo: string;
  /** Tipo de sensibilidade da tarefa. */
  tipo: string;
  /** Primeiro dia de risco dentro da janela da tarefa ("YYYY-MM-DD"). */
  data: string;
  motivo: "chuva" | "vento";
  /** Texto pronto: "chuva forte (85%)" ou "vento 55 km/h". */
  detalhe: string;
}

/** Tipos cuja restrição é vento (içamento/grua); o resto é sensível a chuva. */
const TIPOS_SENSIVEIS_VENTO = new Set(["icamento"]);

/**
 * Cruza tarefas sensíveis a clima com a previsão diária e devolve, por tarefa,
 * o PRIMEIRO dia dentro da janela (data_inicio→prazo) que viola a condição:
 * - chuva: probabilidade ≥ `chuvaProbMin` (padrão 60%) OU código de chuva/tempestade;
 * - vento (içamento): vento máx ≥ `ventoMaxKmh` (padrão VENTO_FORTE_KMH).
 * Puro e sem rede. Tarefa concluída, sem tipo ou sem janela não gera alerta.
 * Datas em "YYYY-MM-DD" comparam corretamente como string.
 */
export function alertasClimaTarefas(
  tarefas: ReadonlyArray<TarefaSensivel>,
  dias: ReadonlyArray<DiaPrevisao>,
  opts?: { chuvaProbMin?: number; ventoMaxKmh?: number }
): AlertaClima[] {
  const chuvaProbMin = opts?.chuvaProbMin ?? 60;
  const ventoMaxKmh = opts?.ventoMaxKmh ?? VENTO_FORTE_KMH;
  const alertas: AlertaClima[] = [];

  for (const t of tarefas) {
    if (!t.sensivel_clima || t.status === "concluida") continue;
    if (!t.data_inicio || !t.prazo) continue;

    const porVento = TIPOS_SENSIVEIS_VENTO.has(t.sensivel_clima);
    const dia = dias.find((d) => {
      if (d.data < t.data_inicio! || d.data > t.prazo!) return false;
      if (porVento) return d.ventoMax >= ventoMaxKmh;
      return d.chuvaProb >= chuvaProbMin || climaPorCodigo(d.code).chuva;
    });
    if (!dia) continue;

    alertas.push({
      tarefaId: t.id,
      titulo: t.titulo,
      tipo: t.sensivel_clima,
      data: dia.data,
      motivo: porVento ? "vento" : "chuva",
      detalhe: porVento
        ? `vento ${dia.ventoMax} km/h`
        : `${climaPorCodigo(dia.code).label.toLowerCase()} (${dia.chuvaProb}%)`,
    });
  }
  return alertas;
}

/** Reverse geocoding (coordenada → cidade). Best-effort, sem chave (BigDataCloud). */
export async function nomeDaCoordenada(latitude: number, longitude: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`
    );
    if (!res.ok) return "Minha localização";
    const raw = await res.json();
    const parsed = reverseGeoResponseSchema.safeParse(raw);
    if (!parsed.success) {
      reportShapeMismatch("nomeDaCoordenada", "bigdatacloud", parsed.error.issues, raw);
      return "Minha localização";
    }
    const j = parsed.data;
    const cidade = j.city || j.locality;
    return cidade ? [cidade, j.principalSubdivision].filter(Boolean).join(", ") : "Minha localização";
  } catch (err) {
    monitoring.captureException(
      err,
      { fn: "nomeDaCoordenada" },
      { tags: { provider: "bigdatacloud", reason: "request-failed" } }
    );
    return "Minha localização";
  }
}
