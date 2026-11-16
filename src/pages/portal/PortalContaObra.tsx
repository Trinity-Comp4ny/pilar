import { Card, CardContent } from "@/components/ui/card";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { ArrowDownCircle, ArrowUpCircle, Receipt, ExternalLink, Percent } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { ClienteObraConta } from "@/pages/cliente/useClienteObraData";
import { useClienteObraOrcamento } from "@/pages/cliente/useClienteObraOrcamento";
import { RelatorioOrcadoRealizado } from "@/pages/obras/components/RelatorioOrcadoRealizado";

/** Orçado x realizado da obra, linha por linha. Some em silêncio se a obra ainda não tem orçamento nem gasto. */
function OrcadoRealizadoDaObra({ obraId }: { obraId: string }) {
  const { dados, loading } = useClienteObraOrcamento(obraId);
  if (loading || !dados) return null;
  const temValor = dados.linhas.some((l) => l.previsto > 0 || l.realizado > 0) || dados.sem_frente > 0;
  if (!temValor) return null;
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div>
          <h3 className="text-sm font-semibold">Orçado x realizado</h3>
          <p className="text-xs text-muted-foreground">
            Quanto foi previsto para cada etapa e quanto já foi gasto, sem a taxa de administração.
          </p>
        </div>
        <RelatorioOrcadoRealizado linhas={dados.linhas} semFrente={dados.sem_frente} />
      </CardContent>
    </Card>
  );
}

/**
 * Prestação de contas da obra para o dono (regime administração). Aportes vs
 * despesas confirmadas, saldo e a taxa de administração como linha própria. As
 * despesas já vêm filtradas pelo backend (só confirmada_portal = true).
 */
export function ContaObraContent({
  conta,
  taxaPct,
  obraId,
}: {
  conta: ClienteObraConta;
  taxaPct: number;
  /** Com o id da obra, a prestação de contas mostra também o orçado x realizado linha a linha. */
  obraId?: string;
}) {
  const formatCurrency = useMoneyMask();
  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard label="Aportado pelo cliente" value={conta.total_aportado} tone="neutral" />
        <KPICard label="Gasto na obra" value={conta.total_gasto} tone="warning" />
        <KPICard label="Saldo em conta" value={conta.saldo} tone={conta.saldo < 0 ? "danger" : "positive"} />
      </div>

      {obraId && <OrcadoRealizadoDaObra obraId={obraId} />}

      {/* Taxa de administração */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-brand/10 text-ink">
                <Percent className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Taxa de administração</p>
                <p className="text-xs text-muted-foreground">{taxaPct}% sobre o gasto da obra</p>
              </div>
            </div>
            <p className="text-sm font-bold">{formatCurrency(conta.taxa_administracao_valor)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Aportes */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-4">Aportes</h3>
          {conta.aportes.length === 0 ? (
            <EmptyState icon={ArrowDownCircle} title="Nenhum aporte registrado" />
          ) : (
            <div className="space-y-3">
              {conta.aportes.map((a, i) => (
                <div key={`${a.data}-${i}`} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="p-1.5 rounded bg-positive/10 text-positive-strong">
                    <ArrowDownCircle className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.descricao}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(a.data)}</p>
                  </div>
                  <p className="text-sm font-bold text-positive-strong">{formatCurrency(a.valor)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Despesas */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-4">Despesas</h3>
          {conta.despesas.length === 0 ? (
            <EmptyState icon={Receipt} title="Nenhuma despesa registrada" />
          ) : (
            <div className="space-y-3">
              {conta.despesas.map((d, i) => (
                <div key={`${d.data}-${i}`} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="p-1.5 rounded bg-danger-soft text-danger-strong">
                    <ArrowUpCircle className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{d.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(d.data)}
                      {d.frente_nome && ` · ${d.frente_nome}`}
                    </p>
                  </div>
                  <div className="text-right space-y-1.5">
                    <p className="text-sm font-bold">{formatCurrency(d.valor)}</p>
                    {d.comprovante_url && (
                      <Button asChild size="sm" variant="outline" className="h-11 sm:h-8 text-xs px-3">
                        <a href={d.comprovante_url} target="_blank" rel="noopener noreferrer">
                          Ver nota
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
