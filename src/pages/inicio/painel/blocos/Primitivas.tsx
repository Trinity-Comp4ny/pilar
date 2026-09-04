import { cn } from "@/lib/utils";

/**
 * Primitivas de leitura do painel de gestão (SPEC 092).
 *
 * Barra, divergente, semáforo e lista não são gráfico: são componente de UI com
 * largura proporcional. Ficam em HTML/CSS, com token semântico. Os três gráficos
 * temporais do painel usam recharts (a lib já instalada), em PainelCharts.tsx.
 */

type Tone = "main" | "neutral" | "estado";

/**
 * Cor de barra nesta tela: azul é a série, cinza é o resto. `estado` existe
 * só para a barra que representa algo ruim por definição (perda, atraso), e é
 * o único desvio. Não há paleta de 5 cores em gráfico: isso era o que deixava
 * a tela com ar de não padronizada.
 */
const FILL: Record<Tone, string> = {
  main: "bg-chart-info",
  neutral: "bg-chart-neutral",
  estado: "bg-negative",
};

export type BarraItem = {
  id: string;
  nome: string;
  valor: number;
  /** Texto grande à direita. Default: o próprio valor. */
  rotulo?: string;
  /** Segunda linha do rótulo, menor e em cinza. */
  detalhe?: string;
  tone?: Tone;
  titulo?: string;
};

/** Barras horizontais: nome, trilha proporcional, valor. */
export function BarrasHorizontais({ itens, tone = "main" }: { itens: BarraItem[]; tone?: Tone }) {
  const max = Math.max(...itens.map((i) => i.valor), 0);

  return (
    <div className="flex flex-1 flex-col justify-evenly gap-2.5">
      {itens.map((item) => {
        const largura = max > 0 ? Math.max(2, (item.valor / max) * 100) : 2;
        return (
          <div
            key={item.id}
            title={item.titulo}
            className="grid grid-cols-[minmax(88px,30%)_1fr_auto] items-center gap-2.5"
          >
            <span className="break-words text-[12.5px] text-ink-soft">{item.nome}</span>
            <span className="block h-3 min-w-0 rounded bg-black/5">
              <span
                className={cn("block h-full rounded-r", FILL[item.tone ?? tone])}
                style={{ width: `${largura.toFixed(1)}%` }}
              />
            </span>
            <span className="min-w-[42px] text-right text-[13px] font-semibold leading-tight tabular-nums">
              {item.rotulo ?? item.valor}
              {item.detalhe && (
                <small className="block text-[11px] font-normal text-muted-foreground">{item.detalhe}</small>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type DivergenteItem = {
  id: string;
  nome: string;
  /** Positivo vai para a direita (ruim: acima do estimado). */
  pct: number;
  titulo?: string;
};

/**
 * Barras divergentes ancoradas no zero. A posição carrega o sinal, não só a cor:
 * verde/vermelho sozinhos não separam para quem tem deuteranopia.
 */
export function BarrasDivergentes({ itens }: { itens: DivergenteItem[] }) {
  const max = Math.max(...itens.map((i) => Math.abs(i.pct)), 1);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[minmax(120px,38%)_1fr] gap-2.5 text-[10.5px] uppercase tracking-wide text-muted-foreground">
        <span />
        <span className="flex justify-between">
          <span>abaixo do estimado</span>
          <span>acima</span>
        </span>
      </div>
      {itens.map((item) => {
        const metade = (Math.abs(item.pct) / max) * 46;
        const acima = item.pct >= 0;
        return (
          <div
            key={item.id}
            title={item.titulo}
            className="grid grid-cols-[minmax(120px,38%)_1fr] items-center gap-2.5"
          >
            <span className="break-words text-[12.5px] text-ink-soft">{item.nome}</span>
            <span className="relative block h-[18px] min-w-0">
              <span className="absolute inset-y-0 left-1/2 w-px bg-black/15" />
              <span
                className={cn(
                  "absolute top-[3px] h-3",
                  acima ? "left-1/2 rounded-r bg-negative" : "right-1/2 rounded-l bg-positive"
                )}
                style={{ width: `${metade.toFixed(1)}%` }}
              />
              <span
                className="absolute top-0 flex h-[18px] items-center text-[11.5px] font-semibold tabular-nums text-ink-soft"
                style={
                  acima
                    ? { left: `calc(50% + ${(metade + 1.5).toFixed(1)}%)` }
                    : { right: `calc(50% + ${(metade + 1.5).toFixed(1)}%)` }
                }
              >
                {acima ? "+" : ""}
                {item.pct}%
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Barra empilhada por linha: em dia contra atrasada, por pessoa. */
export function CargaPorPessoa({
  itens,
}: {
  itens: { pessoaId: string; nome: string; emDia: number; atrasada: number }[];
}) {
  const max = Math.max(...itens.map((p) => p.emDia + p.atrasada), 1);

  return (
    <div className="flex flex-col gap-2">
      {itens.map((p) => (
        <div
          key={p.pessoaId}
          title={`${p.emDia} em dia, ${p.atrasada} atrasada${p.atrasada === 1 ? "" : "s"}`}
          className="grid grid-cols-[minmax(84px,24%)_1fr_auto] items-center gap-2.5"
        >
          <span className="truncate text-[12.5px] text-ink-soft">{p.nome}</span>
          <span className="flex h-3.5 min-w-0 gap-0.5">
            <span className="block rounded bg-chart-info" style={{ width: `${((p.emDia / max) * 100).toFixed(1)}%` }} />
            {p.atrasada > 0 && (
              <span className="block rounded bg-negative" style={{ width: `${((p.atrasada / max) * 100).toFixed(1)}%` }} />
            )}
          </span>
          <span className="text-[12.5px] tabular-nums text-muted-foreground">
            <b className="font-semibold text-ink">{p.emDia + p.atrasada}</b>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Legenda: quadrado para série de área/barra, traço para série de linha. */
export function LegendaPainel({ itens }: { itens: { label: string; cls: string; linha?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
      {itens.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
          <span className={cn(i.linha ? "h-[3px] w-3.5 rounded-sm" : "h-2.5 w-2.5 rounded-[3px]", i.cls)} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
