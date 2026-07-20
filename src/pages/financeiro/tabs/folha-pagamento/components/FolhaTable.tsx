import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/utils";
import type { FolhaItem } from "../types";

interface FolhaTableProps {
  data: FolhaItem[];
  loading: boolean;
  statusFolha: "preview" | "closed";
  confirmedUsers: Set<string>;
  onCheckboxChange: (item: FolhaItem, checked: boolean) => void;
  onRowClick: (item: FolhaItem) => void;
  onStatusChange: (folhaId: string | undefined, newStatus: string) => void;
}

export function FolhaTable({
  data,
  loading,
  statusFolha,
  confirmedUsers,
  onCheckboxChange,
  onRowClick,
  onStatusChange,
}: FolhaTableProps) {
  const isEdited = (item: FolhaItem, field: string) => item.edited_fields?.includes(field);

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
                  {statusFolha === "preview" && <TableHead className="w-[80px] text-center">Confirmar</TableHead>}
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Salário Fixo</TableHead>
                  <TableHead className="text-center">Produtividade</TableHead>
                  <TableHead className="text-right">Variável (m²)</TableHead>
                  <TableHead className="text-right font-bold">Total a Receber</TableHead>
                  {statusFolha === "closed" && <TableHead className="text-center">Status</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={statusFolha === "preview" ? 8 : 7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Nenhum registro encontrado para este período.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((item, index) => {
                    const area = item.soma_area ?? 0;
                    const isConfirmed = confirmedUsers.has(item.p_id);
                    return (
                      <TableRow
                        key={item.p_id || `${item.p_nome}-${index}`}
                        className={statusFolha === "preview" ? "cursor-pointer hover:bg-gray-50" : ""}
                        onClick={() => statusFolha === "preview" && onRowClick(item)}
                      >
                        {statusFolha === "preview" && (
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isConfirmed}
                              onCheckedChange={(checked) => onCheckboxChange(item, checked as boolean)}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="font-medium">{item.p_nome}</div>
                          {item.lista_projetos && item.lista_projetos.length > 0 && (
                            <div
                              className="text-xs text-muted-foreground truncate max-w-[200px]"
                              title={item.lista_projetos.join(", ")}
                            >
                              {item.lista_projetos.length} projeto(s): {item.lista_projetos[0]}{" "}
                              {item.lista_projetos.length > 1 && `+${item.lista_projetos.length - 1}`}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{item.p_cargo}</TableCell>
                        <TableCell
                          className={`text-right ${isEdited(item, "salario") ? "text-foreground font-medium" : ""}`}
                        >
                          {formatCurrency(item.p_salario_fixo)} {isEdited(item, "salario") && "*"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center">
                            <span className={`font-medium ${isEdited(item, "area") ? "text-foreground" : ""}`}>
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
                        <TableCell
                          className={`text-right font-bold text-lg ${isEdited(item, "total") ? "text-foreground" : ""}`}
                        >
                          {formatCurrency(item.v_total)} {isEdited(item, "total") && "*"}
                        </TableCell>
                        {statusFolha === "closed" && (
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-auto p-0 px-2 font-normal">
                                  <Badge
                                    variant="secondary"
                                    className={`capitalize cursor-pointer hover:bg-opacity-80 transition-colors px-2 py-0.5 text-xs
                                      ${item.status === "pago" ? "bg-positive/100 text-white" : ""}
                                      ${item.status === "pendente" ? "bg-yellow-400 text-black" : ""}
                                      ${item.status === "cancelado" ? "bg-red-500 text-white" : ""}
                                    `}
                                  >
                                    {item.status}
                                  </Badge>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onStatusChange(item.folha_id, "pendente")}>
                                  Marcar como Pendente
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onStatusChange(item.folha_id, "pago")}>
                                  Marcar como Pago
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onStatusChange(item.folha_id, "cancelado")}
                                  className="text-red-600"
                                >
                                  Cancelar Pagamento
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
