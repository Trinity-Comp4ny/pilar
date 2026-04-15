import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, ExternalLink, Search } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { PROJECT_STATUS, PROJECT_STATUS_CONFIG, type ProjectStatus } from "@/constants";
import { usePageTitle } from "@/hooks/usePageTitle";

delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const STATUS_MARKER_COLORS: Record<string, string> = {
  Planejamento: "#eab308",
  "Em andamento": "#3b82f6",
  Revisão: "#a855f7",
  Concluído: "#22c55e",
  Paralisado: "#f97316",
  Cancelado: "#ef4444",
};

function createColoredIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 50 ? 44 : 52;
  return L.divIcon({
    html: `<div style="background:#3b82f6;color:white;width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:${size < 40 ? 13 : 14}px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${count}</div>`,
    className: "custom-cluster-icon",
    iconSize: L.point(size, size),
  });
}

interface ProjetoMapa {
  id: string;
  nome: string;
  codigo_projeto: string;
  status: ProjectStatus;
  localizacao: string | null;
  latitude: number;
  longitude: number;
  valor_contrato: number | null;
  cliente_nome: string | null;
}

/* ── Auto-fit: ajusta o mapa para enquadrar todos os marcadores ── */
function FitBounds({ projetos }: { projetos: ProjetoMapa[] }) {
  const map = useMap();

  useEffect(() => {
    if (projetos.length === 0) return;
    const bounds = L.latLngBounds(projetos.map((p) => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, projetos]);

  return null;
}

/* ── FlyTo: voa até um projeto específico e abre o popup ── */
function FlyToProject({
  projeto,
  markerRefs,
}: {
  projeto: ProjetoMapa | null;
  markerRefs: React.MutableRefObject<Record<string, L.Marker>>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!projeto) return;
    map.flyTo([projeto.latitude, projeto.longitude], 16, { duration: 1.2 });
    const timer = setTimeout(() => {
      markerRefs.current[projeto.id]?.openPopup();
    }, 1300);
    return () => clearTimeout(timer);
  }, [map, projeto, markerRefs]);

  return null;
}

export default function MapaObras() {
  usePageTitle("Mapa de Obras");
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<ProjetoMapa | null>(null);
  const markerRefs = useRef<Record<string, L.Marker>>({});

  const { data: projetos = [], isLoading } = useQuery({
    queryKey: ["projetos-mapa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, codigo_projeto, status, localizacao, latitude, longitude, valor_contrato, clientes(nome)")
        .is("deleted_at", null)
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (error) throw error;

      return (data || [])
        .filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number")
        .map((p) => ({
          id: p.id,
          nome: p.nome,
          codigo_projeto: p.codigo_projeto ?? "—",
          status: p.status as ProjectStatus,
          localizacao: p.localizacao,
          latitude: p.latitude as number,
          longitude: p.longitude as number,
          valor_contrato: p.valor_contrato,
          cliente_nome: p.clientes?.nome ?? null,
        })) as ProjetoMapa[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const filtrados = useMemo(() => {
    if (statusFilter === "todos") return projetos;
    return projetos.filter((p) => p.status === statusFilter);
  }, [projetos, statusFilter]);

  const contagemPorStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of filtrados) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [filtrados]);

  const formatCurrency = (v: number | null) =>
    v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

  const handleLegendClick = useCallback((status: string) => {
    setStatusFilter((prev) => (prev === status ? "todos" : status));
  }, []);

  const handleSearchSelect = useCallback(
    (projetoId: string) => {
      const projeto = projetos.find((p) => p.id === projetoId);
      if (projeto) {
        setSelectedProjeto(projeto);
        setSearchOpen(false);
      }
    },
    [projetos]
  );

  return (
    <PageLayout>
      <PageHeader title="Mapa de Obras" description="Visualize a localização dos seus projetos">
        <div className="flex items-center gap-2">
          {/* Busca de projeto */}
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Localizar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Buscar projeto..." />
                <CommandList>
                  <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                  <CommandGroup>
                    {projetos.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={`${p.codigo_projeto} ${p.nome}`}
                        onSelect={() => handleSearchSelect(p.id)}
                        className="gap-2"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: STATUS_MARKER_COLORS[p.status] || "#6b7280" }}
                        />
                        <span className="truncate">
                          {p.codigo_projeto} - {p.nome}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Filtro por status */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.values(PROJECT_STATUS).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum projeto com localização geográfica encontrado.</p>
          <p className="text-xs mt-1">Projetos precisam ter endereço com coordenadas para aparecer no mapa.</p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden border" style={{ height: "calc(100vh - 220px)" }}>
          <MapContainer
            center={[-15.78, -47.93]}
            zoom={4}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds projetos={filtrados} />
            <FlyToProject projeto={selectedProjeto} markerRefs={markerRefs} />
            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createClusterIcon}
              maxClusterRadius={50}
              spiderfyOnMaxZoom
              showCoverageOnHover={false}
            >
              {filtrados.map((projeto) => (
                <Marker
                  key={projeto.id}
                  position={[projeto.latitude, projeto.longitude]}
                  icon={createColoredIcon(STATUS_MARKER_COLORS[projeto.status] || "#6b7280")}
                  ref={(ref) => {
                    if (ref) markerRefs.current[projeto.id] = ref;
                  }}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <p className="font-semibold text-sm">
                        {projeto.codigo_projeto} - {projeto.nome}
                      </p>
                      {projeto.cliente_nome && <p className="text-xs text-gray-600">{projeto.cliente_nome}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-[10px] ${PROJECT_STATUS_CONFIG[projeto.status]?.color || ""}`}>
                          {projeto.status}
                        </Badge>
                        <span className="text-xs">{formatCurrency(projeto.valor_contrato)}</span>
                      </div>
                      {projeto.localizacao && <p className="text-[11px] text-gray-500 mt-1">{projeto.localizacao}</p>}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 h-7 text-xs gap-1"
                        onClick={() => navigate(`/projetos/${projeto.id}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Abrir Projeto
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      )}

      {/* Legenda clicável com contagem por status */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {Object.entries(STATUS_MARKER_COLORS).map(([status, color]) => {
          const count = contagemPorStatus[status] || 0;
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => handleLegendClick(status)}
              className={`flex items-center gap-1.5 text-xs transition-opacity ${
                isActive
                  ? "text-foreground font-medium"
                  : statusFilter !== "todos"
                    ? "text-muted-foreground/40"
                    : "text-muted-foreground"
              } hover:opacity-80`}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0 transition-transform"
                style={{
                  background: color,
                  transform: isActive ? "scale(1.3)" : "scale(1)",
                  boxShadow: isActive ? `0 0 0 2px ${color}40` : "none",
                }}
              />
              {status} ({count})
            </button>
          );
        })}
        <span className="text-xs text-muted-foreground ml-auto">{filtrados.length} projeto(s) no mapa</span>
      </div>
    </PageLayout>
  );
}
