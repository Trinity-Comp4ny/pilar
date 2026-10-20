import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, GanttChartSquare, List } from "lucide-react";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { addDays, barPosition, generateColumns, parseDate } from "@/lib/cronograma";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResultadoEstimativa } from "@/schemas/estimativaObra";

type Fase = ResultadoEstimativa["fases"][number];
type Modo = "lista" | "gantt";

const MODOS: ViewOption<Modo>[] = [
  { value: "lista", label: "Lista", icon: List },
  { value: "gantt", label: "Gantt", icon: GanttChartSquare },
];

const LARGURA_MES_PX = 72;
const LARGURA_NOMES_PX = 220;

const contarServicos = (f: Fase) => f.etapas.reduce((s, e) => s + e.servicos.length, 0);

function useExpandido() {
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const alternar = (id: string) =>
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  return { abertos, alternar };
}

function Seta({ aberto }: { aberto: boolean }) {
  const Icone = aberto ? ChevronDown : ChevronRight;
  return <Icone className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />;
}

function Lista({ fases }: { fases: Fase[] }) {
  const { abertos, alternar } = useExpandido();
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {fases.map((f) => {
        const aberto = abertos.has(f.id);
        return (
          <li key={f.id}>
            <button
              type="button"
              aria-expanded={aberto}
              onClick={() => alternar(f.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Seta aberto={aberto} />
                <span className="font-medium text-ink">{f.nome}</span>
                <span className="hidden text-xs text-ink-soft sm:inline">
                  {f.etapas.length} {f.etapas.length === 1 ? "etapa" : "etapas"} · {contarServicos(f)} serviços
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-4 text-sm tabular-nums">
                <span className="hidden text-ink md:inline">{formatCurrency(f.valor, { decimals: 0 })}</span>
                <span className="text-ink-soft">
                  {formatDate(f.inicio)} a {formatDate(f.fim)}
                </span>
              </span>
            </button>
            {aberto && (
              <div className="space-y-3 border-t bg-muted/20 px-4 py-3 pl-10">
                {f.etapas.map((e) => (
                  <div key={e.nome}>
                    <p className="flex items-baseline justify-between gap-3 text-sm font-medium text-ink">
                      <span>{e.nome}</span>
                      <span className="text-xs font-normal tabular-nums text-ink-soft">
                        {formatDate(e.inicio)} a {formatDate(e.fim)}
                      </span>
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {e.servicos.map((s) => (
                        <li
                          key={s.nome}
                          className="flex items-baseline justify-between gap-3 pl-3 text-sm text-ink-soft"
                        >
                          <span>{s.nome}</span>
                          <span className="text-xs tabular-nums">
                            {formatDate(s.inicio)} a {formatDate(s.fim)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface LinhaGantt {
  chave: string;
  nome: string;
  nivel: 0 | 1 | 2;
  inicio: string;
  fim: string;
  /** Fase com filhos: mostra a seta e abre ao clicar. */
  expansivelId?: string;
}

function Gantt({ fases }: { fases: Fase[] }) {
  const { abertos, alternar } = useExpandido();
  const limites = useMemo(() => {
    const inicio = parseDate(fases[0].inicio);
    const fim = parseDate(fases.reduce((m, f) => (f.fim > m ? f.fim : m), fases[0].fim));
    return inicio && fim ? { inicio, fim: addDays(fim, 1) } : null;
  }, [fases]);

  const colunas = useMemo(() => (limites ? generateColumns(limites.inicio, limites.fim, "months") : []), [limites]);
  if (!limites) return null;
  const larguraTotal = colunas.length * LARGURA_MES_PX;

  const linhas: LinhaGantt[] = fases.flatMap((f) => [
    { chave: f.id, nome: f.nome, nivel: 0 as const, inicio: f.inicio, fim: f.fim, expansivelId: f.id },
    ...(abertos.has(f.id)
      ? f.etapas.flatMap((e) => [
          { chave: `${f.id}/${e.nome}`, nome: e.nome, nivel: 1 as const, inicio: e.inicio, fim: e.fim },
          ...e.servicos.map((s) => ({
            chave: `${f.id}/${e.nome}/${s.nome}`,
            nome: s.nome,
            nivel: 2 as const,
            inicio: s.inicio,
            fim: s.fim,
          })),
        ])
      : []),
  ]);

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card" role="region" aria-label="Gantt da obra" tabIndex={0}>
      <div style={{ width: LARGURA_NOMES_PX + larguraTotal }}>
        <div className="flex border-b bg-muted/40 text-xs text-ink-soft">
          <div className="sticky left-0 z-10 shrink-0 bg-muted px-3 py-2" style={{ width: LARGURA_NOMES_PX }}>
            Fase, etapa e serviço
          </div>
          <div className="flex" style={{ width: larguraTotal }}>
            {colunas.map((c) => (
              <div key={c.label} className="border-l px-2 py-2 text-center" style={{ width: LARGURA_MES_PX }}>
                {c.label}
              </div>
            ))}
          </div>
        </div>
        {linhas.map((l) => {
          const ini = parseDate(l.inicio);
          const fim = parseDate(l.fim);
          const pos = ini && fim ? barPosition(ini, addDays(fim, 1), limites.inicio, limites.fim) : null;
          return (
            <div key={l.chave} className="flex border-b last:border-b-0">
              <div
                className="sticky left-0 z-10 flex shrink-0 items-center bg-card px-3 py-2 text-sm"
                style={{ width: LARGURA_NOMES_PX, paddingLeft: 12 + l.nivel * 16 }}
              >
                {l.expansivelId ? (
                  <button
                    type="button"
                    aria-expanded={abertos.has(l.expansivelId)}
                    aria-label={`${abertos.has(l.expansivelId) ? "Recolher" : "Expandir"} ${l.nome}`}
                    onClick={() => alternar(l.expansivelId!)}
                    className="flex min-w-0 items-center gap-1 text-left font-medium text-ink"
                  >
                    <Seta aberto={abertos.has(l.expansivelId)} />
                    <span className="truncate">{l.nome}</span>
                  </button>
                ) : (
                  <span className={cn("truncate", l.nivel === 2 ? "text-xs text-ink-soft" : "text-ink")}>{l.nome}</span>
                )}
              </div>
              <div className="relative h-9 border-l" style={{ width: larguraTotal }}>
                {pos && (
                  <span
                    role="img"
                    aria-label={`${l.nome}: ${formatDate(l.inicio)} a ${formatDate(l.fim)}`}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 rounded-md",
                      l.nivel === 0 && "h-4 bg-brand",
                      l.nivel === 1 && "h-3 bg-brand/60",
                      l.nivel === 2 && "h-2 bg-brand/35"
                    )}
                    style={{ left: `${pos.leftPct}%`, width: `${pos.widthPct}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Aba Cronograma: fase, etapa e serviço em lista ou Gantt, só de leitura. Vira o cronograma da obra ao criar a obra. */
export function CronogramaTab({ resultado: r }: { resultado: ResultadoEstimativa }) {
  const [modo, setModo] = useState<Modo>("lista");
  const servicos = r.fases.reduce((s, f) => s + contarServicos(f), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          <strong className="font-semibold text-ink">{r.meses} meses</strong> · {r.fases.length} fases · {servicos}{" "}
          serviços · de {formatDate(r.fases[0].inicio)} a {formatDate(r.fases[r.fases.length - 1].fim)}
        </p>
        <ViewSwitcher options={MODOS} value={modo} onChange={setModo} ariaLabel="Visão do cronograma" />
      </div>
      <p className="rounded-xl bg-info-soft px-3 py-2 text-sm text-info-strong">
        O prazo vem da produtividade de mão de obra do padrão {r.padrao} com <strong>{r.equipe} pessoas</strong> na
        obra. Mude a equipe nas premissas da aba Custo.
      </p>
      {modo === "lista" ? <Lista fases={r.fases} /> : <Gantt fases={r.fases} />}
    </div>
  );
}
