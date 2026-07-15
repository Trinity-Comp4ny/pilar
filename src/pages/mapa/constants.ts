import { Map as MapIcon, Satellite, Sun, Moon } from "lucide-react";
import type { ProjectStatus } from "@/constants";

// Constantes puras (sem dependência do Leaflet) compartilhadas entre a casca da
// página (index.tsx) e o canvas do mapa carregado sob demanda (MapCanvas.tsx).

export const TILE_LAYERS = {
  rua: {
    label: "Rua",
    icon: MapIcon,
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satelite: {
    label: "Satélite",
    icon: Satellite,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
  claro: {
    label: "Claro",
    icon: Sun,
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  escuro: {
    label: "Escuro",
    icon: Moon,
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
} as const;

export type TileLayerKey = keyof typeof TILE_LAYERS;

export const STATUS_MARKER_COLORS: Record<string, string> = {
  Planejamento: "hsl(var(--status-planning))",
  "Em andamento": "hsl(var(--status-progress))",
  Revisão: "hsl(var(--status-review))",
  Concluído: "hsl(var(--status-done))",
  Paralisado: "hsl(var(--status-paused))",
  Cancelado: "hsl(var(--status-cancelled))",
};

// Símbolo por status para não depender só da cor (WCAG 1.4.1 — daltônicos).
export const STATUS_SYMBOLS: Record<string, string> = {
  Planejamento: "◷",
  "Em andamento": "▸",
  Revisão: "◎",
  Concluído: "✓",
  Paralisado: "‖",
  Cancelado: "✕",
};

export interface ProjetoMapa {
  id: string;
  nome: string;
  codigo_projeto: string;
  status: ProjectStatus;
  localizacao: string | null;
  latitude: number;
  longitude: number;
  valor_contrato: number | null;
  cliente_nome: string | null;
  cliente_id: string | null;
  data_inicio: string | null;
  data_previsao: string | null;
  area_m2: number | null;
  prioridade: string | null;
}

// Faixa geográfica plausível do Brasil (com folga). Coordenadas fora disso
// (inclusive 0/0, que cairia no Golfo da Guiné) são tratadas como sem-coordenada.
const BR_LAT_MIN = -34;
const BR_LAT_MAX = 5;
const BR_LNG_MIN = -74;
const BR_LNG_MAX = -34;

export function temCoordenadaValida(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= BR_LAT_MIN &&
    lat <= BR_LAT_MAX &&
    lng >= BR_LNG_MIN &&
    lng <= BR_LNG_MAX
  );
}
