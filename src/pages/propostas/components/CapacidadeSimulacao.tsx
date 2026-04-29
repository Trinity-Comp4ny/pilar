import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CapacidadeSimulacaoProps {
  disciplinas: Array<{ disciplina: string; horas_estimadas: number }>;
  prazoEstimadoDias?: number;
}

export function CapacidadeSimulacao({ disciplinas, prazoEstimadoDias }: CapacidadeSimulacaoProps) {
  const semanas = prazoEstimadoDias ? Math.ceil(prazoEstimadoDias / 7) : 12;

  // Buscar pessoas e suas alocações atuais
  const { data: pessoas = [], isLoading: loadingPessoas } = useQuery({
    queryKey: ["pessoas-capacidade-sim"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome, cargo, horas_semanais")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar projetos_responsaveis para saber quem faz qual disciplina
  const { data: responsaveis = [], isLoading: loadingResp } = useQuery({
    queryKey: ["responsaveis-capacidade-sim"],
    queryFn: async () => {
      const res = await supabase.from("projetos_responsaveis" as never).select("pessoa_id, disciplina");
      if (res.error) throw res.error;
      return (res.data || []) as unknown as { pessoa_id: string; disciplina: string }[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar alocações futuras (próximas N semanas)
  const { data: alocacoes = [], isLoading: loadingAloc } = useQuery({
    queryKey: ["alocacoes-capacidade-sim", semanas],
    queryFn: async (): Promise<{ pessoa_id: string; horas_alocadas: number }[]> => [],
    // Módulo Capacidade dormente — tabela alocacoes removida
    staleTime: 1000 * 60 * 3,
  });

  // Calcular disponibilidade por disciplina
  const simulacao = useMemo(() => {
    if (!disciplinas.length || loadingPessoas || loadingResp || loadingAloc) return [];

    // Total de horas alocadas por pessoa nas próximas semanas
    const horasAlocadasMap = new Map<string, number>();
    for (const a of alocacoes) {
      horasAlocadasMap.set(a.pessoa_id, (horasAlocadasMap.get(a.pessoa_id) || 0) + Number(a.horas_alocadas));
    }

    // Disciplinas que cada pessoa pode fazer
    const pessoaDisciplinas = new Map<string, Set<string>>();
    for (const r of responsaveis) {
      if (!pessoaDisciplinas.has(r.pessoa_id)) pessoaDisciplinas.set(r.pessoa_id, new Set());
      pessoaDisciplinas.get(r.pessoa_id)!.add(r.disciplina);
    }

    return disciplinas.map((disc) => {
      const pessoasDisponiveis = pessoas
        .filter((p) => {
          const skills = pessoaDisciplinas.get(p.id);
          return skills?.has(disc.disciplina);
        })
        .map((p) => {
          const horasSemanais = Number(p.horas_semanais) || 40;
          const capacidadeTotal = horasSemanais * semanas;
          const alocado = horasAlocadasMap.get(p.id) || 0;
          const livre = Math.max(0, capacidadeTotal - alocado);
          const utilizacao = capacidadeTotal > 0 ? (alocado / capacidadeTotal) * 100 : 0;

          return {
            id: p.id,
            nome: p.nome,
            cargo: p.cargo,
            horas_livres: livre,
            utilizacao_pct: utilizacao,
            pode_absorver: livre >= disc.horas_estimadas,
          };
        })
        .sort((a, b) => b.horas_livres - a.horas_livres);

      const temCapacidade = pessoasDisponiveis.some((p) => p.pode_absorver);

      return {
        disciplina: disc.disciplina,
        horas_necessarias: disc.horas_estimadas,
        pessoas: pessoasDisponiveis,
        alerta: !temCapacidade && pessoasDisponiveis.length > 0,
        sem_pessoa: pessoasDisponiveis.length === 0,
      };
    });
  }, [disciplinas, pessoas, responsaveis, alocacoes, semanas, loadingPessoas, loadingResp, loadingAloc]);

  const isLoading = loadingPessoas || loadingResp || loadingAloc;
  const temAlertas = simulacao.some((s) => s.alerta || s.sem_pessoa);

  if (disciplinas.length === 0) return null;

  return (
    <Card className={temAlertas ? "border-amber-200" : "border-blue-200"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" /> Simulação de Capacidade
          {temAlertas && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Atenção
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Disponibilidade da equipe nas próximas {semanas} semanas</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : simulacao.length === 0 ? (
          <p className="text-xs text-muted-foreground">Adicione disciplinas para ver a simulação.</p>
        ) : (
          <div className="space-y-3">
            {simulacao.map((s) => (
              <div key={s.disciplina} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">{s.disciplina}</span>
                  <span className="text-xs text-muted-foreground">{s.horas_necessarias}h necessárias</span>
                </div>

                {s.sem_pessoa ? (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                    Nenhuma pessoa atribuída a esta disciplina em projetos ativos
                  </p>
                ) : (
                  <div className="space-y-1">
                    {s.pessoas.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className={p.pode_absorver ? "text-emerald-700" : "text-muted-foreground"}>
                          {p.nome} {p.cargo ? `(${p.cargo})` : ""}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{p.horas_livres.toFixed(0)}h livres</span>
                          <Badge
                            variant={p.pode_absorver ? "default" : "secondary"}
                            className={`text-[9px] ${p.pode_absorver ? "bg-emerald-100 text-emerald-800" : p.utilizacao_pct > 90 ? "bg-red-100 text-red-800" : ""}`}
                          >
                            {p.utilizacao_pct.toFixed(0)}% utilizado
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {s.alerta && (
                      <p className="text-xs text-red-600 mt-1">
                        Nenhuma pessoa tem capacidade suficiente para absorver {s.horas_necessarias}h
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
