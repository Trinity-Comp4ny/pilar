import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberInput } from "@/components/forms/NumberInput";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConfigComercial } from "../hooks/useConfigComercial";
import {
  aplicaDesconto,
  descontoMaximoPct,
  lucroLiquido,
  margemLiquidaPct,
  precoSugerido,
  semaforoMargem,
  taxaDoMeio,
  type SemaforoMargem,
} from "@/lib/margemLiquida";

/** Snapshot da simulação, gravado em propostas.dados_simulacao (SPEC 168). */
export interface SimulacaoMargem {
  impostoPct: number;
  meioId: string;
  parcelas: number;
  margemAlvoPct: number;
  descontoPct: number;
}

interface CalculadoraMargemProps {
  /** Soma de horas x custo/hora das disciplinas. */
  custo: number;
  /** Preço de tabela (valor digitado ou soma das disciplinas). */
  precoTabela: number;
  config: ConfigComercial;
  value: SimulacaoMargem | null;
  onChange: (sim: SimulacaoMargem) => void;
  /** Troca o valor da proposta pelo preço informado. Ação explícita do usuário. */
  onAplicarPreco: (valor: number) => void;
  onSalvarPadrao: (sim: SimulacaoMargem) => void;
  salvandoPadrao?: boolean;
  disabled?: boolean;
  /** Texto quando ainda não há custo (muda para obra, que não tem horas). */
  textoSemCusto?: string;
}

const ESTILO: Record<SemaforoMargem, { rotulo: string; classe: string }> = {
  verde: { rotulo: "Margem boa", classe: "bg-positive/10 text-positive-strong" },
  amarelo: { rotulo: "Margem apertada", classe: "bg-warning-soft text-warning-strong" },
  vermelho: { rotulo: "Abaixo do mínimo", classe: "bg-danger-soft text-danger-strong" },
};

const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
const paraNumero = (s: string) => parseFloat(s.replace(",", ".")) || 0;
const paraTexto = (n: number) => (n ? String(n).replace(".", ",") : "");

export const simulacaoInicial = (config: ConfigComercial): SimulacaoMargem => ({
  impostoPct: config.aliquotaImpostoPct,
  meioId: config.meiosRecebimento[0]?.id ?? "",
  parcelas: 1,
  margemAlvoPct: config.margemAlvoPct,
  descontoPct: 0,
});

