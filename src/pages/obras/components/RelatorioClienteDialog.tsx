import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { calcularSaldoConta, realizadoPorEtapa, SEM_ETAPA } from "@/lib/obras";
import { useObraConta } from "@/pages/obras/hooks/useObraConta";
import { useObraFrentes } from "@/pages/obras/hooks/useObraFrentes";
import { useObraOrcamento } from "@/pages/obras/hooks/useObraOrcamento";
import { achatarOrcado, montarOrcadoRealizado } from "@/pages/obras/lib/orcadoRealizado";
import { RelatorioOrcadoRealizado, type LinhaDoRelatorio } from "./RelatorioOrcadoRealizado";

/** Imprime só o relatório (o resto da tela some no papel). */
const CSS_IMPRESSAO = `
@media print {
  body * { visibility: hidden !important; }
  #relatorio-cliente, #relatorio-cliente * { visibility: visible !important; }
  #relatorio-cliente { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; }
  .sem-impressao { display: none !important; }
}`;

/**
 * Relatório financeiro para o dono da obra: o que ele vê no portal, pronto para imprimir ou salvar em PDF.
 * Só entra a despesa confirmada para o cliente; a que está em conferência fica de fora e é avisada aqui.
 */
export function RelatorioClienteDialog({
  open,
  onOpenChange,
  obraId,
  obraNome,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  obraNome: string;
}) {
  const { data: lancamentos = [] } = useObraConta(obraId);
  const { data: nos = [] } = useObraFrentes(obraId);
  const { data: orcamentos = [] } = useObraOrcamento(obraId);

  const visiveis = lancamentos.filter((l) => l.tipo === "aporte" || l.confirmada_portal !== false);
  const seguradas = lancamentos.filter((l) => l.tipo === "despesa" && l.confirmada_portal === false).length;
  const despesas = visiveis.filter((l) => l.tipo === "despesa");
  const aportado = visiveis.filter((l) => l.tipo === "aporte").reduce((a, l) => a + Number(l.valor), 0);
  const gasto = despesas.reduce((a, l) => a + Number(l.valor), 0);

  const previsto = new Map(orcamentos.map((o) => [o.obra_frente_id, Number(o.valor_previsto)]));
  const realizado = realizadoPorEtapa(visiveis);
  const linhas: LinhaDoRelatorio[] = nos.map((n) => ({
    id: n.id,
    parent_id: n.parent_id,
    nivel: n.nivel,
    nome: n.nome,
    ordem: n.ordem,
    previsto: previsto.get(n.id) ?? 0,
    realizado: realizado[n.id] ?? 0,
  }));
  const caminho = new Map(
    achatarOrcado(montarOrcadoRealizado(nos, new Map(), {}).raizes).map((l) => [l.no.id, l.caminho])
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <style>{CSS_IMPRESSAO}</style>
        <DialogHeader className="sem-impressao">
          <DialogTitle>Relatório para o cliente</DialogTitle>
          <DialogDescription>
            É o que o dono da obra vê no portal: só entra a despesa confirmada para ele.
            {seguradas > 0 &&
              ` ${seguradas} ${seguradas === 1 ? "despesa em conferência não entra" : "despesas em conferência não entram"}.`}
          </DialogDescription>
        </DialogHeader>

        <div id="relatorio-cliente" className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">{obraNome}</h2>
            <p className="text-xs text-muted-foreground">
              Prestação de contas · gerada em {formatDate(new Date().toISOString().slice(0, 10))}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Aportado pelo cliente</p>
              <p className="font-semibold tabular-nums text-ink">{formatCurrency(aportado)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gasto na obra</p>
              <p className="font-semibold tabular-nums text-ink">{formatCurrency(gasto)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo em conta</p>
              <p className="font-semibold tabular-nums text-ink">{formatCurrency(calcularSaldoConta(visiveis))}</p>
            </div>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Orçado x realizado</h3>
            <RelatorioOrcadoRealizado linhas={linhas} semFrente={realizado[SEM_ETAPA] ?? 0} />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Despesas</h3>
            {despesas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma despesa confirmada ainda.</p>
            ) : (
              <ul className="divide-y divide-black/5 rounded-xl border border-border bg-white text-sm">
                {despesas
                  .slice()
                  .sort((a, b) => a.data.localeCompare(b.data))
                  .map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-ink">
                          {d.descricao}
                          {d.quantidade != null && (
                            <span className="text-muted-foreground">
                              {` · ${Number(d.quantidade).toLocaleString("pt-BR")}${d.unidade ? ` ${d.unidade}` : ""}`}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(d.data)}
                          {d.obra_frente_id && caminho.get(d.obra_frente_id)
                            ? ` · ${caminho.get(d.obra_frente_id)}`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums text-ink">{formatCurrency(Number(d.valor))}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>

        <div className="sem-impressao flex justify-end">
          <Button variant="brand" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Imprimir ou salvar em PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
