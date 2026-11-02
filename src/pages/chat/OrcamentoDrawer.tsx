import { useState } from "react";
import { NavLink } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { parseCurrencyString } from "@/lib/currencyUtils";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type Pendencia, useOrcamentoGuiado, useSalvarOrcamentoGuiado } from "./hooks/useAgentePendencias";
import { calcularOrcamento, lerHoras } from "./lib/plano";

interface OrcamentoDrawerProps {
  pendencia: Pendencia | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Orçamento por disciplina guiado (SPEC 148): o agente lista as disciplinas do projeto e o usuário
 * informa horas e custo por hora; contrato, custo e margem aparecem na hora. Salvar passa o
 * guardião de margem a vigiar o projeto. Os números são sempre do usuário (nada vem de IA).
 */
export function OrcamentoDrawer({ pendencia, onOpenChange }: OrcamentoDrawerProps) {
  const projetoId = pendencia?.projeto_id ?? null;
  const dados = useOrcamentoGuiado(projetoId);
  const salvar = useSalvarOrcamentoGuiado();

  const [horas, setHoras] = useState<Record<string, string>>({});
  const [custoHora, setCustoHora] = useState<Record<string, string>>({});
  const [padrao, setPadrao] = useState("");

  if (!pendencia) return null;

  const disciplinas = dados.data?.disciplinas ?? [];
  const contrato = dados.data?.contrato ?? null;
  const linhas = disciplinas.map((nome) => ({
    nome,
    horas: lerHoras(horas[nome] ?? ""),
    custoHora: parseCurrencyString(custoHora[nome] ?? ""),
  }));
  const resumo = calcularOrcamento(linhas, contrato);
  const validas = linhas.filter((l) => l.horas > 0 && l.custoHora > 0);

  const aplicarPadrao = () => {
    const valor = parseCurrencyString(padrao);
    if (valor <= 0) return;
    setCustoHora(Object.fromEntries(disciplinas.map((nome) => [nome, padrao])));
  };

  const handleSalvar = async () => {
    if (!projetoId || validas.length === 0) return;
    try {
      await salvar.mutateAsync({
        projetoId,
        linhas: validas.map((l) => ({ disciplina: l.nome, horasEstimadas: l.horas, custoHora: l.custoHora })),
      });
      toast.success("Orçamento salvo", { description: "O guardião de margem passa a vigiar este projeto." });
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar o orçamento", { description: "Confira os valores e tente de novo." });
    }
  };

  return (
    <Sheet open={!!pendencia} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-4 pr-12">
          <SheetTitle>Orçamento por disciplina: {dados.data?.nome ?? "projeto"}</SheetTitle>
          <SheetDescription>
            Informe as horas e o custo por hora de cada disciplina. Sem orçamento, o guardião de margem não vigia o
            projeto.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {dados.isLoading && <Skeleton className="h-48 w-full" />}
          {dados.isError && (
            <p className="rounded-lg border border-danger-mid-border bg-danger-soft p-3 text-sm text-danger-strong">
              Não foi possível carregar o projeto. Feche e abra de novo; se persistir, atualize a página.
            </p>
          )}

          {dados.data && disciplinas.length === 0 && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-ink-soft">
              <p>Este projeto ainda não tem disciplinas. Cadastre as disciplinas para poder orçar cada uma.</p>
              {pendencia.link && (
                <Button variant="outline" size="sm" asChild>
                  <NavLink to={pendencia.link}>Abrir o projeto</NavLink>
                </Button>
              )}
            </div>
          )}

          {disciplinas.length > 0 && (
            <>
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <div className="min-w-40 flex-1 space-y-1">
                  <label htmlFor="orcamento-padrao" className="text-xs text-muted-foreground">
                    Custo por hora igual para todas (opcional)
                  </label>
                  <MoneyInput id="orcamento-padrao" value={padrao} onChange={setPadrao} placeholder="R$ 0,00" />
                </div>
                <Button variant="outline" size="sm" onClick={aplicarPadrao} disabled={parseCurrencyString(padrao) <= 0}>
                  Aplicar a todas
                </Button>
              </div>

              <ul className="space-y-2" aria-label="Orçamento por disciplina">
                {linhas.map((l) => (
                  <li key={l.nome} className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">{l.nome}</span>
                      <span className="text-sm tabular-nums text-ink-soft">
                        {l.horas > 0 && l.custoHora > 0 ? formatCurrency(l.horas * l.custoHora) : "sem custo ainda"}
                      </span>
                    </div>
                    <div className="grid grid-cols-[6rem_1fr] gap-2">
                      <Input
                        inputMode="decimal"
                        aria-label={`Horas de ${l.nome}`}
                        className="text-right"
                        placeholder="Horas"
                        value={horas[l.nome] ?? ""}
                        onChange={(e) => setHoras((h) => ({ ...h, [l.nome]: e.target.value }))}
                      />
                      <MoneyInput
                        aria-label={`Custo por hora de ${l.nome}`}
                        value={custoHora[l.nome] ?? ""}
                        onChange={(v) => setCustoHora((c) => ({ ...c, [l.nome]: v }))}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Resumo do orçamento">
                <Resumo
                  rotulo="Contrato"
                  valor={contrato !== null && contrato > 0 ? formatCurrency(contrato) : "sem valor"}
                />
                <Resumo rotulo="Custo orçado" valor={formatCurrency(resumo.custo)} />
                <Resumo
                  rotulo="Margem prevista"
                  valor={resumo.margemPct === null ? "-" : formatPercent(resumo.margemPct)}
                  perigo={resumo.acimaDoContrato}
                />
              </div>

              {resumo.acimaDoContrato && (
                <p className="rounded-lg border border-warning-mid-border bg-warning-soft p-3 text-sm text-warning-strong">
                  O custo orçado passa do valor do contrato: o projeto começaria com margem negativa. Confira as horas e
                  o custo por hora antes de salvar.
                </p>
              )}
            </>
          )}
        </div>

        <SheetFooter className="flex-col gap-2 border-t border-border bg-surface-app p-4 sm:flex-col sm:space-x-0">
          <p className="text-xs text-muted-foreground">
            Salvar passa o guardião de margem a vigiar este projeto. Disciplinas sem horas ou sem custo ficam de fora.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="brand"
              size="sm"
              disabled={validas.length === 0 || salvar.isPending}
              loading={salvar.isPending}
              onClick={handleSalvar}
            >
              Salvar orçamento
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Resumo({ rotulo, valor, perigo }: { rotulo: string; valor: string; perigo?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className={cn("text-base font-semibold tabular-nums text-foreground", perigo && "text-negative-strong")}>
        {valor}
      </p>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
    </div>
  );
}
