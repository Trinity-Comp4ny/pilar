import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { CalendarRange } from "lucide-react";
import { estadoFrenteCronograma, type EstadoFrente } from "@/lib/obras";
import {
  addDays,
  barPosition,
  diffDays,
  endOfMonth,
  generateColumns,
  rotuloCurtoDoMes,
  parseDate,
  startOfMonth,
  todayPosition,
  textoSobreBarra,
} from "@/lib/cronograma";
import type { ClienteObraFrente } from "@/pages/cliente/useClienteObraData";

export const ESTADO_FRENTE: Record<EstadoFrente, { label: string; bar: string; badge: string }> = {
  concluida: { label: "Concluída", bar: "bg-positive", badge: "bg-positive/10 text-positive-strong" },
  em_andamento: { label: "Em andamento", bar: "bg-status-progress", badge: "bg-info-soft text-info-strong" },
  atrasada: { label: "Atrasada", bar: "bg-status-cancelled", badge: "bg-danger-soft text-danger-strong" },
  futura: { label: "Próxima", bar: "bg-status-unknown", badge: "bg-muted text-ink-muted" },
  sem_prazo: { label: "Sem prazo", bar: "bg-status-unknown", badge: "bg-muted text-ink-muted" },
};

const LEGENDA: EstadoFrente[] = ["concluida", "em_andamento", "futura", "atrasada"];

type FrenteComEstado = ClienteObraFrente & { estado: EstadoFrente };

function comEstado(frentes: ClienteObraFrente[]): FrenteComEstado[] {
  return [...frentes]
    .sort((a, b) => a.ordem - b.ordem)
    .map((f) => ({ ...f, estado: estadoFrenteCronograma(f, f.tarefas) }));
}

function periodo(f: ClienteObraFrente) {
  if (f.data_inicio && f.data_fim) return `${formatDate(f.data_inicio)} a ${formatDate(f.data_fim)}`;
  return "Prazo a definir";
}

/** Faixa de resumo (concluídas, em andamento, próximas) usada na visão geral da obra. */
export function ResumoFrentes({ frentes }: { frentes: ClienteObraFrente[] }) {
  const lista = comEstado(frentes);
  const total = lista.length;
  const conta = (e: EstadoFrente) => lista.filter((f) => f.estado === e).length;
  const concluidas = conta("concluida");
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  const emCurso = lista.filter((f) => f.estado === "em_andamento" || f.estado === "atrasada");
  const proximas = lista.filter((f) => f.estado === "futura").slice(0, 3);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Andamento da obra</h3>
            <span className="text-2xl font-bold text-ink">{pct}%</span>
          </div>
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Andamento da obra"
          >
            <div className="h-3 rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {concluidas} de {total} {total === 1 ? "etapa concluída" : "etapas concluídas"}
          </p>
        </CardContent>
      </Card>

      {(emCurso.length > 0 || proximas.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ListaEtapas titulo="Em andamento agora" vazio="Nenhuma etapa em curso." frentes={emCurso} />
          <ListaEtapas titulo="Próximas etapas" vazio="Nenhuma etapa por vir." frentes={proximas} />
        </div>
      )}
    </div>
  );
}

