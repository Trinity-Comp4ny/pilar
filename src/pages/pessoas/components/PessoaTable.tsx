import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowUpDown, User, Briefcase, GraduationCap, Crown, Trash2, Pencil, Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
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

  // Dedup de cargos por valor normalizado ('Arquiteto' e 'arquiteto ' viram um).
  const cargos = useMemo(() => {
    const porNormalizado = new Map<string, string>();
    for (const p of pessoas) {
      const raw = (p.cargo ?? "").trim();
      if (!raw) continue;
      const key = normalize(raw);
      if (!porNormalizado.has(key)) porNormalizado.set(key, raw);
    }
    return Array.from(porNormalizado.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pessoas]);

  const filteredAndSortedPessoas = useMemo(() => {
    const term = searchTerm.trim();
    const matchesCargoFilter = (pessoa: Pessoa) =>
      filterCargo === "todos" || normalize(pessoa.cargo ?? "") === normalize(filterCargo);

    const filtered = pessoas.filter((pessoa) => {
      if (!term) return matchesCargoFilter(pessoa);

      const cpfDigits = pessoa.cpf ? pessoa.cpf.replace(/\D/g, "") : "";
      const telDigits = pessoa.telefone ? pessoa.telefone.replace(/\D/g, "") : "";
      const termDigits = term.replace(/\D/g, "");

      const matchesText =
        fuzzyMatch(pessoa.nome, term) ||
        fuzzyMatch(pessoa.cargo ?? "", term) ||
        fuzzyMatch(pessoa.email ?? "", term) ||
        fuzzyMatch(pessoa.telefone ?? "", term) ||
        (!!termDigits && (cpfDigits.includes(termDigits) || telDigits.includes(termDigits)));

      return matchesText && matchesCargoFilter(pessoa);
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
            <CardDescription className="text-sm text-muted-foreground mt-1">
              {filteredAndSortedPessoas.length} de {pessoas.length} membro(s)
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por nome, cargo, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-9 rounded-full text-sm"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={filterCargo} onValueChange={setFilterCargo}>
                <SelectTrigger className="h-9 rounded-full text-sm">
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
        <div className="overflow-x-auto overflow-y-auto w-full max-h-[calc(100svh-260px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("nome")} className="-ml-3 h-8 font-medium text-xs">
                    Nome
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("tipo_contrato")}
                    className="-ml-3 h-8 font-medium text-xs"
                  >
                    Tipo
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("status")}
                    className="-ml-3 h-8 font-medium text-xs"
                  >
                    Status
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("cargo")}
                    className="-ml-3 h-8 font-medium text-xs"
                  >
                    Cargo
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="hidden md:table-cell">Telefone</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton rows={5} columns={isAdmin ? 7 : 6} />
              ) : filteredAndSortedPessoas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6}>
                    {pessoas.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        title="Nenhum membro cadastrado"
                        description="Adicione o primeiro membro da equipe."
                      />
                    ) : (
                      <EmptyState
                        icon={Users}
                        title="Nenhum resultado encontrado"
                        description="Tente ajustar a busca ou o filtro de cargo."
                      />
                    )}
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
                    <TableCell>{pessoa.cpf ? `***.***.***-${pessoa.cpf.replace(/\D/g, "").slice(-2)}` : "-"}</TableCell>
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
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteClick(pessoa.id);
                            }}
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
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
      </CardContent>
    </Card>
  );
}
