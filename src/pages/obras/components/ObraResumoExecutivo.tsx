import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { cn } from "@/lib/utils";
import { calcularAvanco } from "@/lib/obras";
import { useResumoCustoObras } from "@/pages/obras/hooks/useResumoCustoObras";
import { lerCusto } from "@/pages/obras/lib/semaforoCusto";
import { projecaoCusto, situacaoPrazo } from "@/pages/obras/lib/resumoExecutivo";

interface Props {
  obraId: string;
  fimPrevisto: string | null;
  tarefas: ReadonlyArray<{ status: string }>;
  /** Custo é dinheiro: só com acesso ao financeiro (ADR 0046). */
  comCusto: boolean;
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-1 rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      {children}
    </div>
  );
}

const COR_SEMAFORO = { verde: "text-positive-strong", amarelo: "text-warning-strong", vermelho: "text-danger-strong" };

/** Cabeçalho executivo da Visão geral: avanço, prazo, orçado × realizado e custo final projetado. */
export function ObraResumoExecutivo({ obraId, fimPrevisto, tarefas, comCusto }: Props) {
  const fmt = useMoneyMask();
  const { data: custos } = useResumoCustoObras();
  const avanco = calcularAvanco(tarefas);
  const prazo = situacaoPrazo(fimPrevisto, avanco, new Date());
  const resumo = comCusto ? custos?.get(obraId) : undefined;
  const leitura = lerCusto(resumo, avanco);
  const projecao = resumo ? projecaoCusto(resumo.previsto, resumo.realizado, avanco) : null;

  return (
    <section aria-label="Resumo executivo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Bloco titulo="Avanço físico">
        <p className="text-lg font-semibold text-ink">{avanco}%</p>
        <Progress value={avanco} className="h-1.5" />
      </Bloco>

      <Bloco titulo="Prazo">
        {prazo ? (
          <p className={cn("text-lg font-semibold", prazo.atrasada ? "text-danger-strong" : "text-ink")}>
            {prazo.dias >= 0
              ? `${prazo.dias} ${prazo.dias === 1 ? "dia" : "dias"}`
              : `${-prazo.dias} ${prazo.dias === -1 ? "dia" : "dias"} de atraso`}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Sem data de fim</p>
        )}
        {prazo && prazo.dias >= 0 && <p className="text-xs text-muted-foreground">até o fim previsto</p>}
      </Bloco>

      {comCusto && (
        <>
          <Bloco titulo="Gasto sobre o orçado">
            {resumo && leitura ? (
              <>
                <p className={cn("text-lg font-semibold", COR_SEMAFORO[leitura.semaforo])}>{leitura.gastoPct}%</p>
                <p className="text-xs text-muted-foreground">
                  {fmt(resumo.realizado)} de {fmt(resumo.previsto)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem orçamento definido</p>
            )}
          </Bloco>

          <Bloco titulo="Custo final projetado">
            {projecao ? (
              <>
                <p
                  data-testid="custo-projetado"
                  className={cn("text-lg font-semibold", projecao.desvio > 0 ? "text-danger-strong" : "text-ink")}
                >
                  {fmt(projecao.projetado)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {!projecao.extrapolada
                    ? "Obra no início: igual ao orçado"
                    : projecao.desvio > 0
                      ? `${fmt(projecao.desvio)} acima do orçado`
                      : projecao.desvio < 0
                        ? `${fmt(-projecao.desvio)} abaixo do orçado`
                        : "No orçado"}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem orçamento definido</p>
            )}
          </Bloco>
        </>
      )}
    </section>
  );
}
