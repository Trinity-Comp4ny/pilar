import { useState } from "react";
import { Clock, CreditCard, ShoppingCart, TrendingUp, UserCheck, UserPlus } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toDataSourceResult } from "@/types/dataSource";
import { FiltroChips } from "../../components/FiltroChips";
import { useReceita } from "../hooks";
import { taxa, variacao, type Decisao } from "../lib";
import type { Receita } from "../api";
import { ListaDecisoes } from "./ListaDecisoes";

type Janela = "7" | "30" | "90";
type Origem = Receita["por_origem"][number];

const JANELAS = [
  { value: "7" as const, label: "7 dias" },
  { value: "30" as const, label: "30 dias" },
  { value: "90" as const, label: "90 dias" },
];

/** Ficha Receita (SPEC 126): funil, MRR, testes vencendo, atrasos e conversão por campanha. */
export function ReceitaPainel({ decisoes }: { decisoes: Decisao[] }) {
  const [janela, setJanela] = useState<Janela>("30");
  const dias = Number(janela);
  const q = useReceita(dias);
  const r = q.data;
  const carregando = q.isLoading;

  const colunas: ColumnDef<Origem>[] = [
    {
      key: "origem",
      header: "Origem",
      getSortValue: (o) => o.fonte,
      cell: (o) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{o.fonte}</p>
          <p className="truncate text-xs text-ink-muted">{o.campanha}</p>
        </div>
      ),
    },
    { key: "cadastros", header: "Cadastros", align: "end", getSortValue: (o) => o.cadastros, cell: (o) => o.cadastros },
    {
      key: "ativados",
      header: "Ativados",
      align: "end",
      getSortValue: (o) => o.ativados,
      cell: (o) => (
        <span className="tabular-nums">
          {o.ativados} <span className="text-ink-muted">({taxa(o.ativados, o.cadastros)})</span>
        </span>
      ),
    },
    {
      key: "pagantes",
      header: "Pagantes",
      align: "end",
      getSortValue: (o) => o.pagantes,
      cell: (o) => (
        <span className="tabular-nums">
          {o.pagantes} <span className="text-ink-muted">({taxa(o.pagantes, o.cadastros)})</span>
        </span>
      ),
    },
  ];

  return (
    <>
      <FiltroChips ariaLabel="Período" opcoes={JANELAS} value={janela} onChange={setJanela} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          icon={TrendingUp}
          label="MRR"
          value={r?.mrr ?? 0}
          subtitle={r ? `${r.pagantes} ${r.pagantes === 1 ? "assinatura paga" : "assinaturas pagas"}` : undefined}
          loading={carregando}
        />
        <KPICard
          icon={UserPlus}
          label={`Cadastros em ${dias} dias`}
          value={`${r?.cadastros ?? 0}`}
          delta={r ? variacao(r.cadastros, r.cadastros_anterior) : undefined}
          loading={carregando}
        />
        <KPICard
          icon={UserCheck}
          label="Ativados"
          value={`${r?.ativados ?? 0}`}
          subtitle={r ? `${taxa(r.ativados, r.cadastros)} criaram um projeto real` : undefined}
          delta={r ? variacao(r.ativados, r.ativados_anterior) : undefined}
          loading={carregando}
        />
        <KPICard
          icon={CreditCard}
          label="Novos pagantes"
          value={`${r?.novos_pagantes ?? 0}`}
          delta={r ? variacao(r.novos_pagantes, r.novos_pagantes_anterior) : undefined}
          loading={carregando}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border border-black/5 lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Pede ação</CardTitle>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <ListaDecisoes decisoes={decisoes} vazio="Nenhum teste vencendo em 48 h e nenhum pagamento em atraso." />
            )}
          </CardContent>
        </Card>

        <Card className="border border-black/5">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Funil em {dias} dias</CardTitle>
          </CardHeader>
          <CardContent>
            {carregando || !r ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <Funil
                etapas={[
                  { label: "Cadastros", valor: r.cadastros },
                  { label: "Ativados", valor: r.ativados },
                  { label: "Novos pagantes", valor: r.novos_pagantes },
                ]}
              />
            )}
            {r && (
              <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-black/5 pt-3 text-xs">
                <div>
                  <dt className="flex items-center gap-1 text-ink-muted">
                    <Clock size={12} /> Em teste agora
                  </dt>
                  <dd className="text-sm tabular-nums text-ink">{r.em_teste}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-ink-muted">
                    <ShoppingCart size={12} /> Checkout sem pagar
                  </dt>
                  <dd className="text-sm tabular-nums text-ink">{r.checkout_pendente}</dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-black/5">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">De onde vieram os cadastros</CardTitle>
          <p className="text-xs text-ink-muted">UTM do link que trouxe o dono da empresa até o cadastro.</p>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={colunas}
            data={toDataSourceResult<Origem>({ data: r?.por_origem ?? [], isLoading: carregando, error: q.error })}
            rowKey={(o) => `${o.fonte}|${o.campanha}`}
            defaultSortKey="cadastros"
            defaultSortDir="desc"
            errorTitle="Não foi possível carregar a origem dos cadastros"
            emptyState={
              <EmptyState
                compact
                title={`Nenhum cadastro em ${dias} dias. Links com UTM (utm_source e utm_campaign) aparecem aqui.`}
              />
            }
          />
        </CardContent>
      </Card>
    </>
  );
}

/**
 * Barras do funil. Só a ativação mostra taxa: pagante novo no período pode ter
 * cadastrado antes dele, então pagante sobre cadastro do mesmo período enganaria.
 */
function Funil({ etapas }: { etapas: { label: string; valor: number }[] }) {
  const topo = Math.max(1, etapas[0]?.valor ?? 0);
  return (
    <ol className="space-y-3">
      {etapas.map((e, i) => {
        const anterior = i === 1 ? etapas[0].valor : null;
        return (
          <li key={e.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-ink-soft">{e.label}</span>
              <span className="tabular-nums text-ink">
                {e.valor}
                {anterior !== null && <span className="ml-1 text-xs text-ink-muted">{taxa(e.valor, anterior)}</span>}
              </span>
            </div>
            <span className="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-ink/60" style={{ width: `${(e.valor / topo) * 100}%` }} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