function ListaEtapas({ titulo, vazio, frentes }: { titulo: string; vazio: string; frentes: FrenteComEstado[] }) {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="mb-3 text-sm font-semibold">{titulo}</h3>
        {frentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vazio}</p>
        ) : (
          <ul className="space-y-3">
            {frentes.map((f) => (
              <li key={f.id} className="flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${ESTADO_FRENTE[f.estado].bar}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{f.nome}</p>
                  <p className="text-xs text-muted-foreground">{periodo(f)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Aba Cronograma da obra: lista das etapas com período e estado, e o Gantt para ver o que vem a seguir. */
export function CronogramaObraContent({ frentes }: { frentes: ClienteObraFrente[] }) {
  const lista = comEstado(frentes);

  if (lista.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Cronograma ainda não cadastrado"
        description="Assim que o escritório montar as etapas da obra, elas aparecem aqui."
      />
    );
  }

  return (
    <div className="space-y-4">
      <GanttObra frentes={lista} />

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Etapas</h3>
          <ul className="divide-y">
            {lista.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ESTADO_FRENTE[f.estado].bar}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.nome}</p>
                    <p className="text-xs text-muted-foreground">{periodo(f)}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${ESTADO_FRENTE[f.estado].badge}`}
                >
                  {ESTADO_FRENTE[f.estado].label}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function GanttObra({ frentes }: { frentes: FrenteComEstado[] }) {
  const comPrazo = frentes.filter((f) => parseDate(f.data_inicio) && parseDate(f.data_fim));
  if (comPrazo.length === 0) return null;

  const inicios = comPrazo.map((f) => parseDate(f.data_inicio)!.getTime());
  const fins = comPrazo.map((f) => parseDate(f.data_fim)!.getTime());
  const inicioLinha = startOfMonth(new Date(Math.min(...inicios)));
  const fimLinha = endOfMonth(new Date(Math.max(...fins)));
  const colunas = generateColumns(inicioLinha, fimLinha, "months");
  const hoje = todayPosition(inicioLinha, fimLinha);
  const largura = Math.max(480, colunas.length * 72);
  // diffDays/addDays garantem que a barra de 1 dia ainda apareça.
  const fimExclusivo = (iso: string) => addDays(parseDate(iso)!, 1);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Linha do tempo</h3>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {LEGENDA.map((e) => (
              <li key={e} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${ESTADO_FRENTE[e].bar}`} />
                {ESTADO_FRENTE[e].label}
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-x-auto">
          <div style={{ minWidth: largura + 140 }}>
            <div className="flex">
              <div className="w-[140px] shrink-0" />
              <div className="relative flex-1 border-b" style={{ minWidth: largura }}>
                <div className="flex">
                  {colunas.map((c) => (
                    <div
                      key={c.start.toISOString()}
                      className="border-l pb-1.5 text-center text-[11px] text-muted-foreground"
                      style={{ flex: Math.max(1, diffDays(c.start, c.end) + 1) }}
                    >
                      {rotuloCurtoDoMes(c.start)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {frentes.map((f) => {
              const ini = parseDate(f.data_inicio);
              const fim = parseDate(f.data_fim);
              const pos =
                ini && fim ? barPosition(ini, fimExclusivo(f.data_fim!), inicioLinha, addDays(fimLinha, 1)) : null;
              const cor = ESTADO_FRENTE[f.estado];
              return (
                <div key={f.id} className="flex items-center border-b last:border-b-0">
                  <p className="w-[140px] shrink-0 truncate py-3 pr-3 text-sm font-medium" title={f.nome}>
                    {f.nome}
                  </p>
                  <div className="relative h-11 flex-1" style={{ minWidth: largura }}>
                    {colunas.map((c) => (
                      <div
                        key={c.start.toISOString()}
                        className="absolute inset-y-0 border-l"
                        style={{ left: `${barPosition(c.start, c.end, inicioLinha, addDays(fimLinha, 1)).leftPct}%` }}
                      />
                    ))}
                    {pos && (
                      <div
                        className={`absolute top-2.5 flex h-6 items-center overflow-hidden rounded-md px-2 text-[11px] font-medium ${cor.bar} ${textoSobreBarra(cor.bar)}`}
                        style={{ left: `${pos.leftPct}%`, width: `${pos.widthPct}%` }}
                        title={`${f.nome}: ${periodo(f)}`}
                      >
                        <span className="truncate">{pos.widthPct > 12 ? cor.label : ""}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {hoje >= 0 && (
              <div className="pointer-events-none relative h-0">
                <div
                  className="absolute bottom-0 w-px bg-ink/40"
                  style={{
                    left: `calc(140px + (100% - 140px) * ${hoje / 100})`,
                    height: `${frentes.length * 45}px`,
                  }}
                  aria-hidden
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
