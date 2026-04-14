import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
//import { Badge } from "@/components/ui/badge";
//import { Loader2, MapPin } from "lucide-react";
//import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
//import L from "leaflet";
//import "leaflet/dist/leaflet.css";
//import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { PROJECT_STATUS, PROJECT_STATUS_CONFIG, type ProjectStatus } from "@/constants";

delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const STATUS_MARKER_COLORS: Record<string, string> = {
  Planejamento: "#eab308",
  "Em andamento": "#3b82f6",
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

export default function MapaObras() {
  const [statusFilter, setStatusFilter] = useState<string>("todos");

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

  const formatCurrency = (v: number | null) =>
    v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

  return (
    <PageLayout>
      <PageHeader title="Mapa de Obras" description="Visualize a localização dos seus projetos">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.values(PROJECT_STATUS).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum projeto com localização geográfica encontrado.</p>
          <p className="text-xs mt-1">
            Projetos precisam ter endereço com coordenadas para aparecer no mapa.
          </p>
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
            {filtrados.map((projeto) => (
              <Marker
                key={projeto.id}
                position={[projeto.latitude, projeto.longitude]}
                icon={createColoredIcon(STATUS_MARKER_COLORS[projeto.status] || "#6b7280")}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <p className="font-semibold text-sm">{projeto.codigo_projeto} - {projeto.nome}</p>
                    {projeto.cliente_nome && <p className="text-xs text-gray-600">{projeto.cliente_nome}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-[10px] ${PROJECT_STATUS_CONFIG[projeto.status]?.color || ""}`}>
                        {projeto.status}
                      </Badge>
                      <span className="text-xs">{formatCurrency(projeto.valor_contrato)}</span>
                    </div>
                    {projeto.localizacao && <p className="text-[11px] text-gray-500 mt-1">{projeto.localizacao}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {Object.entries(STATUS_MARKER_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            {status}
          </div>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">{filtrados.length} projeto(s) no mapa</span>
      </div>
    </PageLayout>
  );
}
