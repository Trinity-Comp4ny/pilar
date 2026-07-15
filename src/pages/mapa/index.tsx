import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Layers,
  Crosshair,
  Maximize,
  Minimize,
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
} from "lucide-react";

import type { Map as LeafletMap } from "leaflet";
import {
  STATUS_MARKER_COLORS,
  STATUS_SYMBOLS,
  TILE_LAYERS,
  temCoordenadaValida,
  type ProjetoMapa,
  type TileLayerKey,
} from "./constants";
import { EmptyState } from "@/components/EmptyState";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { PROJECT_STATUS, PROJECT_STATUS_CONFIG, type ProjectStatus } from "@/constants";
import { usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";

// Leaflet + react-leaflet + cluster + CSS vivem em MapCanvas, carregado sob
// demanda: só entram no bundle quando a página do Mapa monta, não no inicial.
const MapCanvas = lazy(() => import("./MapCanvas"));

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
  const mapRef = useRef<LeafletMap | null>(null);
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
      if (temCoordenadaValida(p.latitude, p.longitude)) {
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
    const bounds = filtrados.map((p) => [p.latitude, p.longitude] as [number, number]);
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
      const bounds = clienteProjetos.map((p) => [p.latitude, p.longitude] as [number, number]);
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
                <Button variant="outline" className="h-9 rounded-full text-sm gap-1.5">
                  <Search className="h-4 w-4" />
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
                      {filtrados.map((p) => (
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
              <SelectTrigger className="w-[180px] h-9 rounded-full text-sm">
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
        <EmptyState
          icon={MapPin}
          title="Nenhum projeto com localização geográfica encontrado"
          description="Projetos precisam ter endereço com coordenadas para aparecer no mapa."
        />
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
                <span className="text-left">
                  <span className="font-medium text-foreground">{semCoordenadas.length}</span>{" "}
                  {semCoordenadas.length === 1 ? "projeto não aparece" : "projetos não aparecem"} no mapa: o endereço
                  cadastrado ainda não tem latitude e longitude. Abra o projeto e salve o endereço para posicioná-lo.
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
                  aria-pressed={isActive}
                  title={isActive ? "Clique para limpar o filtro" : `Clique para filtrar por ${status}`}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md cursor-pointer border border-transparent transition-colors hover:bg-muted",
                    isActive
                      ? "text-foreground font-medium bg-muted border-border"
                      : statusFilter !== "todos"
                        ? "text-muted-foreground/40"
                        : "text-muted-foreground"
                  )}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-white transition-transform"
                    style={{
                      background: color,
                      fontSize: "9px",
                      lineHeight: 1,
                      transform: isActive ? "scale(1.2)" : "scale(1)",
                      boxShadow: isActive ? `0 0 0 2px ${color}40` : "none",
                    }}
                  >
                    {STATUS_SYMBOLS[status] ?? ""}
                  </span>
                  {status} ({count})
                </button>
              );
            })}
            <span className="text-xs text-muted-foreground ml-auto">{filtrados.length} projeto(s) no mapa</span>
          </div>

          <div
            ref={wrapperRef}
            className="rounded-lg overflow-hidden border relative bg-muted"
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

            <Suspense
              fallback={
                <div className="absolute inset-0 z-[500] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <MapCanvas
                filtrados={filtrados}
                tileKey={tileKey}
                selectedProjeto={selectedProjeto}
                mapRef={mapRef}
                onMarkerClick={handleMarkerClick}
              />
            </Suspense>
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
