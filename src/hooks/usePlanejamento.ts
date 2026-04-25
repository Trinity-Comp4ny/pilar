import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PessoaPlanejamento {
  id: string;
  nome: string;
  cargo: string | null;
  horas_semanais: number;
}

export interface AlocacaoRow {
  pessoa_id: string;
  projeto_id: string;
  disciplina: string;
  semana_inicio: string;
  horas_alocadas: number;
}

export interface TimesheetRow {
  pessoa_id: string;
  projeto_id: string;
  disciplina: string;
  data: string;
  horas: number;
  status: "pendente" | "aprovado" | "rejeitado";
}

export interface ProjetoRef {
  id: string;
  nome: string;
  codigo_projeto: string | null;
}

export interface CelulaBreakdown {
  projeto_id: string;
  projeto_nome: string;
  projeto_codigo: string | null;
  disciplina: string;
  planejado: number;
  realizado: number;
}

export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getWeekStartForDate(dateISO: string): string {
  const monday = getMonday(new Date(dateISO + "T00:00:00"));
  return formatDateISO(monday);
}

export const usePlanejamentoData = (weekStart: string, weekEnd: string) => {
  const pessoasQuery = useQuery({
    queryKey: ["planejamento-pessoas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome, cargo, horas_semanais")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data || []).map((p) => ({
        ...p,
        horas_semanais: p.horas_semanais || 40,
      })) as PessoaPlanejamento[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const alocacoesQuery = useQuery({
    queryKey: ["planejamento-alocacoes", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alocacoes")
        .select("pessoa_id, projeto_id, disciplina, semana_inicio, horas_alocadas")
        .gte("semana_inicio", weekStart)
        .lte("semana_inicio", weekEnd);
      if (error) throw error;
      return (data || []) as AlocacaoRow[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const timesheetsQuery = useQuery({
    queryKey: ["planejamento-timesheets", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timesheets")
        .select("pessoa_id, projeto_id, disciplina, data, horas, status")
        .gte("data", weekStart)
        .lte("data", weekEnd)
        .in("status", ["pendente", "aprovado"])
        .is("deleted_at", null);
      if (error) throw error;
      return (data || []) as TimesheetRow[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const projetoIds = new Set<string>([
    ...(alocacoesQuery.data || []).map((a) => a.projeto_id),
    ...(timesheetsQuery.data || []).map((t) => t.projeto_id),
  ]);

  const projetosQuery = useQuery({
    queryKey: ["planejamento-projetos", Array.from(projetoIds).sort()],
    queryFn: async () => {
      if (projetoIds.size === 0) return [] as ProjetoRef[];
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, codigo_projeto")
        .in("id", Array.from(projetoIds));
      if (error) throw error;
      return (data || []) as ProjetoRef[];
    },
    enabled: projetoIds.size > 0,
    staleTime: 1000 * 60 * 5,
  });

  return {
    pessoas: pessoasQuery.data || [],
    alocacoes: alocacoesQuery.data || [],
    timesheets: timesheetsQuery.data || [],
    projetos: projetosQuery.data || [],
    isLoading: pessoasQuery.isLoading || alocacoesQuery.isLoading || timesheetsQuery.isLoading,
  };
};

export function buildCelulas(
  alocacoes: AlocacaoRow[],
  timesheets: TimesheetRow[],
  projetos: ProjetoRef[]
): Map<string, CelulaBreakdown[]> {
  const projetoMap = new Map<string, ProjetoRef>(projetos.map((p) => [p.id, p]));
  const byCell = new Map<string, Map<string, CelulaBreakdown>>();

  const cellKey = (pessoaId: string, semana: string) => `${pessoaId}::${semana}`;
  const rowKey = (projetoId: string, disciplina: string) => `${projetoId}::${disciplina}`;

  const ensureRow = (cellMap: Map<string, CelulaBreakdown>, projetoId: string, disciplina: string) => {
    const k = rowKey(projetoId, disciplina);
    if (!cellMap.has(k)) {
      const proj = projetoMap.get(projetoId);
      cellMap.set(k, {
        projeto_id: projetoId,
        projeto_nome: proj?.nome ?? "Projeto removido",
        projeto_codigo: proj?.codigo_projeto ?? null,
        disciplina,
        planejado: 0,
        realizado: 0,
      });
    }
    return cellMap.get(k)!;
  };

  for (const a of alocacoes) {
    const cell = cellKey(a.pessoa_id, a.semana_inicio);
    if (!byCell.has(cell)) byCell.set(cell, new Map());
    const row = ensureRow(byCell.get(cell)!, a.projeto_id, a.disciplina);
    row.planejado += Number(a.horas_alocadas) || 0;
  }

  for (const t of timesheets) {
    const semana = getWeekStartForDate(t.data);
    const cell = cellKey(t.pessoa_id, semana);
    if (!byCell.has(cell)) byCell.set(cell, new Map());
    const row = ensureRow(byCell.get(cell)!, t.projeto_id, t.disciplina);
    row.realizado += Number(t.horas) || 0;
  }

  const result = new Map<string, CelulaBreakdown[]>();
  byCell.forEach((rows, key) => {
    result.set(
      key,
      Array.from(rows.values()).sort((a, b) => {
        if (a.projeto_nome === b.projeto_nome) return a.disciplina.localeCompare(b.disciplina);
        return a.projeto_nome.localeCompare(b.projeto_nome);
      })
    );
  });
  return result;
}

export function sumBreakdown(rows: CelulaBreakdown[], mode: "planejado" | "realizado"): number {
  return rows.reduce((acc, r) => acc + (mode === "planejado" ? r.planejado : r.realizado), 0);
}

export function utilizacaoClass(pct: number): string {
  if (pct === 0) return "bg-gray-50 text-gray-400 border border-gray-100";
  if (pct <= 60) return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  if (pct <= 90) return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  if (pct <= 100) return "bg-amber-100 text-amber-900 border border-amber-200";
  return "bg-red-100 text-red-900 border border-red-200 font-medium";
}
