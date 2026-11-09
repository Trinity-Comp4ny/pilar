import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { calcularEstimativa, padroesDisponiveis, rotuloPadrao } from "@/lib/estimativaObra";
import { formatCurrency } from "@/lib/format";
import { SUBTIPOS, type Ficha, type Padrao, type Premissas, type ResultadoEstimativa } from "@/schemas/estimativaObra";
import type { Insumos } from "./hooks";
import { PADRAO_INFO, compararCenarios, fraseDoCenario } from "./lib";
import { Pilula } from "./componentes";

type InsumosProntos = Extract<Insumos, { estado: "ok" }>;

const reais0 = (v: number) => formatCurrency(v, { decimals: 0 });

function ColunaDoCenario({ titulo, r, atual }: { titulo: string; r: ResultadoEstimativa; atual?: boolean }) {
  const pico = Math.max(...r.desembolso.map((d) => d.valor));
  const linhas: [string, string][] = [
    ["Por m²", reais0(r.porM2)],
    ["Prazo", `${r.meses} meses`],
    ["Pico mensal", reais0(pico)],
    ["Adicionais", reais0(r.adicionais.reduce((s, a) => s + (a.valor ?? 0), 0))],
    ["Referência", r.fonte.texto],
  ];
  return (
    <section className={`rounded-2xl border bg-card p-4 md:p-5 ${atual ? "border-ink" : ""}`} aria-label={titulo}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{titulo}</h3>
        {atual && <Badge variant="info">na estimativa</Badge>}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-ink">{reais0(r.provavel)}</p>
      <p className="text-sm tabular-nums text-ink-soft">
        {reais0(r.minimo)} a {reais0(r.maximo)}
      </p>
      <dl className="mt-3 text-sm">
        {linhas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b py-2 last:border-b-0">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="text-right font-medium tabular-nums text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Aba Cenários: a mesma obra em outro padrão, lado a lado, sem criar outra estimativa. */
export function CenariosTab({
  ficha,
  premissas,
  insumos,
  atual,
}: {
  ficha: Ficha;
  premissas: Premissas;
  insumos: InsumosProntos;
  atual: ResultadoEstimativa;
}) {
  const cub = SUBTIPOS[ficha.tipo][ficha.subtipo].cub;
  const outros = useMemo(
    () => padroesDisponiveis(insumos.cub, cub, premissas.regime).filter((p) => p !== ficha.padrao),
    [insumos.cub, cub, ficha.padrao, premissas.regime]
  );
  const [escolhido, setEscolhido] = useState<Padrao | null>(null);
  const comparar =
    escolhido && outros.includes(escolhido) ? escolhido : (outros.find((p) => p === "normal") ?? outros[0]);

  const cenario = useMemo(() => {
    if (!comparar) return null;
    return calcularEstimativa({
      ficha,
      premissas,
      cub: insumos.cub,
      parametros: insumos.parametros,
      ajustes: insumos.ajustes,
      precosSinapi: insumos.precosSinapi,
      parametrosValidados: insumos.validado,
      padraoCenario: comparar,
    });
  }, [ficha, premissas, insumos, comparar]);

  if (!comparar) {
    return (
      <EmptyState
        icon={Scale}
        title="Só há tabela de um padrão para este subtipo"
        description="Sem outro padrão com preço de referência, não há o que comparar."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-soft">Comparar com</span>
        {outros.map((p) => (
          <Pilula key={p} ativa={p === comparar} onClick={() => setEscolhido(p)}>
            Padrão {PADRAO_INFO[p].nome.toLowerCase()}
          </Pilula>
        ))}
      </div>

      {cenario && !cenario.ok ? (
        <p
          className="rounded-xl border border-danger-mid bg-danger-soft px-3 py-3 text-sm text-danger-strong"
          role="alert"
        >
          {cenario.mensagem}
        </p>
      ) : (
        cenario && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <ColunaDoCenario titulo={`Padrão ${rotuloPadrao(atual.padrao)}`} r={atual} atual />
              <ColunaDoCenario titulo={`Padrão ${comparar}`} r={cenario.resultado} />
            </div>
            <p className="rounded-xl bg-info-soft px-3 py-2 text-sm text-info-strong" role="status">
              {fraseDoCenario(comparar, compararCenarios(atual, cenario.resultado), reais0)}
            </p>
          </>
        )
      )}
    </div>
  );
}
