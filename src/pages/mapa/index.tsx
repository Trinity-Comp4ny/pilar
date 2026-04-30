import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Loader2,
  MapPin,
  ExternalLink,
  Search,
  Map as MapIcon,
  Satellite,
  Sun,
  Moon,
  Layers,
  Crosshair,
  Maximize,
  Minimize,
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
} from "lucide-react";

const TILE_LAYERS = {
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

type TileLayerKey = keyof typeof TILE_LAYERS;
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { PROJECT_STATUS, PROJECT_STATUS_CONFIG, type ProjectStatus } from "@/constants";
import { usePageTitle } from "@/hooks/usePageTitle";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const STATUS_MARKER_COLORS: Record<string, string> = {
  Planejamento: "hsl(var(--status-planning))",
  "Em andamento": "hsl(var(--status-progress))",
  Revisão: "hsl(var(--status-review))",
  Concluído: "hsl(var(--status-done))",
  Paralisado: "hsl(var(--status-paused))",
  Cancelado: "hsl(var(--status-cancelled))",
};

const STATUS_ICONS: Record<string, L.DivIcon> = Object.fromEntries(
  Object.entries(STATUS_MARKER_COLORS).map(([status, color]) => [
    status,
    L.divIcon({
      className: "custom-marker",
      html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    }),
  ])
);

const FALLBACK_ICON = L.divIcon({
  className: "custom-marker",
  html: `<div style="background:hsl(var(--status-unknown));width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

function getStatusIcon(status: string): L.DivIcon {
  return STATUS_ICONS[status] ?? FALLBACK_ICON;
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
  cliente_id: string | null;
  data_inicio: string | null;
  data_previsao: string | null;
  area_m2: number | null;
  prioridade: string | null;
}

function MapController({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
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

function formatCurrency(v: number | null) {
  return v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : null;
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function MapaObras() {
  usePageTitle("Mapa");
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<ProjetoMapa | null>(null);
  const [sheetProjeto, setSheetProjeto] = useState<ProjetoMapa | null>(null);
  const [tileKey, setTileKey] = useState<TileLayerKey>("rua");
  const [tileMenuOpen, setTileMenuOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [semCoordenadasExpanded, setSemCoordenadasExpanded] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const { data: todosOsProjetos = [], isLoading } = useQuery({
    queryKey: ["projetos-mapa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select(
          "id, nome, codigo_projeto, status, localizacao, latitude, longitude, valor_contrato, area_m2, prioridade, data_inicio, data_previsao, cliente_id, clientes(nome)"
        )
        .is("deleted_at", null);

      if (error) throw error;

      return (data || []).map((p) => ({
        id: p.id,
        nome: p.nome,
        codigo_projeto: p.codigo_projeto ?? "—",
        status: p.status as ProjectStatus,
        localizacao: p.localizacao,
        latitude: p.latitude,
        longitude: p.longitude,
        valor_contrato: p.valor_contrato,
        cliente_nome: p.clientes?.nome ?? null,
        cliente_id: p.cliente_id,
        data_inicio: p.data_inicio,
        data_previsao: p.data_previsao,
        area_m2: p.area_m2,
        prioridade: p.prioridade,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  const { projetos, semCoordenadas } = useMemo(() => {
    const com: ProjetoMapa[] = [];
    const sem: typeof todosOsProjetos = [];
    for (const p of todosOsProjetos) {
      if (typeof p.latitude === "number" && typeof p.longitude === "number") {
        com.push(p as ProjetoMapa);
      } else {
        sem.push(p);
      }
    }
    return { projetos: com, semCoordenadas: sem };
  }, [todosOsProjetos]);

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

  const clientesAgrupados = useMemo(() => {
    type ClienteEntry = { id: string | null; nome: string; projetos: ProjetoMapa[] };
    const acc: Record<string, ClienteEntry> = {};
    for (const p of projetos) {
      const key = p.cliente_id ?? "__sem_cliente__";
      if (!acc[key]) acc[key] = { id: p.cliente_id, nome: p.cliente_nome ?? "Sem cliente", projetos: [] };
      acc[key].projetos.push(p);
    }
    return Object.values(acc).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [projetos]);

  const handleLegendClick = useCallback((status: string) => {
    setStatusFilter((prev) => (prev === status ? "todos" : status));
  }, []);

  const handleFitBounds = useCallback(() => {
    if (!mapRef.current || filtrados.length === 0) return;
    const bounds = L.latLngBounds(filtrados.map((p) => [p.latitude, p.longitude]));
    mapRef.current.flyToBounds(bounds, { padding: [40, 40], maxZoom: 14, duration: 0.8 });
  }, [filtrados]);

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

  const handleClienteSelect = useCallback(
    (clienteId: string | null) => {
      const key = clienteId ?? "__sem_cliente__";
      const clienteProjetos = clientesAgrupados.find((c) => (c.id ?? "__sem_cliente__") === key)?.projetos ?? [];
      setSearchOpen(false);
      if (!mapRef.current || clienteProjetos.length === 0) return;
      const bounds = L.latLngBounds(clienteProjetos.map((p) => [p.latitude, p.longitude]));
      mapRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 14, duration: 1 });
    },
    [clientesAgrupados]
  );

  const handleMarkerClick = useCallback((p: ProjetoMapa) => {
    setSheetProjeto(p);
  }, []);

  return (
    <PageLayout
      header={
        <PageHeader title="Mapa de Obras" description="Visualize a localização dos seus projetos">
          <div className="flex items-center gap-2">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Search className="h-3.5 w-3.5" />
                  Localizar
                  {filtrados.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none">
                      {filtrados.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="end">
                <Command>
                  <CommandInput placeholder="Buscar projeto ou cliente..." />
                  <CommandList>
                    <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                    <CommandGroup heading="Projetos">
                      {projetos.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.codigo_projeto} ${p.nome}`}
                          onSelect={() => handleSearchSelect(p.id)}
                          className="gap-2"
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: STATUS_MARKER_COLORS[p.status] || "hsl(var(--status-unknown))" }}
                          />
                          <span className="truncate">
                            {p.codigo_projeto} - {p.nome}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandGroup heading="Clientes">
                      {clientesAgrupados.map((c) => (
                        <CommandItem
                          key={c.id ?? "__sem_cliente__"}
                          value={`cliente ${c.nome}`}
                          onSelect={() => handleClienteSelect(c.id)}
                          className="gap-2"
                        >
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{c.nome}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                            {c.projetos.length}p
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

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
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : projetos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum projeto com localização geográfica encontrado.</p>
          <p className="text-xs mt-1">Projetos precisam ter endereço com coordenadas para aparecer no mapa.</p>
        </div>
      ) : (
        <>
          {semCoordenadas.length > 0 && (
            <div className="mb-3 rounded-md bg-muted/50 border text-xs overflow-hidden">
              <button
                type="button"
                onClick={() => setSemCoordenadasExpanded((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">{semCoordenadas.length}</span>{" "}
                  {semCoordenadas.length === 1 ? "projeto não aparece" : "projetos não aparecem"} no mapa por falta de
                  coordenadas geográficas.
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground/70">
                  {semCoordenadasExpanded ? "ocultar ▲" : "ver projetos ▼"}
                </span>
              </button>
              {semCoordenadasExpanded && (
                <div className="border-t divide-y divide-border/50">
                  {semCoordenadas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate(`/projetos/${p.id}`)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
                    >
                      <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                      <span className="font-mono text-muted-foreground/70">{p.codigo_projeto}</span>
                      <span className="truncate text-foreground">{p.nome}</span>
                      {p.cliente_nome && (
                        <span className="ml-auto shrink-0 text-muted-foreground/60">{p.cliente_nome}</span>
                      )}
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legenda clicável com contagem por status */}
          <div className="flex items-center gap-4 mb-3 flex-wrap">
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

          <div
            ref={wrapperRef}
            className="rounded-lg overflow-hidden border relative"
            style={{ height: isFullscreen ? "100dvh" : "calc(100vh - 260px)" }}
          >
            {/* Seletor de camada */}
            <div className="absolute bottom-8 left-3 z-[1000]">
              {tileMenuOpen && (
                <div className="mb-1 flex flex-col gap-1 bg-background/95 backdrop-blur-sm rounded-lg border shadow-md p-1">
                  {(Object.entries(TILE_LAYERS) as [TileLayerKey, (typeof TILE_LAYERS)[TileLayerKey]][]).map(
                    ([key, layer]) => {
                      const Icon = layer.icon;
                      const active = tileKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setTileKey(key);
                            setTileMenuOpen(false);
                          }}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          {layer.label}
                        </button>
                      );
                    }
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setTileMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-background/95 backdrop-blur-sm shadow-md text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                {(() => {
                  const Icon = TILE_LAYERS[tileKey].icon;
                  return <Icon className="h-3.5 w-3.5 shrink-0" />;
                })()}
                {TILE_LAYERS[tileKey].label}
                <Layers className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>

            {/* Botões de controle */}
            <div className="absolute bottom-8 right-3 z-[1000] flex flex-col gap-1">
              <button
                type="button"
                title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                onClick={handleFullscreen}
                className="flex items-center justify-center w-9 h-9 rounded-lg border bg-background/95 backdrop-blur-sm shadow-md text-foreground hover:bg-muted transition-colors"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
              <button
                type="button"
                title="Centralizar todos os projetos"
                onClick={handleFitBounds}
                className="flex items-center justify-center w-9 h-9 rounded-lg border bg-background/95 backdrop-blur-sm shadow-md text-foreground hover:bg-muted transition-colors"
              >
                <Crosshair className="h-4 w-4" />
              </button>
            </div>

            {filtrados.length === 0 && (
              <div className="absolute inset-0 z-[999] flex items-center justify-center pointer-events-none">
                <div className="bg-background/90 backdrop-blur-sm border rounded-lg px-5 py-4 text-center shadow-md">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                  <p className="text-sm font-medium">Nenhum projeto com este status</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Altere o filtro para ver projetos no mapa.</p>
                </div>
              </div>
            )}

            <MapContainer
              center={[-15.78, -47.93]}
              zoom={4}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <MapController mapRef={mapRef} />
              <TileLayer key={tileKey} attribution={TILE_LAYERS[tileKey].attribution} url={TILE_LAYERS[tileKey].url} />
              <FitBounds projetos={filtrados} />
              <FlyToProject projeto={selectedProjeto} onMarkerClick={handleMarkerClick} />
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
                    icon={getStatusIcon(projeto.status)}
                    eventHandlers={{ click: () => handleMarkerClick(projeto) }}
                  >
                    <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                      <span className="text-xs font-medium">
                        {projeto.codigo_projeto} — {projeto.nome}
                      </span>
                    </Tooltip>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>
        </>
      )}

      {/* Painel lateral de detalhes do projeto */}
      <Sheet open={!!sheetProjeto} onOpenChange={(open) => !open && setSheetProjeto(null)}>
        <SheetContent side="right" className="w-[340px] sm:w-[400px] overflow-y-auto">
          {sheetProjeto && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-3.5 h-3.5 rounded-full mt-1 shrink-0"
                    style={{
                      background: STATUS_MARKER_COLORS[sheetProjeto.status] || "hsl(var(--status-unknown))",
                    }}
                  />
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">{sheetProjeto.codigo_projeto}</p>
                    <SheetTitle className="text-base leading-snug mt-0.5">{sheetProjeto.nome}</SheetTitle>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className={PROJECT_STATUS_CONFIG[sheetProjeto.status]?.color || ""}>
                    {sheetProjeto.status}
                  </Badge>
                  {sheetProjeto.prioridade && (
                    <Badge variant="outline" className="text-xs">
                      {sheetProjeto.prioridade}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {sheetProjeto.cliente_nome && (
                    <div className="flex items-start gap-2.5">
                      <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Cliente</p>
                        <p className="text-sm">{sheetProjeto.cliente_nome}</p>
                      </div>
                    </div>
                  )}

                  {sheetProjeto.valor_contrato && (
                    <div className="flex items-start gap-2.5">
                      <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Valor do contrato</p>
                        <p className="text-sm font-medium">{formatCurrency(sheetProjeto.valor_contrato)}</p>
                      </div>
                    </div>
                  )}

                  {(sheetProjeto.data_inicio || sheetProjeto.data_previsao) && (
                    <div className="flex items-start gap-2.5">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Período</p>
                        <p className="text-sm">
                          {formatDate(sheetProjeto.data_inicio) ?? "—"}
                          {" → "}
                          {formatDate(sheetProjeto.data_previsao) ?? "—"}
                        </p>
                      </div>
                    </div>
                  )}

                  {sheetProjeto.area_m2 && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Área</p>
                        <p className="text-sm">{sheetProjeto.area_m2.toLocaleString("pt-BR")} m²</p>
                      </div>
                    </div>
                  )}

                  {sheetProjeto.localizacao && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Endereço</p>
                        <p className="text-sm text-muted-foreground">{sheetProjeto.localizacao}</p>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    navigate(`/projetos/${sheetProjeto.id}`);
                    setSheetProjeto(null);
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir Projeto
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageLayout>
  );
}
