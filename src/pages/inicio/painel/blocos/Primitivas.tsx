import { cn } from "@/lib/utils";

/**
 * Primitivas de leitura do painel (SPEC 092).
 *
 * Barra, divergente e empilhada não são gráfico: são componente de UI com
 * largura proporcional, em HTML, com token semântico.
 *
 * Duas decisões que vieram de olhar a tela renderizada:
 *
 * 1. Valor e contexto ficam em COLUNAS separadas, não empilhados. Antes, "7" e
 *    "29% ganho" iam um sobre o outro num espaço de 60px e viravam borrão; a
 *    grade dá uma coluna para cada, com cabeçalho quando há contexto.
 * 2. Cor de destaque é EXCEÇÃO, não regra. Cinco barras vermelhas não informam
 *    nada além de "tudo é urgente": a barra é azul, e o vermelho fica para o
 *    item que o widget marcar como fora do aceitável.
 */

type Tone = "main" | "neutral" | "estado";

const FILL: Record<Tone, string> = {
  main: "bg-chart-info",
  neutral: "bg-chart-neutral",
  estado: "bg-negative",
};

export type BarraItem = {
  id: string;
  nome: string;
  valor: number;
  /** Substitui o número cru na coluna de valor (ex.: "40%"). */
  rotulo?: string;
  /** Coluna de contexto, à direita do valor (ex.: "29% ganho", "4 de 10"). */
  detalhe?: string;
  /** Marca este item como fora do aceitável. Pinta só ele. */
  alerta?: boolean;
  titulo?: string;
};

export function BarrasHorizontais({
  itens,
  tone = "main",
  /** Cabeçalho da coluna de valor e da de contexto. */
  colunas,
  /** Unidade impressa embaixo do primeiro valor (ex.: "dias"). */
  unidade,
}: {
  itens: BarraItem[];
  tone?: Tone;
  colunas?: { valor: string; detalhe?: string };
  unidade?: string;
}) {
  const max = Math.max(...itens.map((i) => i.valor), 0);
  const temDetalhe = itens.some((i) => i.detalhe);

  return (
    <div className="flex flex-1 flex-col gap-2">
      {colunas && (
        <div
          className={cn(
            "grid items-baseline gap-3 text-[10px] uppercase tracking-wide text-muted-foreground",
            temDetalhe ? "grid-cols-[minmax(72px,26%)_1fr_auto_auto]" : "grid-cols-[minmax(72px,26%)_1fr_auto]"
          )}
        >
          <span />
          <span />
          <span className="min-w-[36px] text-right">{colunas.valor}</span>
          {temDetalhe && <span className="min-w-[64px] text-right">{colunas.detalhe}</span>}
        </div>
      )}
      <div className="flex flex-1 flex-col justify-evenly gap-2.5">
        {itens.map((item) => {
          const largura = max > 0 ? Math.max(2, (item.valor / max) * 100) : 2;
          return (
            <div
              key={item.id}
              title={item.titulo}
              className={cn(
                "grid items-center gap-3",
                temDetalhe ? "grid-cols-[minmax(72px,26%)_1fr_auto_auto]" : "grid-cols-[minmax(72px,26%)_1fr_auto]"
              )}
            >
              <span className="truncate text-[12.5px] text-ink-soft" title={item.nome}>
                {item.nome}
              </span>
              <span className="block h-2.5 min-w-0 rounded-full bg-black/5">
                <span
                  className={cn("block h-full rounded-full", FILL[item.alerta ? "estado" : tone])}
                  style={{ width: `${largura.toFixed(1)}%` }}
                />
              </span>
              <span className="min-w-[36px] text-right text-[13px] font-semibold tabular-nums text-ink">
                {item.rotulo ?? item.valor}
                {unidade && <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{unidade}</span>}
              </span>
              {temDetalhe && (
                <span className="min-w-[64px] text-right text-[11.5px] tabular-nums text-muted-foreground">
                  {item.detalhe}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type DivergenteItem = {
  id: string;
  nome: string;
  /** Positivo vai para a direita. */
  pct: number;
  titulo?: string;
};

/**
 * Barras divergentes ancoradas no zero. A posição carrega o sinal, não só a
 * cor: verde e vermelho sozinhos não separam para quem tem deuteranopia.
 */
export function BarrasDivergentes({
  itens,
  legenda,
}: {
  itens: DivergenteItem[];
  legenda: { esquerda: string; direita: string };
}) {
  const max = Math.max(...itens.map((i) => Math.abs(i.pct)), 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(104px,34%)_1fr] gap-3 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span />
        <span className="flex justify-between">
          <span>{legenda.esquerda}</span>
          <span>{legenda.direita}</span>
        </span>
      </div>
      {itens.map((item) => {
        const metade = (Math.abs(item.pct) / max) * 44;
        const acima = item.pct >= 0;
        return (
          <div key={item.id} title={item.titulo} className="grid grid-cols-[minmax(104px,34%)_1fr] items-center gap-3">
            <span className="truncate text-[12.5px] text-ink-soft" title={item.nome}>
              {item.nome}
            </span>
            <span className="relative block h-4 min-w-0">
              <span className="absolute inset-y-0 left-1/2 w-px bg-black/15" />
              <span
                className={cn(
                  "absolute top-[3px] h-2.5",
                  acima ? "left-1/2 rounded-r-full bg-negative" : "right-1/2 rounded-l-full bg-positive"
                )}
                style={{ width: `${metade.toFixed(1)}%` }}
              />
              <span
                className="absolute top-0 flex h-4 items-center text-[11.5px] font-semibold tabular-nums text-ink-soft"
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
    <div className="flex flex-col gap-2.5">
      {itens.map((p) => (
        <div
          key={p.pessoaId}
          title={`${p.emDia} em dia, ${p.atrasada} atrasada${p.atrasada === 1 ? "" : "s"}`}
          className="grid grid-cols-[minmax(80px,26%)_1fr_auto] items-center gap-3"
        >
          <span className="truncate text-[12.5px] text-ink-soft">{p.nome}</span>
          <span className="flex h-2.5 min-w-0 gap-0.5">
            <span
              className="block rounded-full bg-chart-info"
              style={{ width: `${((p.emDia / max) * 100).toFixed(1)}%` }}
            />
            {p.atrasada > 0 && (
              <span
                className="block rounded-full bg-negative"
                style={{ width: `${((p.atrasada / max) * 100).toFixed(1)}%` }}
              />
            )}
          </span>
          <span className="min-w-[52px] text-right text-[12.5px] tabular-nums text-muted-foreground">
            <b className="font-semibold text-ink">{p.emDia + p.atrasada}</b>
            {p.atrasada > 0 && <span className="ml-1 text-danger-mid">{p.atrasada} atr.</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Legenda: quadrado para série de barra, traço para série de linha. */
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
