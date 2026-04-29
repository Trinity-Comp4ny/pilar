import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PortalShell } from "./PortalShell";
import type { PortalData } from "./usePortalData";

interface PortalResponsavel {
  data_inicio?: string;
  data_previsao?: string;
  data_final?: string;
}

interface PortalDisciplina {
  disciplina?: string;
  status?: string;
  data_inicio?: string;
  data_previsao?: string;
  data_final?: string;
  responsaveis?: PortalResponsavel[];
}

type PortalEntregaRow = Record<string, unknown>;

function getPortalDisciplinaDates(d: PortalDisciplina) {
  const r = d.responsaveis?.[0];
  return {
    inicio: d.data_inicio || r?.data_inicio || "",
    previsao: d.data_previsao || r?.data_previsao || "",
    final: d.data_final || r?.data_final || "",
  };
}

export default function PortalLayout() {
  usePageTitle("Portal do Cliente");
  return <PortalShell>{(data) => <PortalDashboard data={data} />}</PortalShell>;
}

function formatPortalDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

function PortalDashboard({ data }: { data: PortalData }) {
  const [disciplinas, setDisciplinas] = useState<PortalDisciplina[]>([]);
  const [dataInicio, setDataInicio] = useState<string | null>(null);
  const [dataPrevisao, setDataPrevisao] = useState<string | null>(null);
  const [entregas, setEntregas] = useState<PortalEntregaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: proj } = await supabase
        .from("projetos")
        .select("data_inicio, data_previsao, valor_contrato")
        .eq("id", data.projeto_id)
        .single();

      if (proj) {
        setDataInicio(proj.data_inicio);
        setDataPrevisao(proj.data_previsao);
      }

      const { data: discData } = await supabase
        .from("projeto_disciplinas")
        .select(
          `
          nome, status, data_inicio, data_fim, data_fim_real,
          projeto_disciplina_responsaveis (
            pessoas ( nome )
          )
        `
        )
        .eq("projeto_id", data.projeto_id)
        .order("created_at");

      if (discData) {
        setDisciplinas(
          discData.map((d: Record<string, unknown>) => {
            const resps = (d.projeto_disciplina_responsaveis as Array<{ pessoas: { nome: string } }>) || [];
            return {
              disciplina: d.nome as string,
              status: d.status as string | undefined,
              data_inicio: d.data_inicio as string | undefined,
              data_previsao: d.data_fim as string | undefined,
              data_final: d.data_fim_real as string | undefined,
              responsavel_nome:
                resps
                  .map((r) => r.pessoas?.nome)
                  .filter(Boolean)
                  .join(", ") || undefined,
            } as PortalDisciplina;
          })
        );
      }

      const { data: entregasData } = await supabase
        .from("portal_entregas")
        .select("*")
        .eq("projeto_id", data.projeto_id)
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(5);

      if (entregasData) setEntregas(entregasData as PortalEntregaRow[]);
      setLoading(false);
    };
    fetchData();
  }, [data.projeto_id]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const total = disciplinas.length;
  const concluidas = disciplinas.filter((d) => d.status === "Concluído").length;
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Início do Projeto</p>
            <p className="text-sm font-semibold mt-1">{formatPortalDate(dataInicio)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Previsão de Conclusão</p>
            <p className="text-sm font-semibold mt-1">{formatPortalDate(dataPrevisao)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-3">Progresso do Projeto</h3>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div className="bg-primary h-3 rounded-full transition-all" style={{ width: `${progresso}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {progresso}% concluído — {concluidas} de {total} disciplinas
          </p>
        </CardContent>
      </Card>

      {total > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Disciplinas</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {disciplinas.map((d, i) => {
              const isConcluido = d.status === "Concluído";
              const isAndamento = d.status === "Em Andamento";
              const statusColor = isConcluido
                ? "bg-green-100 text-green-800"
                : isAndamento
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-600";
              const dotColor = isConcluido ? "bg-green-500" : isAndamento ? "bg-blue-500" : "bg-gray-300";
              const dates = getPortalDisciplinaDates(d);

              return (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                        <p className="text-sm font-medium">{d.disciplina}</p>
                      </div>
                      <Badge className={`text-[10px] ${statusColor}`}>{d.status || "Não iniciado"}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {dates.inicio && <span>Início: {formatPortalDate(dates.inicio)}</span>}
                      {dates.previsao && <span>Previsão: {formatPortalDate(dates.previsao)}</span>}
                      {dates.final && <span>Concluído: {formatPortalDate(dates.final)}</span>}
                      {!dates.inicio && !dates.previsao && !dates.final && (
                        <span className="italic">Datas não definidas</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {entregas.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-3">Entregas Pendentes</h3>
            <div className="space-y-2">
              {entregas.map((e) => (
                <div key={String(e.id ?? "")} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{String(e.titulo ?? "")}</p>
                    {e.descricao != null && String(e.descricao) !== "" && (
                      <p className="text-xs text-muted-foreground">{String(e.descricao)}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {String(e.tipo ?? "")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
