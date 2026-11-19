import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Building2, Calendar, DollarSign, ExternalLink, MapPin } from "lucide-react";
import { PlacaSelect } from "@/components/placa/PlacaSelect";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import { STATUS_MARKER_COLORS, type ProjetoMapa } from "@/pages/mapa/constants";
import type { PlacaStatus } from "@/lib/placa";

function formatDate(d: string | null) {
  if (!d) return null;
  // Parse local (T00:00:00): sem isso, uma data-only em UTC-3 exibia o dia anterior.
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

interface Props {
  item: ProjetoMapa | null;
  onClose: () => void;
  onTrocarPlaca: (item: ProjetoMapa, status: PlacaStatus) => void;
  onAbrir: (item: ProjetoMapa) => void;
}

/** Painel lateral com os dados do projeto ou da obra clicado no mapa. */
export function MapaDetalheSheet({ item, onClose, onTrocarPlaca, onAbrir }: Props) {
  const moneyMask = useMoneyMask();
  const formatCurrency = (v: number | null) => (v ? moneyMask(v) : null);
  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[340px] sm:w-[400px] overflow-y-auto">
        {item && (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-3.5 h-3.5 rounded-full mt-1 shrink-0"
                  style={{
                    background: STATUS_MARKER_COLORS[item.status] || "hsl(var(--status-unknown))",
                  }}
                />
                <div>
                  <SheetTitle className="text-base leading-snug">{item.nome}</SheetTitle>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  {item.tipo === "obra" ? "Obra" : "Projeto"}
                </Badge>
                <Badge className={PROJECT_STATUS_CONFIG[item.status]?.color || ""}>{item.status}</Badge>
                {item.prioridade && (
                  <Badge variant="outline" className="text-xs">
                    {item.prioridade}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <p className="text-2xs text-muted-foreground uppercase tracking-wide">Placa</p>
                  <PlacaSelect value={item.placa_status} onChange={(status) => onTrocarPlaca(item, status)} />
                </div>

                {item.cliente_nome && (
                  <div className="flex items-start gap-2.5">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-2xs text-muted-foreground uppercase tracking-wide">Cliente</p>
                      <p className="text-sm">{item.cliente_nome}</p>
                    </div>
                  </div>
                )}

                {item.valor_contrato && (
                  <div className="flex items-start gap-2.5">
                    <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-2xs text-muted-foreground uppercase tracking-wide">Valor do contrato</p>
                      <p className="text-sm font-medium">{formatCurrency(item.valor_contrato)}</p>
                    </div>
                  </div>
                )}

                {(item.data_inicio || item.data_previsao) && (
                  <div className="flex items-start gap-2.5">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-2xs text-muted-foreground uppercase tracking-wide">Período</p>
                      <p className="text-sm">
                        {formatDate(item.data_inicio) ?? "—"}
                        {" → "}
                        {formatDate(item.data_previsao) ?? "—"}
                      </p>
                    </div>
                  </div>
                )}

                {item.area_m2 && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-2xs text-muted-foreground uppercase tracking-wide">Área</p>
                      <p className="text-sm">{item.area_m2.toLocaleString("pt-BR")} m²</p>
                    </div>
                  </div>
                )}

                {item.localizacao && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-2xs text-muted-foreground uppercase tracking-wide">Endereço</p>
                      <p className="text-sm text-muted-foreground">{item.localizacao}</p>
                    </div>
                  </div>
                )}
              </div>

              <Button
                className="w-full gap-2"
                onClick={() => {
                  onAbrir(item);
                }}
              >
                <ExternalLink className="h-4 w-4" />
                {item.tipo === "obra" ? "Abrir Obra" : "Abrir Projeto"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
