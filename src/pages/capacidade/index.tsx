import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, LayoutGrid, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { AlocacaoVsReal } from "./components/AlocacaoVsReal";

interface PessoaCapacidade {
  id: string;
  nome: string;
  cargo: string | null;
  horas_semanais: number;
}

interface Alocacao {
  pessoa_id: string;
  semana_inicio: string;
  horas_alocadas: number;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getCellColor(pct: number): string {
  if (pct === 0) return "bg-gray-100 text-gray-400";
  if (pct <= 60) return "bg-green-100 text-green-800";
  if (pct <= 80) return "bg-green-200 text-green-900";
  if (pct <= 100) return "bg-yellow-200 text-yellow-900";
  return "bg-red-200 text-red-900 font-semibold";
}

const NUM_WEEKS = 12;

export default function Capacidade() {
  const [startMonday, setStartMonday] = useState(() => getMonday(new Date()));

  const weeks = useMemo(
    () => Array.from({ length: NUM_WEEKS }, (_, i) => formatDateISO(addDays(startMonday, i * 7))),
    [startMonday]
  );

  const { data: pessoas = [], isLoading: loadingPessoas } = useQuery({
    queryKey: ["pessoas-capacidade"],
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
      })) as PessoaCapacidade[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: alocacoes = [], isLoading: loadingAlocacoes } = useQuery({
    queryKey: ["alocacoes", weeks[0], weeks[weeks.length - 1]],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alocacoes")
        .select("pessoa_id, semana_inicio, horas_alocadas")
        .gte("semana_inicio", weeks[0])
        .lte("semana_inicio", weeks[weeks.length - 1]);
      if (error) throw error;
      return (data || []) as Alocacao[];
    },
    enabled: weeks.length > 0,
    staleTime: 1000 * 60 * 3,
  });

  // Agrupa alocações por pessoa + semana
  const alocMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of alocacoes) {
      const key = `${a.pessoa_id}-${a.semana_inicio}`;
      map.set(key, (map.get(key) || 0) + Number(a.horas_alocadas));
    }
    return map;
  }, [alocacoes]);

  const getHorasAlocadas = (pessoaId: string, semana: string): number => {
    return alocMap.get(`${pessoaId}-${semana}`) || 0;
  };

  const navegarSemanas = (dir: number) => {
    setStartMonday((prev) => addDays(prev, dir * 7 * 4));
  };

  const isLoading = loadingPessoas || loadingAlocacoes;

  // Métricas resumo
  const totalPessoas = pessoas.length;
  const sobrecarregados = pessoas.filter((p) => {
    const currentWeek = formatDateISO(getMonday(new Date()));
    const horas = getHorasAlocadas(p.id, currentWeek);
    return (horas / p.horas_semanais) * 100 > 100;
  }).length;
  const ociosos = pessoas.filter((p) => {
    const currentWeek = formatDateISO(getMonday(new Date()));
    return getHorasAlocadas(p.id, currentWeek) === 0;
  }).length;

  return (
    <PageLayout>
      <PageHeader title="Capacidade" description="Planejamento de capacidade da equipe" />

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Equipe</p>
            <p className="text-xl font-bold">{totalPessoas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              Sobrecarregados
            </p>
            <p className="text-xl font-bold text-red-600">{sobrecarregados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ociosos (semana atual)</p>
            <p className="text-xl font-bold text-gray-500">{ociosos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Navegação */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navegarSemanas(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {new Date(weeks[0] + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          {" — "}
          {new Date(weeks[weeks.length - 1] + "T00:00:00").toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
          })}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navegarSemanas(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setStartMonday(getMonday(new Date()))}>
          Hoje
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pessoas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma pessoa cadastrada.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[160px] sticky left-0 bg-white z-10">
                    Pessoa
                  </th>
                  {weeks.map((w) => {
                    const d = new Date(w + "T00:00:00");
                    return (
                      <th key={w} className="text-center py-2 px-1 font-medium text-muted-foreground w-[70px]">
                        <div>{d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pessoas.map((pessoa) => (
                  <tr key={pessoa.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 sticky left-0 bg-white z-10">
                      <div className="font-medium">{pessoa.nome}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {pessoa.cargo || "—"} · {pessoa.horas_semanais}h/sem
                      </div>
                    </td>
                    {weeks.map((w) => {
                      const horas = getHorasAlocadas(pessoa.id, w);
                      const pct = (horas / pessoa.horas_semanais) * 100;
                      return (
                        <td key={w} className="py-1 px-1 text-center">
                          <div className={`rounded px-1 py-1 text-[11px] ${getCellColor(pct)}`}>
                            {horas > 0 ? `${horas}h` : "—"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 border" /> 0%
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-200" /> &le;80%
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-200" /> 80-100%
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-200" /> &gt;100%
        </div>
      </div>

      {/* Planejado vs Real */}
      <div className="mt-6">
        <AlocacaoVsReal weekStart={weeks[0]} weekEnd={weeks[weeks.length - 1]} />
      </div>
    </PageLayout>
  );
}
