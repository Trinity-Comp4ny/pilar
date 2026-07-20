import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Filter, TrendingUp, TrendingDown, DollarSign, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { FileBarChart } from "lucide-react";
import {
  aggregatePorCliente,
  toRentabilidadeProjeto,
  type RentabilidadeCliente,
  type RentabilidadeProjeto,
  type RpcRentabilidadeRaw,
} from "./rentabilidade";

type Modo = "projeto" | "cliente";

interface Props {
  modo: Modo;
}

const toCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(value) ? value : 0);

const toPct = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;

// Colunas por modo, na ordem canônica. O que se vê é o que se exporta.
const COLS_PROJETO = ["Código", "Projeto", "Cliente", "Status", "Contrato", "Receita", "Custo", "Margem", "Margem %"] as const;
const COLS_CLIENTE = ["Cliente", "Projetos", "Contrato", "Receita", "Custo", "Margem", "Margem %"] as const;

function useRentabilidadeData() {
  return useQuery({
    queryKey: ["relatorio-rentabilidade"],
    queryFn: async (): Promise<RentabilidadeProjeto[]> => {
      const { data, error } = await supabase.rpc("rpc_dashboard_rentabilidade");
      if (error) throw error;

      const rows = (Array.isArray(data) ? data : []) as unknown as RpcRentabilidadeRaw[];
      if (rows.length === 0) return [];

      // O RPC não devolve o cliente do projeto: buscamos o vínculo à parte.
      const ids = rows.map((r) => String(r.projeto_id ?? "")).filter(Boolean);
      const { data: projetos, error: projErr } = await supabase
        .from("projetos")
        .select("id, cliente_id, clientes (nome)")
        .in("id", ids)
        .is("deleted_at", null);
      if (projErr) throw projErr;

      const clientePorProjeto = new Map<string, { id: string | null; nome: string }>();
      for (const p of projetos ?? []) {
        clientePorProjeto.set(p.id, { id: p.cliente_id ?? null, nome: p.clientes?.nome ?? "Sem cliente" });
      }

      return rows
        .map((raw) =>
          toRentabilidadeProjeto(raw, clientePorProjeto.get(String(raw.projeto_id ?? "")) ?? { id: null, nome: "Sem cliente" })
        )
        .sort((a, b) => b.margem - a.margem);
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export default function RelatoriosRentabilidade({ modo }: Props) {
  const { data: projetos, isLoading, error } = useRentabilidadeData();
  const [filterCliente, setFilterCliente] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const projetosFiltrados = useMemo(() => {
    const base = projetos ?? [];
    return base.filter((p) => {
      if (filterCliente && p.cliente_nome !== filterCliente) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      return true;
    });
  }, [projetos, filterCliente, filterStatus]);

  const clientes = useMemo(() => aggregatePorCliente(projetosFiltrados), [projetosFiltrados]);

  const filterOptions = useMemo(() => {
    const base = projetos ?? [];
    return {
      clientes: Array.from(new Set(base.map((p) => p.cliente_nome).filter(Boolean))).sort(),
      status: Array.from(new Set(base.map((p) => p.status).filter((s) => s && s !== "-"))).sort(),
    };
  }, [projetos]);

  const totais = useMemo(() => {
    const src = modo === "projeto" ? projetosFiltrados : clientes;
    const receita = src.reduce((s, r) => s + r.receita, 0);
    const custo = src.reduce((s, r) => s + r.custo, 0);
    const margem = receita - custo;
    const margem_pct = receita > 0 ? (margem / receita) * 100 : 0;
    return { receita, custo, margem, margem_pct };
  }, [modo, projetosFiltrados, clientes]);

  const hasActiveFilters = !!(filterCliente || filterStatus);
  const clearFilters = () => {
    setFilterCliente("");
    setFilterStatus("");
  };

  // --- Export ---

  const buildRows = (): { headers: readonly string[]; rows: string[][] } => {
    if (modo === "cliente") {
      const rows = clientes.map((c) => [
        c.cliente_nome,
        String(c.num_projetos),
        toCurrency(c.valor_contrato),
        toCurrency(c.receita),
        toCurrency(c.custo),
        toCurrency(c.margem),
        toPct(c.margem_pct),
      ]);
      return { headers: COLS_CLIENTE, rows };
    }
    const rows = projetosFiltrados.map((p) => [
      p.codigo_projeto,
      p.projeto_nome,
      p.cliente_nome,
      p.status,
      toCurrency(p.valor_contrato),
      toCurrency(p.receita),
      toCurrency(p.custo),
      toCurrency(p.margem),
      toPct(p.margem_pct),
    ]);
    return { headers: COLS_PROJETO, rows };
  };

  const totalRow = (headers: readonly string[]): string[] =>
    headers.map((h, i) => {
      if (i === 0) return "TOTAL";
      if (h === "Receita") return toCurrency(totais.receita);
      if (h === "Custo") return toCurrency(totais.custo);
      if (h === "Margem") return toCurrency(totais.margem);
      if (h === "Margem %") return toPct(totais.margem_pct);
      return "";
    });

  const baseFilename = () => `relatorio-rentabilidade-${modo}-${format(new Date(), "yyyy-MM-dd")}`;

  const handleCSV = () => {
    const { headers, rows } = buildRows();
    if (rows.length === 0) {
      toast.error("Sem dados", { description: "Não há dados para exportar." });
      return;
    }
    const escape = (v: string) => {
      // Neutraliza formula injection: célula iniciada por = + - @ vira texto.
      const s = /^[=+\-@]/.test(v) ? `'${v}` : v;
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(","),
      ...rows.map((r) => r.map(escape).join(",")),
      totalRow(headers).map(escape).join(","),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseFilename()}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePDF = async () => {
    const { headers, rows } = buildRows();
    if (rows.length === 0) {
      toast.error("Sem dados", { description: "Não há dados para exportar." });
      return;
    }
    // jsPDF (+autotable) pesa >300kb: só baixa o chunk ao exportar de fato.
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF({ orientation: "landscape" });

    const titulo = modo === "projeto" ? "Rentabilidade por projeto" : "Rentabilidade por cliente";
    doc.setFontSize(16);
    doc.text(titulo, 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text("Margem = receitas lançadas (recebidas + pendentes) menos despesas diretas do projeto.", 14, 23);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 29);

    const body = [...rows, totalRow(headers)];
    autoTable(doc, {
      head: [headers as unknown as string[]],
      body,
      startY: 36,
      theme: "grid",
      headStyles: { fillColor: [249, 115, 22], textColor: 255, fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.row.index === body.length - 1) {
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.fillColor = [245, 245, 245];
        }
      },
    });
    doc.save(`${baseFilename()}.pdf`);
  };

  const handleExport = async (tipo: "csv" | "pdf") => {
    try {
      if (tipo === "csv") handleCSV();
      else await handlePDF();
      toast.success("Exportação iniciada", { description: "O download deve iniciar automaticamente." });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao exportar", { description: message });
    }
  };

  // --- Render ---

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={FileBarChart}
        title="Não foi possível carregar a rentabilidade"
        description={error instanceof Error ? error.message : "Tente gerar o relatório novamente."}
      />
    );
  }

  if (!projetos || projetos.length === 0) {
    return (
      <EmptyState
        icon={FileBarChart}
        title="Sem projetos para calcular rentabilidade"
        description="Cadastre projetos com receitas e despesas para ver a margem por projeto e por cliente."
      />
    );
  }

  const margemColor = (v: number) => (v >= 0 ? "text-positive-strong" : "text-negative-strong");

  return (
    <div className="flex flex-col gap-5">
      {/* Base de cálculo */}
      <p className="text-xs text-muted-foreground">
        Margem = receitas lançadas (recebidas + pendentes) menos despesas diretas do projeto. Contrato mostrado como
        referência. Valores acumulados por projeto, sem recorte de período.
      </p>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="rounded-lg bg-emerald-100 p-2">
            <TrendingUp size={18} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-emerald-600 font-medium">Receita</p>
            <p className="text-lg font-bold text-emerald-700 truncate">{toCurrency(totais.receita)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="rounded-lg bg-red-100 p-2">
            <TrendingDown size={18} className="text-red-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-red-600 font-medium">Custo</p>
            <p className="text-lg font-bold text-red-700 truncate">{toCurrency(totais.custo)}</p>
          </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3",
            totais.margem >= 0 ? "border-blue-200 bg-blue-50" : "border-orange-200 bg-orange-50"
          )}
        >
          <div className={cn("rounded-lg p-2", totais.margem >= 0 ? "bg-blue-100" : "bg-orange-100")}>
            <DollarSign size={18} className={totais.margem >= 0 ? "text-blue-600" : "text-orange-600"} />
          </div>
          <div className="min-w-0">
            <p className={cn("text-xs font-medium", totais.margem >= 0 ? "text-blue-600" : "text-orange-600")}>
              Margem ({toPct(totais.margem_pct)})
            </p>
            <p
              className={cn(
                "text-lg font-bold truncate",
                totais.margem >= 0 ? "text-blue-700" : "text-orange-700"
              )}
            >
              {toCurrency(totais.margem)}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros (só no modo projeto: o modo cliente é agregação) */}
      {modo === "projeto" && (
        <Card className="rounded-xl border border-black/5 bg-white shrink-0">
          <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-black/50 shrink-0">
              <Filter size={13} />
              Filtrar por:
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2 max-w-md">
              <Select value={filterCliente} onValueChange={setFilterCliente}>
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.clientes.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.status.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1 shrink-0">
                <X size={12} />
                Limpar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Header + export */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {modo === "projeto" ? "Projetos" : "Clientes"}
          </h3>
          <Badge variant="secondary" className="text-xs">
            {modo === "projeto" ? projetosFiltrados.length : clientes.length}
            {modo === "projeto" && hasActiveFilters ? ` de ${projetos.length}` : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleExport("csv")}>
            <Download size={13} />
            CSV
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 bg-brand text-ink hover:bg-brand/90"
            onClick={() => handleExport("pdf")}
          >
            <Download size={13} />
            PDF
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="w-full overflow-auto border rounded-xl bg-white" style={{ minHeight: "320px" }}>
        {modo === "projeto" ? (
          <ProjetoTable rows={projetosFiltrados} totais={totais} margemColor={margemColor} />
        ) : (
          <ClienteTable rows={clientes} totais={totais} margemColor={margemColor} />
        )}
      </div>
    </div>
  );
}

interface Totais {
  receita: number;
  custo: number;
  margem: number;
  margem_pct: number;
}

function ProjetoTable({
  rows,
  totais,
  margemColor,
}: {
  rows: RentabilidadeProjeto[];
  totais: Totais;
  margemColor: (v: number) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLS_PROJETO.map((c) => (
            <TableHead
              key={c}
              className={cn("whitespace-nowrap text-xs sticky top-0 z-10 bg-white", c !== "Código" && c !== "Projeto" && c !== "Cliente" && c !== "Status" && "text-right")}
            >
              {c}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={COLS_PROJETO.length} className="text-center py-10 text-muted-foreground text-sm">
              Nenhum projeto com os filtros aplicados.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((p) => (
            <TableRow key={p.projeto_id}>
              <TableCell className="whitespace-nowrap text-xs">{p.codigo_projeto}</TableCell>
              <TableCell className="whitespace-nowrap text-xs font-medium">{p.projeto_nome}</TableCell>
              <TableCell className="whitespace-nowrap text-xs">{p.cliente_nome}</TableCell>
              <TableCell className="whitespace-nowrap text-xs">{p.status}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-right tabular-nums">{toCurrency(p.valor_contrato)}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-right tabular-nums">{toCurrency(p.receita)}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-right tabular-nums">{toCurrency(p.custo)}</TableCell>
              <TableCell className={cn("whitespace-nowrap text-xs text-right tabular-nums font-medium", margemColor(p.margem))}>
                {toCurrency(p.margem)}
              </TableCell>
              <TableCell className={cn("whitespace-nowrap text-xs text-right tabular-nums font-medium", margemColor(p.margem))}>
                {toPct(p.margem_pct)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
      {rows.length > 0 && (
        <TableFooter>
          <TableRow className="bg-black/[0.02] font-semibold">
            <TableCell className="text-xs">TOTAL</TableCell>
            <TableCell className="text-xs" />
            <TableCell className="text-xs" />
            <TableCell className="text-xs" />
            <TableCell className="text-xs" />
            <TableCell className="text-xs text-right tabular-nums">{toCurrency(totais.receita)}</TableCell>
            <TableCell className="text-xs text-right tabular-nums">{toCurrency(totais.custo)}</TableCell>
            <TableCell className={cn("text-xs text-right tabular-nums", margemColor(totais.margem))}>
              {toCurrency(totais.margem)}
            </TableCell>
            <TableCell className={cn("text-xs text-right tabular-nums", margemColor(totais.margem))}>
              {toPct(totais.margem_pct)}
            </TableCell>
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}

function ClienteTable({
  rows,
  totais,
  margemColor,
}: {
  rows: RentabilidadeCliente[];
  totais: Totais;
  margemColor: (v: number) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLS_CLIENTE.map((c) => (
            <TableHead
              key={c}
              className={cn("whitespace-nowrap text-xs sticky top-0 z-10 bg-white", c !== "Cliente" && "text-right")}
            >
              {c}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={COLS_CLIENTE.length} className="text-center py-10 text-muted-foreground text-sm">
              Nenhum cliente encontrado.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((c) => (
            <TableRow key={c.cliente_id}>
              <TableCell className="whitespace-nowrap text-xs font-medium">{c.cliente_nome}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-right tabular-nums">{c.num_projetos}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-right tabular-nums">{toCurrency(c.valor_contrato)}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-right tabular-nums">{toCurrency(c.receita)}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-right tabular-nums">{toCurrency(c.custo)}</TableCell>
              <TableCell className={cn("whitespace-nowrap text-xs text-right tabular-nums font-medium", margemColor(c.margem))}>
                {toCurrency(c.margem)}
              </TableCell>
              <TableCell className={cn("whitespace-nowrap text-xs text-right tabular-nums font-medium", margemColor(c.margem))}>
                {toPct(c.margem_pct)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
      {rows.length > 0 && (
        <TableFooter>
          <TableRow className="bg-black/[0.02] font-semibold">
            <TableCell className="text-xs">TOTAL</TableCell>
            <TableCell className="text-xs" />
            <TableCell className="text-xs" />
            <TableCell className="text-xs text-right tabular-nums">{toCurrency(totais.receita)}</TableCell>
            <TableCell className="text-xs text-right tabular-nums">{toCurrency(totais.custo)}</TableCell>
            <TableCell className={cn("text-xs text-right tabular-nums", margemColor(totais.margem))}>
              {toCurrency(totais.margem)}
            </TableCell>
            <TableCell className={cn("text-xs text-right tabular-nums", margemColor(totais.margem))}>
              {toPct(totais.margem_pct)}
            </TableCell>
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
