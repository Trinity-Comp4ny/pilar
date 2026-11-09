import { Info } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { ResultadoEstimativa } from "@/schemas/estimativaObra";
import { ORIGEM_INFO, type TipoDeOrigem } from "./origemInfo";

type Origens = NonNullable<ResultadoEstimativa["origens"]>;

const COR: Record<Exclude<TipoDeOrigem, "a_definir">, string> = {
  cub: "hsl(var(--chart-info))",
  sinapi: "hsl(var(--chart-success))",
  empresa: "hsl(var(--chart-info-alt))",
  usuario: "hsl(var(--chart-neutral))",
  referencia_pilar: "hsl(var(--chart-warning))",
};

function fatias(o: Origens): { tipo: keyof typeof COR; valor: number }[] {
  return (
    [
      { tipo: "cub", valor: o.cub },
      { tipo: "sinapi", valor: o.sinapi },
      { tipo: "empresa", valor: o.empresa },
      { tipo: "usuario", valor: o.usuario },
      { tipo: "referencia_pilar", valor: o.referenciaPilar },
    ] as const
  ).filter((f) => f.valor > 0);
}

/**
 * "De onde vem o preço": quanto do subtotal tem fonte verificável (CUB, SINAPI, empresa ou valor informado),
 * a divisão por origem e o porquê de a faixa ter aberto. Resultado salvo antes da origem não traz o resumo.
 */
export function OrigemDoPreco({ resultado: r }: { resultado: ResultadoEstimativa }) {
  const o = r.origens;
  if (!o) return null;
  const partes = fatias(o);
  const total = partes.reduce((s, f) => s + f.valor, 0);
  const linhas = r.adicionais.length + 1;
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 md:p-5" aria-labelledby="origem-do-preco">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="origem-do-preco" className="text-base font-semibold text-ink">
          De onde vem o preço
        </h3>
        <span className="text-xs text-ink-soft">
          {linhas} linhas · {o.aDefinir > 0 ? `${o.aDefinir} a definir, fora do total` : "todas com valor"}
        </span>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-semibold tabular-nums tracking-tight text-ink">
          {formatPercent(o.verificavelPct, 0)}
        </span>
        <span className="text-sm text-ink-soft">
          do total tem fonte verificável (CUB, SINAPI, sua empresa ou valor informado por você)
        </span>
      </p>
      <div
        className="flex h-3 overflow-hidden rounded-full"
        role="img"
        aria-label="Divisão do subtotal por origem do preço"
      >
        {partes.map((f) => (
          <span key={f.tipo} style={{ width: `${(f.valor / total) * 100}%`, background: COR[f.tipo] }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-soft">
        {partes.map((f) => (
          <li key={f.tipo} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: COR[f.tipo] }} />
            {ORIGEM_INFO[f.tipo].rotulo}{" "}
            <strong className="font-semibold tabular-nums text-ink" title={formatCurrency(f.valor, { decimals: 0 })}>
              {formatPercent((f.valor / total) * 100, 1)}
            </strong>
          </li>
        ))}
      </ul>
      {o.aDefinir > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-info-mid bg-info-soft px-3 py-3 text-sm text-info-strong">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {o.aDefinir === 1 ? "1 item ainda não tem preço" : `${o.aDefinir} itens ainda não têm preço`}: ficam fora do
            total e da faixa até você informar o valor.
          </span>
        </p>
      )}
    </section>
  );
}
