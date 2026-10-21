import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/format";
import { rotuloMesBase, rotuloPadrao } from "@/lib/estimativaObra";
import type { ResultadoEstimativa } from "@/schemas/estimativaObra";
import { toDataSourceResult } from "@/types/dataSource";
import { ChipOrigem } from "./origem";
import { OrigemDoPreco } from "./OrigemDoPreco";

type Etapa = ResultadoEstimativa["etapas"][number];
type Adicional = ResultadoEstimativa["adicionais"][number];

const reais0 = (v: number) => formatCurrency(v, { decimals: 0 });

const COR_NATUREZA: Record<string, string> = {
  material: "hsl(var(--chart-success))",
  mao_de_obra: "hsl(var(--chart-info))",
  equipamentos: "hsl(var(--chart-warning))",
  despesas: "hsl(var(--chart-neutral))",
  administracao: "hsl(var(--chart-info-alt))",
};

function Bloco({ titulo, children, nota }: { titulo: string; children: React.ReactNode; nota?: string }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 md:p-5">
      <div>
        <h3 className="text-base font-semibold text-ink">{titulo}</h3>
        {nota && <p className="text-xs text-ink-soft">{nota}</p>}
      </div>
      {children}
    </section>
  );
}

function ResumoDoCusto({ r }: { r: ResultadoEstimativa }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 md:p-5" aria-labelledby="custo-provavel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="custo-provavel" className="text-xs font-medium uppercase tracking-wider text-ink-soft">
          Custo provável da obra
        </p>
        <Badge variant="outline" className="font-normal" title="Fonte do preço de referência">
          {r.fonte.texto}
        </Badge>
      </div>
      <p className="text-3xl font-semibold tabular-nums tracking-tight text-ink md:text-4xl">{reais0(r.provavel)}</p>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
        <span>
          <strong className="font-semibold tabular-nums text-ink">{reais0(r.porM2)}</strong> por m²
        </span>
        <span>
          <strong className="font-semibold tabular-nums text-ink">{r.meses} meses</strong> de obra
        </span>
        <span>
          {r.area.toLocaleString("pt-BR")} m² · {r.subtipoNome.toLowerCase()} · padrão {rotuloPadrao(r.padrao)}
        </span>
      </p>
      <div>
        <div
          className="relative my-4 h-2.5 rounded-full bg-brand/30"
          role="img"
          aria-label="Faixa de custo, do mínimo ao máximo"
        >
          <span className="absolute left-1/2 top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
        </div>
        <div className="flex justify-between text-sm tabular-nums">
          <span>
            <span className="text-ink-soft">Mínimo </span>
            <strong className="font-semibold text-ink">{reais0(r.minimo)}</strong>
          </span>
          <span className="text-xs text-ink-soft">faixa de ±{formatPercent(r.faixaPct, 0)}</span>
          <span>
            <span className="text-ink-soft">Máximo </span>
            <strong className="font-semibold text-ink">{reais0(r.maximo)}</strong>
          </span>
        </div>
      </div>
      <p className="text-xs text-ink-soft">
        Estimativa paramétrica para a conversa de proposta. Não substitui o orçamento executivo.
      </p>
    </section>
  );
}

function DesembolsoMensal({ r }: { r: ResultadoEstimativa }) {
  const pontos = useMemo(() => r.desembolso.map((d) => ({ mes: d.mes, valor: d.valor })), [r.desembolso]);
  const pico = pontos.reduce((m, p) => (p.valor > m.valor ? p : m), pontos[0]);
  return (
    <Bloco titulo="Desembolso mensal" nota="Quanto o cliente precisa ter por mês.">
      <div className="h-44 w-full" role="img" aria-label="Gráfico de barras do desembolso por mês">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pontos} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--chart-grid))" />
            <XAxis
              dataKey="mes"
              tickFormatter={(m: string) => rotuloMesBase(`${m}-01`)}
              stroke="hsl(var(--chart-neutral))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
              stroke="hsl(var(--chart-neutral))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--chart-grid))", opacity: 0.4 }}
              formatter={(v: number) => [reais0(v), "Desembolso"]}
              labelFormatter={(m: string) => rotuloMesBase(`${m}-01`)}
            />
            <Bar dataKey="valor" fill="hsl(var(--chart-info))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {pico && (
        <p className="text-sm text-ink-soft">
          Pico de <strong className="font-semibold tabular-nums text-ink">{reais0(pico.valor)}</strong> em{" "}
          {rotuloMesBase(`${pico.mes}-01`)}.
        </p>
      )}
    </Bloco>
  );
}

