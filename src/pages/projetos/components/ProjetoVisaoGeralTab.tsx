import { useMemo, type ReactNode } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { usePermissions } from "@/hooks/usePermissions";
import { isDiscAtrasada, type DisciplinaResponsavel } from "@/types/projetos";
import { usePagamentosProjeto } from "../hooks/usePagamentosProjeto";
import { useProjetoTimeline } from "../hooks/useProjetoTimeline";
import { TIPO_LABEL } from "./ProjetoHistoricoTab";

interface ProjetoVisaoGeralTabProps {
  projetoId: string;
  disciplinas: DisciplinaResponsavel[];
  progresso: number;
  /** Indicadores do projeto (status, prioridade, prazo, contrato...). Só esta aba os mostra. */
  indicadores?: ReactNode;
}

const EIXO = { fontSize: 11, fill: "hsl(var(--text-muted))" };

type StatusCanonico = "Concluído" | "Em Andamento" | "Pausada" | "Pendente" | "Não Iniciado";

function statusCanonico(raw: string | null | undefined): StatusCanonico {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("conclu")) return "Concluído";
  if (s.includes("andamento")) return "Em Andamento";
  if (s.includes("pausad")) return "Pausada";
  if (s.includes("pendente")) return "Pendente";
  return "Não Iniciado";
}

const STATUS_COR: Record<StatusCanonico, string> = {
  Concluído: "hsl(var(--chart-success))",
  "Em Andamento": "hsl(var(--chart-info))",
  Pausada: "hsl(var(--status-review))",
  Pendente: "hsl(var(--chart-warning))",
  "Não Iniciado": "hsl(var(--chart-neutral))",
};

