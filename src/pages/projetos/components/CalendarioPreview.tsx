import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronRight, Building2, Layers, HardHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function fmtKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtLabel(key: string): string {
  const today = fmtKey(new Date());
  if (key === today) return "Hoje";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
}

type EventoPreview = {
  id: string;
  nome: string;
  href: string;
  tipo: "projeto" | "disciplina" | "obra";
  atrasado: boolean;
  proximo: boolean;
};

async function fetchPrazos() {
  const today = fmtKey(new Date());
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Key = fmtKey(in30);

  const [projRes, discRes, obraRes] = await Promise.all([
    supabase
      .from("projetos")
      .select("id, nome, status, data_previsao")
      .is("deleted_at", null)
      .not("data_previsao", "is", null)
      .not("status", "in", '("Concluído","Cancelado")'),
    supabase
      .from("projeto_disciplinas")
      .select("id, nome, status, data_fim, projeto_id, projetos(nome)")
      .not("data_fim", "is", null)
      .not("status", "eq", "Concluído"),
    supabase
      .from("obras")
      .select("id, nome, status, data_fim_prevista")
      .is("deleted_at", null)
      .not("data_fim_prevista", "is", null)
      .not("status", "in", '("concluida","paralisada")'),
  ]);

  if (projRes.error) throw projRes.error;
  if (discRes.error) throw discRes.error;
  if (obraRes.error) throw obraRes.error;

  const eventos: { data: string; evento: EventoPreview }[] = [];
  const in7Key = fmtKey(
    (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d;
    })()
  );

  for (const p of projRes.data ?? []) {
    const data = p.data_previsao as string;
    const overdue = data < today;
    const upcoming = data >= today && data <= in30Key;
    if (!overdue && !upcoming) continue;
    eventos.push({
      data,
      evento: {
        id: p.id as string,
        nome: p.nome as string,
        href: `/projetos/${p.id as string}`,
        tipo: "projeto",
        atrasado: overdue,
        proximo: data >= today && data <= in7Key,
      },
    });
  }

  for (const d of discRes.data ?? []) {
    const data = d.data_fim as string;
    const overdue = data < today;
    const upcoming = data >= today && data <= in30Key;
    if (!overdue && !upcoming) continue;
    const proj = d.projetos as { nome: string } | null;
    eventos.push({
      data,
      evento: {
        id: d.id as string,
        nome: `${d.nome as string}${proj ? ` · ${proj.nome}` : ""}`,
        href: `/projetos/${d.projeto_id as string}`,
        tipo: "disciplina",
        atrasado: overdue,
        proximo: data >= today && data <= in7Key,
      },
    });
  }

  for (const o of obraRes.data ?? []) {
    const data = o.data_fim_prevista as string;
    const overdue = data < today;
    const upcoming = data >= today && data <= in30Key;
    if (!overdue && !upcoming) continue;
    eventos.push({
      data,
      evento: {
        id: o.id as string,
        nome: o.nome as string,
        href: `/obras/${o.id as string}`,
        tipo: "obra",
        atrasado: overdue,
        proximo: data >= today && data <= in7Key,
      },
    });
  }

  return eventos.sort((a, b) => a.data.localeCompare(b.data));
}

export function CalendarioPreview() {
  const navigate = useNavigate();

  const { data: raw = [] } = useQuery({
    queryKey: ["calendario-preview"],
    queryFn: fetchPrazos,
    staleTime: 1000 * 60 * 5,
  });

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, EventoPreview[]>();
    for (const { data, evento } of raw) {
      const arr = map.get(data) ?? [];
      arr.push(evento);
      map.set(data, arr);
    }
    return Array.from(map.entries());
  }, [raw]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <CalendarDays size={18} className="text-muted-foreground" />
            Calendário
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => navigate("/projetos/calendario")}
          >
            Ver calendário <ChevronRight size={14} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {eventosPorDia.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CalendarDays size={24} className="mb-2 opacity-40" />
            <p className="text-sm">Sem prazos nos próximos 30 dias</p>
          </div>
        ) : (
          <div className="space-y-4">
            {eventosPorDia.map(([key, eventos]) => (
              <div key={key}>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  {fmtLabel(key)}
                </div>
                <div className="space-y-1">
                  {eventos.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => navigate(e.href)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-left transition-colors group"
                    >
                      {e.tipo === "projeto" ? (
                        <Building2 size={13} className="text-muted-foreground flex-shrink-0" />
                      ) : e.tipo === "disciplina" ? (
                        <Layers size={13} className="text-muted-foreground flex-shrink-0" />
                      ) : (
                        <HardHat size={13} className="text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-sm flex-1 truncate">{e.nome}</span>
                      {e.atrasado && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-danger-soft text-danger-strong flex-shrink-0">
                          atraso
                        </span>
                      )}
                      {!e.atrasado && e.proximo && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-warning-soft text-warning-strong flex-shrink-0">
                          próximo
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
