import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ArrowUpDown,
  User,
  Briefcase,
  GraduationCap,
  Crown,
  Trash2,
  Pencil,
  Loader2,
  Users,
} from "lucide-react";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  CONTRACT_TYPE_COLORS,
  PESSOA_STATUS_LABELS,
  PESSOA_STATUS_COLORS,
  type ContractType,
  type PessoaStatus,
} from "@/constants";
import { cn } from "@/lib/utils";
import type { Pessoa } from "../types";

const TIPO_ICON: Record<string, typeof User> = {
  [CONTRACT_TYPES.CLT]: User,
  [CONTRACT_TYPES.PJ]: Briefcase,
  [CONTRACT_TYPES.ESTAGIARIO]: GraduationCap,
  [CONTRACT_TYPES.SOCIO]: Crown,
  [CONTRACT_TYPES.TERCEIRIZADO]: Briefcase,
};

interface PessoaTableProps {
  pessoas: Pessoa[];
  isLoading: boolean;
  isAdmin: boolean;
  onRowClick: (pessoa: Pessoa) => void;
  onEditClick: (pessoa: Pessoa, e?: React.MouseEvent) => void;
  onDeleteClick: (id: string) => void;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const fuzzyMatch = (text: string, query: string) => {
  const q = normalize(query);
  if (!q) return true;
  const t = normalize(text);
  let ti = 0;
  for (const qc of q) {
    ti = t.indexOf(qc, ti);
    if (ti === -1) return false;
    ti++;
  }
  return true;
};

export function PessoaTable({ pessoas, isLoading, isAdmin, onRowClick, onEditClick, onDeleteClick }: PessoaTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCargo, setFilterCargo] = useState("todos");
  const [sortField, setSortField] = useState<keyof Pessoa | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const cargos = useMemo(() => {
    return Array.from(new Set(pessoas.map((p) => p.cargo)));
  }, [pessoas]);

  const filteredAndSortedPessoas = useMemo(() => {
    const term = searchTerm.trim();
    const filtered = pessoas.filter((pessoa) => {
      if (!term) return filterCargo === "todos" || pessoa.cargo === filterCargo;

      const digits = pessoa.cpf ? pessoa.cpf.replace(/\D/g, "") : "";
      const termDigits = term.replace(/\D/g, "");

      const matchesText =
        fuzzyMatch(pessoa.nome, term) || fuzzyMatch(pessoa.cargo, term) || (termDigits && digits.includes(termDigits));

      const matchesCargo = filterCargo === "todos" || pessoa.cargo === filterCargo;
      return matchesText && matchesCargo;
    });

    if (sortField) {
      filtered.sort((a, b) => {
        const aValue = a[sortField] || "";
        const bValue = b[sortField] || "";
        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return filtered;
  }, [pessoas, searchTerm, filterCargo, sortField, sortDirection]);

  const handleSort = (field: keyof Pessoa) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <Card className="rounded-2xl border border-black/5 bg-white w-full flex flex-col min-h-0">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-lg font-medium tracking-tight">Equipe</CardTitle>
            <CardDescription className="text-sm text-black/60 mt-1">
              {filteredAndSortedPessoas.length} de {pessoas.length} membro(s)
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
              <Input
                placeholder="Buscar por nome ou cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={filterCargo} onValueChange={setFilterCargo}>
                <SelectTrigger className="bg-gray-50 border-gray-200">
                  <SelectValue placeholder="Cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Cargos</SelectItem>
                  {cargos.map((cargo) => (
                    <SelectItem key={cargo} value={cargo}>
                      {cargo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto w-full max-h-[calc(100svh-260px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("nome")}
                      className="-ml-3 h-8 font-medium"
                    >
                      Nome
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedPessoas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6}>
                      <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <Users className="h-8 w-8 text-muted-foreground/40" />
                        {pessoas.length === 0 ? (
                          <>
                            <p className="text-sm font-medium text-muted-foreground">Nenhum membro cadastrado</p>
                            <p className="text-xs text-muted-foreground/70">Adicione o primeiro membro da equipe</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-muted-foreground">Nenhum resultado encontrado</p>
                            <p className="text-xs text-muted-foreground/70">
                              Tente ajustar a busca ou o filtro de cargo
                            </p>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedPessoas.map((pessoa) => (
                    <TableRow
                      key={pessoa.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => onRowClick(pessoa)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="bg-gray-100 p-1.5 rounded-full">
                            {(() => {
                              const Icon = TIPO_ICON[pessoa.tipo_contrato] || User;
                              return <Icon size={14} />;
                            })()}
                          </div>
                          {pessoa.nome}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border",
                            CONTRACT_TYPE_COLORS[pessoa.tipo_contrato as ContractType] ||
                              "bg-gray-100 text-gray-700 border-gray-200"
                          )}
                        >
                          {CONTRACT_TYPE_LABELS[pessoa.tipo_contrato as ContractType] || pessoa.tipo_contrato}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("border", PESSOA_STATUS_COLORS[(pessoa.status || "ativo") as PessoaStatus])}
                        >
                          {PESSOA_STATUS_LABELS[(pessoa.status || "ativo") as PessoaStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>{pessoa.cpf || "-"}</TableCell>
                      <TableCell>{pessoa.cargo}</TableCell>
                      <TableCell className="hidden md:table-cell">{pessoa.telefone || "-"}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => onEditClick(pessoa, e)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteClick(pessoa.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