function CaixaTooltip({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs shadow-popover">{children}</div>;
}

function Legenda({ itens }: { itens: { nome: string; cor: string; valor: string }[] }) {
  return (
    <ul className="space-y-1.5 text-xs">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i.cor }} aria-hidden="true" />
          <span className="text-muted-foreground">{i.nome}</span>
          <span className="ml-auto font-medium tabular-nums text-foreground">{i.valor}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Painel do projeto: andamento das disciplinas, pagamentos e últimos eventos.
 * Os indicadores gerais do projeto moram aqui (e só aqui) desde 2026-11.
 */
export function ProjetoVisaoGeralTab({ projetoId, disciplinas, progresso, indicadores }: ProjetoVisaoGeralTabProps) {
  const { can, ready } = usePermissions();
  const veFinanceiro = ready && can("financeiro");
  const { data: pag } = usePagamentosProjeto(veFinanceiro ? projetoId : undefined);
  const { data: eventos = [] } = useProjetoTimeline(projetoId);

  const porStatus = useMemo(() => {
    const contagem = new Map<StatusCanonico, number>();
    for (const d of disciplinas) {
      const s = statusCanonico(d.status);
      contagem.set(s, (contagem.get(s) ?? 0) + 1);
    }
    return Array.from(contagem.entries()).map(([nome, valor]) => ({ nome, valor }));
  }, [disciplinas]);

  const atrasadas = useMemo(() => disciplinas.filter(isDiscAtrasada).length, [disciplinas]);

  const horas = useMemo(
    () =>
      disciplinas
        .filter((d) => (d.horas_estimadas ?? 0) > 0 || (d.horas_realizadas ?? 0) > 0)
        .map((d) => ({
          nome: d.disciplina,
          estimadas: d.horas_estimadas ?? 0,
          realizadas: d.horas_realizadas ?? 0,
        })),
    [disciplinas]
  );

  const resumo = pag?.resumo ?? null;
  const pagamentosChart = resumo
    ? [
        { nome: "Recebido", valor: resumo.totalRecebido, cor: "hsl(var(--chart-success))" },
        {
          nome: "Pendente",
          valor: Math.max(resumo.totalPendente - resumo.totalAtrasado, 0),
          cor: "hsl(var(--chart-warning))",
        },
        { nome: "Atrasado", valor: resumo.totalAtrasado, cor: "hsl(var(--chart-danger))" },
      ]
    : [];

  return (
    <div className="space-y-4">
      {indicadores}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Andamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold tabular-nums">{progresso}%</span>
                <span className="text-xs text-muted-foreground">
                  {disciplinas.filter((d) => statusCanonico(d.status) === "Concluído").length} de {disciplinas.length}{" "}
                  disciplinas concluídas
                </span>
              </div>
              <Progress value={progresso} className="h-2" />
            </div>
            {atrasadas > 0 && (
              <p className="text-xs font-medium text-negative-strong">
                {atrasadas} disciplina{atrasadas > 1 ? "s" : ""} atrasada{atrasadas > 1 ? "s" : ""}
              </p>
            )}
            {disciplinas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma disciplina cadastrada.</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-28 w-28 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={porStatus}
                        dataKey="valor"
                        nameKey="nome"
                        innerRadius={32}
                        outerRadius={52}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {porStatus.map((s) => (
                          <Cell key={s.nome} fill={STATUS_COR[s.nome]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.[0] ? (
                            <CaixaTooltip>
                              {payload[0].name}: {payload[0].value}
                            </CaixaTooltip>
                          ) : null
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1">
                  <Legenda itens={porStatus.map((s) => ({ nome: s.nome, cor: STATUS_COR[s.nome], valor: String(s.valor) }))} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Horas por disciplina</CardTitle>
          </CardHeader>
          <CardContent>
            {horas.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Sem horas lançadas. Defina horas previstas na aba Escopo.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(150, horas.length * 38)}>
                <BarChart data={horas} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="nome" tick={EIXO} axisLine={false} tickLine={false} width={92} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--chart-grid) / 0.4)" }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <CaixaTooltip>
                          <p className="mb-0.5 font-medium">{label}</p>
                          <p className="text-muted-foreground">Previstas: {payload[0]?.payload.estimadas} h</p>
                          <p className="text-foreground">Realizadas: {payload[0]?.payload.realizadas} h</p>
                        </CaixaTooltip>
                      ) : null
                    }
                  />
                  <Bar dataKey="estimadas" fill="hsl(var(--chart-neutral))" radius={[0, 4, 4, 0]} barSize={9} />
                  <Bar dataKey="realizadas" fill="hsl(var(--chart-info))" radius={[0, 4, 4, 0]} barSize={9} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {veFinanceiro && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {!resumo || resumo.totalFaturado === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Nenhum pagamento lançado ainda.</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-positive-strong">
                      {formatCurrency(resumo.totalRecebido)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      recebido ({resumo.percentualRecebido}% do contrato de {formatCurrency(resumo.totalContrato)})
                    </p>
                  </div>
                  <Progress value={resumo.percentualRecebido} className="h-2" />
                  <Legenda
                    itens={pagamentosChart.map((p) => ({ nome: p.nome, cor: p.cor, valor: formatCurrency(p.valor) }))}
                  />
                  {resumo.proximoVencimento && (
                    <p className="text-xs text-muted-foreground">
                      Próximo vencimento: <strong className="text-foreground">{formatDateShort(resumo.proximoVencimento)}</strong>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Últimos eventos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {eventos.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nenhum evento ainda"
              description="Início e conclusão de disciplinas, revisões e aprovações aparecem aqui."
            />
          ) : (
            <ul className="divide-y divide-border">
              {eventos.slice(0, 5).map((e, i) => (
                <li key={`${e.tipo}-${e.ocorridoEm}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  <span className="font-medium">{TIPO_LABEL[e.tipo] ?? e.tipo}</span>
                  {e.disciplinaNome && <span className="text-xs text-muted-foreground">{e.disciplinaNome}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{formatDateShort(e.ocorridoEm.slice(0, 10))}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
