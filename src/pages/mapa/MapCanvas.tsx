import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// Assets do marcador empacotados pelo Vite (evita dependência de CDN externa,
// que quebra sob CSP restritiva ou se o CDN estiver fora do ar).
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  PLACA_SELO,
  STATUS_MARKER_COLORS,
  STATUS_SYMBOLS,
  TILE_LAYERS,
  type ProjetoMapa,
  type TileLayerKey,
  type TipoMapa,
} from "./constants";
import { PLACA_LABEL, type PlacaStatus } from "@/lib/placa";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Projeto = círculo; obra = quadrado arredondado. O selo no canto mostra a situação da placa.
const markerHtml = (color: string, tipo: TipoMapa, placa: PlacaStatus) => {
  const selo = PLACA_SELO[placa];
  const raio = tipo === "obra" ? "6px" : "50%";
  return (
    `<div style="position:relative;width:24px;height:24px;">` +
    `<div style="background:${color};width:24px;height:24px;border-radius:${raio};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);box-sizing:border-box;"></div>` +
    `<span style="position:absolute;top:-7px;right:-9px;width:14px;height:14px;border-radius:50%;background:${selo.cor};color:white;font-size:9px;font-weight:700;line-height:14px;text-align:center;border:1.5px solid white;">${selo.simbolo}</span>` +
    `</div>`
  );
};

const iconCache = new Map<string, L.DivIcon>();

function getMarkerIcon(status: string, tipo: TipoMapa, placa: PlacaStatus): L.DivIcon {
  const key = `${status}|${tipo}|${placa}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const icon = L.divIcon({
    className: "custom-marker",
    html: markerHtml(STATUS_MARKER_COLORS[status] ?? "hsl(var(--status-unknown))", tipo, placa),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
  iconCache.set(key, icon);
  return icon;
}

function createClusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 50 ? 44 : 52;
  return L.divIcon({
    html: `<div style="background:hsl(var(--chart-info));color:white;width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:${size < 40 ? 13 : 14}px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${count}</div>`,
    className: "custom-cluster-icon",
    iconSize: L.point(size, size),
  });
}

function MapController({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    // Tiles ficam em branco quando o container ainda não tem dimensões finais.
    // invalidateSize força o Leaflet a recalcular após o layout estabilizar.
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map, mapRef]);
  return null;
}

function FitBounds({ projetos }: { projetos: ProjetoMapa[] }) {
  const map = useMap();
  useEffect(() => {
    if (projetos.length === 0) return;
    const bounds = L.latLngBounds(projetos.map((p) => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, projetos]);
  return null;
}

function FlyToProject({
  projeto,
  onMarkerClick,
}: {
  projeto: ProjetoMapa | null;
  onMarkerClick: (p: ProjetoMapa) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!projeto) return;
    map.flyTo([projeto.latitude, projeto.longitude], 16, { duration: 1.2 });
    const timer = setTimeout(() => {
      onMarkerClick(projeto);
    }, 1300);
    return () => clearTimeout(timer);
  }, [map, projeto, onMarkerClick]);
  return null;
}

interface MapCanvasProps {
  filtrados: ProjetoMapa[];
  tileKey: TileLayerKey;
  selectedProjeto: ProjetoMapa | null;
  mapRef: React.MutableRefObject<L.Map | null>;
  onMarkerClick: (p: ProjetoMapa) => void;
}

export default function MapCanvas({ filtrados, tileKey, selectedProjeto, mapRef, onMarkerClick }: MapCanvasProps) {
  return (
    <MapContainer center={[-15.78, -47.93]} zoom={4} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
      <MapController mapRef={mapRef} />
      <TileLayer key={tileKey} attribution={TILE_LAYERS[tileKey].attribution} url={TILE_LAYERS[tileKey].url} />
      <FitBounds projetos={filtrados} />
      <FlyToProject projeto={selectedProjeto} onMarkerClick={onMarkerClick} />
      <MarkerClusterGroup
        chunkedLoading
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={50}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
      >
        {filtrados.map((projeto) => (
          <Marker
            key={`${projeto.tipo}-${projeto.id}`}
            position={[projeto.latitude, projeto.longitude]}
            icon={getMarkerIcon(projeto.status, projeto.tipo, projeto.placa_status)}
            eventHandlers={{ click: () => onMarkerClick(projeto) }}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
              <span className="flex flex-col">
                <span className="text-xs font-medium">{projeto.nome}</span>
                <span className="text-2xs text-muted-foreground">
                  {projeto.tipo === "obra" ? "Obra · " : ""}
                  {STATUS_SYMBOLS[projeto.status] ?? ""} {projeto.status}
                </span>
                <span className="text-2xs text-muted-foreground">Placa: {PLACA_LABEL[projeto.placa_status]}</span>
              </span>
            </Tooltip>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