export function CalculadoraMargem({
  custo,
  precoTabela,
  config,
  value,
  onChange,
  onAplicarPreco,
  onSalvarPadrao,
  salvandoPadrao,
  disabled,
  textoSemCusto,
}: CalculadoraMargemProps) {
  const [aberto, setAberto] = useState(false);
  const sim = useMemo(() => value ?? simulacaoInicial(config), [value, config]);

  const meio = config.meiosRecebimento.find((m) => m.id === sim.meioId) ?? config.meiosRecebimento[0];
  const taxaPct = taxaDoMeio(meio, sim.parcelas);
  const params = { impostoPct: sim.impostoPct, taxaPct };
  const temFaixas = Object.keys(meio?.faixas ?? {}).length > 0;

  const sugerido = precoSugerido(custo, sim.margemAlvoPct, params);
  const precoFinal = aplicaDesconto(precoTabela, sim.descontoPct);
  const margem = margemLiquidaPct(precoFinal, custo, params);
  const semaforo = semaforoMargem(margem, config.margemAlvoPct, config.margemMinimaPct);
  const descMax = descontoMaximoPct(precoTabela, custo, config.margemMinimaPct, params);
  const descEmpate = descontoMaximoPct(precoTabela, custo, 0, params);
  const lucro = lucroLiquido(precoFinal, custo, params);

  // Sem simulação gravada, grava a inicial uma vez para o snapshot não ficar vazio.
  useEffect(() => {
    if (!value && custo > 0 && !disabled) onChange(sim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custo > 0]);

  if (custo <= 0) {
    return (
      <div className="rounded-lg border border-black/5 p-3 text-xs text-muted-foreground">
        {textoSemCusto ??
          "Informe horas e custo/hora nas disciplinas para ver a margem e o desconto máximo desta proposta."}
      </div>
    );
  }

  const set = (patch: Partial<SimulacaoMargem>) => onChange({ ...sim, ...patch });

  return (
    <div className="rounded-lg border border-black/5 p-3 space-y-3" data-testid="calculadora-margem">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Quanto sobra no fim</p>
          <p className="text-2xs text-muted-foreground">Depois de custo, imposto e taxa de recebimento.</p>
        </div>
        {semaforo && margem !== null && (
          <span className={cn("rounded-md px-2 py-1 text-xs font-medium", ESTILO[semaforo].classe)}>
            {ESTILO[semaforo].rotulo}: {pct(margem)}
          </span>
        )}
      </div>

      {precoTabela > 0 ? (
        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-muted-foreground">Você fica com</p>
            <p className="font-medium">{formatCurrency(lucro)}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-muted-foreground">Desconto máximo</p>
            <p className="font-medium">{descMax === null ? "—" : pct(descMax)}</p>
            <p className="text-2xs text-muted-foreground">mantém a margem mínima de {pct(config.margemMinimaPct)}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-muted-foreground">Desconto que empata</p>
            <p className="font-medium">{descEmpate === null ? "—" : pct(descEmpate)}</p>
            <p className="text-2xs text-muted-foreground">acima disso você perde dinheiro</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Informe o valor da proposta para ver a margem.</p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1 w-[120px]">
          <Label className="text-2xs">Desconto (%)</Label>
          <NumberInput
            allowDecimal
            min={0}
            max={100}
            suffix="%"
            className="h-8 text-xs"
            disabled={disabled}
            value={paraTexto(sim.descontoPct)}
            onChange={(v) => set({ descontoPct: paraNumero(v) })}
          />
        </div>
        {sim.descontoPct > 0 && precoTabela > 0 && (
          <p className="text-xs text-muted-foreground pb-2">Valor com desconto: {formatCurrency(precoFinal)}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {sugerido === null ? (
          <span className="text-warning-strong">
            Margem, imposto e taxa somam 100% ou mais: não existe preço que feche a conta.
          </span>
        ) : (
          <>
            <span className="text-muted-foreground">
              Para {pct(sim.margemAlvoPct)} de margem, cobre {formatCurrency(sugerido)}.
            </span>
            {!disabled && (
              <Button type="button" variant="outline" size="xs" onClick={() => onAplicarPreco(sugerido)}>
                Usar este valor
              </Button>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        className="text-2xs text-ink underline underline-offset-2"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
      >
        {aberto ? "Ocultar parâmetros e conta" : "Ajustar parâmetros e ver a conta"}
      </button>

      {aberto && (
        <div className="space-y-3 border-t border-black/5 pt-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-2xs">Imposto (%)</Label>
              <NumberInput
                allowDecimal
                min={0}
                max={99}
                suffix="%"
                className="h-8 text-xs"
                disabled={disabled}
                value={paraTexto(sim.impostoPct)}
                onChange={(v) => set({ impostoPct: paraNumero(v) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-2xs">Meio de recebimento</Label>
              <Select value={meio?.id ?? ""} disabled={disabled} onValueChange={(v) => set({ meioId: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {config.meiosRecebimento.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-2xs">Parcelas</Label>
              <NumberInput
                min={1}
                max={24}
                className="h-8 text-xs"
                disabled={disabled || !temFaixas}
                value={String(sim.parcelas)}
                onChange={(v) => set({ parcelas: Math.max(1, parseInt(v, 10) || 1) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-2xs">Margem-alvo (%)</Label>
              <NumberInput
                allowDecimal
                min={0}
                max={99}
                suffix="%"
                className="h-8 text-xs"
                disabled={disabled}
                value={paraTexto(sim.margemAlvoPct)}
                onChange={(v) => set({ margemAlvoPct: paraNumero(v) })}
              />
            </div>
          </div>

          <p className="text-2xs text-muted-foreground">
            Conta: {formatCurrency(precoFinal)} − custo {formatCurrency(custo)} − imposto {pct(sim.impostoPct)} − taxa{" "}
            {pct(taxaPct)} = {formatCurrency(lucro)}. A taxa de cada meio é cadastrada por você, o Pilar não consulta a
            maquininha.
          </p>

          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              loading={salvandoPadrao}
              onClick={() => onSalvarPadrao(sim)}
            >
              Salvar imposto e margem-alvo como padrão da empresa
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
