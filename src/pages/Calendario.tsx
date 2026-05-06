import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarioPrazosTab } from "@/pages/projetos/components/CalendarioPrazosTab";
import {
  type Projeto,
  type ProjetoDisciplinaDB,
  dbDisciplinaToLegacy,
  type DisciplinaResponsavel,
  getResponsaveisList,
} from "@/types/projetos";
import { PROJECT_PRIORITY, type ProjectPriority } from "@/constants";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function Calendario() {
  usePageTitle("Calendário");

  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [filtroProjeto, setFiltroProjeto] = useState<string>("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");

  const { data: projetos = [], isLoading } = useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select(
          `
          *,
          clientes (nome, email),
          projeto_disciplinas (
            id, nome, status, data_inicio, data_fim, data_fim_real,
            prioridade, justificativa_atraso, horas_estimadas, custo_hora,
            observacoes, created_at, updated_at, projeto_id,
            projeto_disciplina_responsaveis (
              pessoa_id,
              pessoas ( id, nome )
            )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((p) => {
        const proj = p as Record<string, unknown> & {
          clientes?: { nome: string; email: string };
          projeto_disciplinas?: Array<Record<string, unknown>>;
        };
        const rawDiscs = (proj.projeto_disciplinas || []) as Array<{
          id: string;
          projeto_id: string;
          nome: string;
          status: string;
          data_inicio: string | null;
          data_fim: string | null;
          data_fim_real: string | null;
          observacoes: string | null;
          prioridade: string | null;
          justificativa_atraso: string | null;
          horas_estimadas: number;
          custo_hora: number;
          created_at: string;
          updated_at: string;
          projeto_disciplina_responsaveis: Array<{
            pessoa_id: string;
            pessoas: { id: string; nome: string };
          }>;
        }>;

        const dbDiscs: ProjetoDisciplinaDB[] = rawDiscs.map((d) => ({
          id: d.id,
          projeto_id: d.projeto_id,
          nome: d.nome,
          status: d.status,
          data_inicio: d.data_inicio,
          data_fim: d.data_fim,
          data_fim_real: d.data_fim_real,
          observacoes: d.observacoes,
          prioridade: d.prioridade,
          justificativa_atraso: d.justificativa_atraso,
          horas_estimadas: d.horas_estimadas,
          custo_hora: d.custo_hora,
          created_at: d.created_at,
          updated_at: d.updated_at,
          responsaveis:
            d.projeto_disciplina_responsaveis?.map((r) => ({
              id: r.pessoas.id,
              nome: r.pessoas.nome,
            })) || [],
        }));

        return {
          id: proj.id as string,
          codigo_projeto: proj.codigo_projeto as string,
          nome: proj.nome as string,
          cliente_id: proj.cliente_id as string,
          cliente_nome: proj.clientes?.nome,
          cliente_email: proj.clientes?.email,
          localizacao: proj.localizacao as string | undefined,
          parcelas: proj.parcelas as string | undefined,
          area_m2: proj.area_m2 as number | undefined,
          data_inicio: proj.data_inicio as string,
          data_previsao: proj.data_previsao as string,
          data_final: proj.data_final as string | undefined,
          status: proj.status as Projeto["status"],
          prioridade: (proj.prioridade as ProjectPriority) || PROJECT_PRIORITY.MEDIA,
          valor_contrato: proj.valor_contrato as number,
          observacao: proj.observacao as string,
          disciplinas: dbDiscs.map(dbDisciplinaToLegacy),
        };
      }) as Projeto[];
    },
  });

  const responsaveisUnicos = useMemo(() => {
    const set = new Set<string>();
    for (const p of projetos) {
      for (const d of p.disciplinas as DisciplinaResponsavel[]) {
        for (const r of getResponsaveisList(d)) {
          if (r.responsavel_nome) set.add(r.responsavel_nome);
        }
      }
    }
    return Array.from(set).sort();
  }, [projetos]);

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goHoje = () => setCursor(startOfMonth(new Date()));

  return (
    <PageLayout
      header={
        <PageHeader title="Calendário" description="Prazos e entregas dos projetos">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={goPrev} aria-label="Mês anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[160px] text-center">
                {MESES[cursor.getMonth()]} {cursor.getFullYear()}
              </span>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={goNext} aria-label="Próximo mês">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="ml-1 h-9 text-sm rounded-full" onClick={goHoje}>
                Hoje
              </Button>
            </div>

            <Select value={filtroProjeto} onValueChange={setFiltroProjeto}>
              <SelectTrigger className="w-[200px] h-9 text-sm rounded-full">
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os projetos</SelectItem>
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo_projeto ? `${p.codigo_projeto} — ` : ""}
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
              <SelectTrigger className="w-[180px] h-9 text-sm rounded-full">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos responsáveis</SelectItem>
                {responsaveisUnicos.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PageHeader>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <CalendarioPrazosTab
          projetos={projetos}
          cursor={cursor}
          filtroProjeto={filtroProjeto}
          filtroResponsavel={filtroResponsavel}
        />
      )}
    </PageLayout>
  );
}
