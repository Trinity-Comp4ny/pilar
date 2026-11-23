import { formatCurrency } from "@/lib/format";

interface SomaDisciplinasAvisoProps {
  totalValor: number;
  diverge: boolean;
  onUsarSoma: () => void;
}

/** Soma das disciplinas sob o valor da proposta, com atalho quando o valor digitado diverge. */
export function SomaDisciplinasAviso({ totalValor, diverge, onUsarSoma }: SomaDisciplinasAvisoProps) {
  if (totalValor <= 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 -mt-2 text-2xs text-muted-foreground">
      <span>Soma das disciplinas: {formatCurrency(totalValor)}</span>
      {diverge && (
        <>
          <span className="text-warning-mid">difere do valor digitado</span>
          <button type="button" className="text-ink underline underline-offset-2" onClick={onUsarSoma}>
            usar a soma
          </button>
        </>
      )}
    </div>
  );
}
