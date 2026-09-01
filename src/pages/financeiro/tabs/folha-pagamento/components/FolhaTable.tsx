import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import type { FolhaItem } from "../types";

interface FolhaTableProps {
  data: FolhaItem[];
  loading: boolean;
  statusFolha: "preview" | "closed";
  // Delta do total a receber vs o mês anterior, por pessoa (undefined = sem folha
  // anterior para comparar). Só usado no preview.
  deltas?: Map<string, number>;
  onRowClick: (item: FolhaItem) => void;
  onStatusChange: (folhaId: string | undefined, newStatus: string) => void;
  onDownloadComprovante?: (item: FolhaItem) => void;
}

export function FolhaTable({
  data,
  loading,
  statusFolha,
  deltas,
  onRowClick,
  onStatusChange,
  onDownloadComprovante,
}: FolhaTableProps) {
  const formatCurrency = useMoneyMask();
  const isEdited = (item: FolhaItem, field: string) => item.edited_fields?.includes(field);
  const isPreview = statusFolha === "preview";

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Salário fixo</TableHead>
                  <TableHead className="text-center">Produtividade</TableHead>
                  <TableHead className="text-right">Variável (m²)</TableHead>
                  <TableHead className="text-right font-bold">Total a receber</TableHead>
                  {isPreview && <TableHead className="text-right">vs. mês anterior</TableHead>}
                  {!isPreview && <TableHead className="text-center">Status</TableHead>}
                  {!isPreview && <TableHead className="w-[48px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum registro encontrado para este período.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((item, index) => {
                    const area = item.soma_area ?? 0;
                    const delta = deltas?.get(item.p_id);
                    const semProjeto = (item.detalhe_projetos?.length ?? 0) === 0;
                    const variavelZerado = item.v_variavel === 0;
                    return (
                      <TableRow
                        key={item.p_id || `${item.p_nome}-${index}`}
                        className={isPreview ? "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50" : ""}
                        onClick={() => isPreview && onRowClick(item)}
                        tabIndex={isPreview ? 0 : undefined}
                        role={isPreview ? "button" : undefined}
                        aria-label={isPreview ? `Ver detalhes de ${item.p_nome}` : undefined}
                        onKeyDown={(e) => {
                          if (isPreview && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            onRowClick(item);
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.p_nome}</span>
                            {isPreview && (semProjeto || variavelZerado) && (
                              <span
                                title={semProjeto ? "Sem projeto no período" : "Variável zerado"}
                                className="inline-flex items-center gap-1 text-[10px] text-warning-strong bg-warning-soft rounded px-1.5 py-0.5"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {semProjeto ? "sem projeto" : "variável 0"}
                              </span>
                            )}
                          </div>
                          {item.detalhe_projetos && item.detalhe_projetos.length > 0 && (
                            <div
                              className="text-xs text-muted-foreground truncate max-w-[220px]"
                              title={item.detalhe_projetos.map((p) => p.nome).join(", ")}
                            >
                              {item.detalhe_projetos.length} projeto(s): {item.detalhe_projetos[0].nome}
                              {item.detalhe_projetos.length > 1 && ` +${item.detalhe_projetos.length - 1}`}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{item.p_cargo}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.p_salario_fixo)} {isEdited(item, "salario") && "*"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-medium">
                              {area.toLocaleString("pt-BR")} m² {isEdited(item, "area") && "*"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              x {formatCurrency(item.p_valor_m2)}/m²
                            </span>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${isEdited(item, "variavel") ? "text-foreground" : "text-positive-strong"}`}
                        >
                          {isEdited(item, "variavel") ? "" : "+"} {formatCurrency(item.v_variavel)}{" "}
                          {isEdited(item, "variavel") && "*"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {formatCurrency(item.v_total)} {isEdited(item, "total") && "*"}
                        </TableCell>
                        {isPreview && (
                          <TableCell className="text-right">
                            {delta === undefined ? (
                              <span className="text-xs text-muted-foreground">-</span>
                            ) : delta === 0 ? (
                              <span className="text-xs text-muted-foreground">sem variação</span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-medium ${
                                  delta > 0 ? "text-positive-strong" : "text-destructive"
                                }`}
                              >
                                {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {delta > 0 ? "+" : ""}
                                {formatCurrency(delta)}
                              </span>
                            )}
                          </TableCell>
                        )}
                        {!isPreview && (
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-auto p-0 px-2 font-normal">
                                  <Badge
                                    variant="secondary"
                                    className={`capitalize cursor-pointer hover:bg-opacity-80 transition-colors px-2 py-0.5 text-xs
                                      ${item.status === "pago" ? "bg-positive text-ink" : ""}
                                      ${item.status === "pendente" ? "bg-warning-soft text-warning-strong" : ""}
                                      ${item.status === "cancelado" ? "bg-destructive text-destructive-foreground" : ""}
                                    `}
                                  >
                                    {item.status}
                                  </Badge>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onStatusChange(item.folha_id, "pendente")}>
                                  Marcar como pendente
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onStatusChange(item.folha_id, "pago")}>
                                  Marcar como pago
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onStatusChange(item.folha_id, "cancelado")}
                                  className="text-destructive"
                                >
                                  Cancelar pagamento
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                        {!isPreview && (
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title={`Baixar comprovante de ${item.p_nome}`}
                              aria-label={`Baixar comprovante de ${item.p_nome}`}
                              onClick={() => onDownloadComprovante?.(item)}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