function NaturezaDoCusto({ r }: { r: ResultadoEstimativa }) {
  const total = r.natureza.reduce((s, n) => s + n.valor, 0);
  return (
    <Bloco titulo="Por natureza">
      <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label="Divisão do custo por natureza">
        {r.natureza.map((n) => (
          <span key={n.id} style={{ width: `${(n.valor / total) * 100}%`, background: COR_NATUREZA[n.id] }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-soft">
        {r.natureza.map((n) => (
          <li key={n.id} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_NATUREZA[n.id] }} />
            {n.rotulo}{" "}
            <strong className="font-semibold tabular-nums text-ink">{formatPercent((n.valor / total) * 100, 1)}</strong>
          </li>
        ))}
      </ul>
    </Bloco>
  );
}

interface CustoTabProps {
  resultado: ResultadoEstimativa;
  /** Abre o detalhe da origem: "base" é o CUB, uma linha é um item fora do CUB. */
  onOrigem?: (aberto: "base" | Adicional) => void;
  /** Informar o valor de um item a definir; ausente para quem só lê. */
  onInformar?: (item: Adicional) => void;
}

/** Aba Custo: valor e faixa em destaque, origem do preço, por etapa, adicionais, totais, natureza e desembolso. */
export function CustoTab({ resultado: r, onOrigem, onInformar }: CustoTabProps) {
  const maiorEtapa = Math.max(...r.etapas.map((e) => e.valor));
  const adicionaisTotal = r.adicionais.reduce((s, a) => s + (a.valor ?? 0), 0);

  const colunasEtapa: ColumnDef<Etapa>[] = [
    { key: "etapa", header: "Etapa", cell: (e) => e.nome, mobile: "title" },
    {
      key: "valor",
      header: "Valor",
      align: "end",
      getSortValue: (e) => e.valor,
      cell: (e) => reais0(e.valor),
      className: "tabular-nums",
      mobile: "trailing",
    },
    {
      key: "pct",
      header: "% da base",
      align: "end",
      getSortValue: (e) => e.valor,
      cell: (e) => (
        <span className="flex items-center justify-end gap-2">
          <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-brand"
              style={{ width: `${(e.valor / maiorEtapa) * 100}%` }}
            />
          </span>
          <span className="tabular-nums text-ink-soft">{formatPercent((e.valor / r.base) * 100, 1)}</span>
        </span>
      ),
    },
  ];

  const colunasAdicional: ColumnDef<Adicional>[] = [
    {
      key: "item",
      header: "Item",
      cell: (a) => (
        <span>
          <span className="font-medium text-ink">{a.rotulo}</span>
          {a.nota && <span className="block text-xs text-ink-soft">{a.nota}</span>}
        </span>
      ),
      mobile: "title",
    },
    {
      key: "origem",
      header: "Origem",
      cell: (a) => (
        <ChipOrigem tipo={a.origem.tipo} rotuloDoItem={a.rotulo} onClick={onOrigem ? () => onOrigem(a) : undefined} />
      ),
      mobile: "badge",
    },
    {
      key: "valor",
      header: "Valor",
      align: "end",
      cell: (a) =>
        a.valor === null ? (
          onInformar && a.quantidade > 0 ? (
            <Button variant="outline" size="sm" onClick={() => onInformar(a)}>
              Informar valor
            </Button>
          ) : (
            <Badge variant="warning">A definir</Badge>
          )
        ) : (
          reais0(a.valor)
        ),
      className: "tabular-nums",
      mobile: "trailing",
    },
  ];

  return (
    <div className="space-y-4">
      <ResumoDoCusto r={r} />

      <OrigemDoPreco resultado={r} />

      <Bloco titulo="Por etapa" nota="Base do CUB distribuída pelos percentuais dos parâmetros.">
        <DataTable
          columns={colunasEtapa}
          data={toDataSourceResult<Etapa>({ data: r.etapas })}
          rowKey={(e) => e.id}
          density="compact"
        />
      </Bloco>

      <Bloco titulo="Itens fora do CUB" nota="O que o CUB não inclui. Toque na origem para ver a fonte do preço.">
        <DataTable
          columns={colunasAdicional}
          data={toDataSourceResult<Adicional>({ data: r.adicionais })}
          rowKey={(a) => a.id}
          density="compact"
        />
      </Bloco>

      <section className="rounded-2xl border bg-card p-4 md:p-5" aria-label="Totais">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-ink-soft">
              Base do CUB
              <ChipOrigem
                tipo="cub"
                rotuloDoItem="base do CUB"
                onClick={onOrigem ? () => onOrigem("base") : undefined}
              />
            </dt>
            <dd className="tabular-nums text-ink">{reais0(r.base)}</dd>
          </div>
          {[
            ["Adicionais", adicionaisTotal],
            ["Subtotal da obra", r.subtotal],
            [`Taxa de administração (${formatPercent(r.admPct, 0)})`, r.taxaAdministracao],
          ].map(([rotulo, valor]) => (
            <div key={rotulo as string} className="flex justify-between gap-4">
              <dt className="text-ink-soft">{rotulo}</dt>
              <dd className="tabular-nums text-ink">{reais0(valor as number)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
            <dt className="text-ink">Total provável</dt>
            <dd className="tabular-nums text-ink">{reais0(r.provavel)}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <NaturezaDoCusto r={r} />
        <DesembolsoMensal r={r} />
      </div>
    </div>
  );
}
