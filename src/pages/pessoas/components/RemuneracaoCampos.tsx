import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/forms/MoneyInput";
import type { PessoaFormData, PessoaFormInput } from "@/schemas";

interface RemuneracaoCamposProps {
  form: UseFormReturn<PessoaFormInput, unknown, PessoaFormData>;
  isEstagio: boolean;
}

// Regras de remuneração da pessoa, que a folha soma: salário fixo + valor por m²
// + percentual sobre o valor dos projetos. Só aparece para quem vê folha.
export function RemuneracaoCampos({ form, isEstagio }: RemuneracaoCamposProps) {
  const erroPercentual = form.formState.errors.percentual_producao;
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="salario_fixo" className="text-xs">
          {isEstagio ? "Bolsa (R$)" : "Salário Fixo (R$)"}
        </Label>
        <MoneyInput
          id="salario_fixo"
          value={form.watch("salario_fixo") ?? ""}
          onChange={(v) => form.setValue("salario_fixo", v)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="valor_m2" className="text-xs">
          Valor m² (R$)
        </Label>
        <MoneyInput id="valor_m2" value={form.watch("valor_m2") ?? ""} onChange={(v) => form.setValue("valor_m2", v)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="percentual_producao" className="text-xs">
          % do valor do projeto
        </Label>
        <div className="relative">
          <Input
            id="percentual_producao"
            inputMode="decimal"
            placeholder="0"
            className="pr-7"
            aria-invalid={!!erroPercentual}
            {...form.register("percentual_producao")}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            %
          </span>
        </div>
        {erroPercentual && <p className="text-xs text-destructive">{erroPercentual.message}</p>}
      </div>
    </>
  );
}
