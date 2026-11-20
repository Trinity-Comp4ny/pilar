import { useState } from "react";
import { ClipboardList, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompartilharButton } from "@/components/mobile/CompartilharButton";
import { useObraRdos } from "@/pages/obras/hooks/useObraRdo";
import {
  periodoPadrao,
  periodoValido,
  rdosDoPeriodo,
  textoDoRelatorio,
  type PeriodoRelatorio,
} from "@/pages/obras/lib/relatorioDiario";
import { RelatorioClienteDialog } from "./RelatorioClienteDialog";
import { RelatorioDiarioDialog } from "./RelatorioDiarioDialog";

/**
 * Aba "Relatórios" da obra: tudo o que sai para o cliente num lugar só. Prestação de contas
 * (financeiro) e diário por período, cada um em PDF pelo navegador ou pela folha de compartilhar.
 */
export function ObraRelatoriosTab({
  obraId,
  obraNome,
  mostrarFinanceiro,
  mostrarDiario,
}: {
  obraId: string;
  obraNome: string;
  mostrarFinanceiro: boolean;
  mostrarDiario: boolean;
}) {
  const { data: rdos = [] } = useObraRdos(mostrarDiario ? obraId : undefined);
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>(() => periodoPadrao());
  const [financeiroAberto, setFinanceiroAberto] = useState(false);
  const [diarioAberto, setDiarioAberto] = useState(false);

  const doPeriodo = rdosDoPeriodo(rdos, periodo);
  const valido = periodoValido(periodo);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {mostrarFinanceiro && (
        <section className="space-y-3 rounded-xl border border-border bg-white p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-ink">Prestação de contas</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Aportes, gastos, saldo e orçado x realizado. É o que o dono da obra vê no portal.
          </p>
          <Button variant="brand" size="sm" onClick={() => setFinanceiroAberto(true)}>
            Abrir relatório
          </Button>
        </section>
      )}

      {mostrarDiario && (
        <section className="space-y-3 rounded-xl border border-border bg-white p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-ink">Diário por período</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="rel-de">De</Label>
              <Input
                id="rel-de"
                type="date"
                value={periodo.de}
                onChange={(e) => setPeriodo({ ...periodo, de: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rel-ate">Até</Label>
              <Input
                id="rel-ate"
                type="date"
                value={periodo.ate}
                onChange={(e) => setPeriodo({ ...periodo, ate: e.target.value })}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {!valido
              ? "Escolha um período válido."
              : doPeriodo.length === 0
                ? "Nenhum registro neste período."
                : `${doPeriodo.length} ${doPeriodo.length === 1 ? "dia registrado" : "dias registrados"} no período.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" size="sm" disabled={!valido} onClick={() => setDiarioAberto(true)}>
              Abrir relatório
            </Button>
            <CompartilharButton
              size="sm"
              disabled={!valido || doPeriodo.length === 0}
              dados={() => ({
                titulo: `Diário de obra · ${obraNome}`,
                texto: textoDoRelatorio(obraNome, periodo, doPeriodo),
              })}
            />
          </div>
        </section>
      )}

      {financeiroAberto && (
        <RelatorioClienteDialog
          open
          onOpenChange={(v) => !v && setFinanceiroAberto(false)}
          obraId={obraId}
          obraNome={obraNome}
        />
      )}
      {diarioAberto && (
        <RelatorioDiarioDialog
          open
          onOpenChange={(v) => !v && setDiarioAberto(false)}
          obraNome={obraNome}
          periodo={periodo}
          rdos={doPeriodo}
        />
      )}
    </div>
  );
}
