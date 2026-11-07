import { cn } from "@/lib/utils";

type Opcao = { value: string; label: string };

const CHIP =
  "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-50";
const ATIVO = "border-transparent bg-ink font-medium text-background";
const INATIVO = "border-black/10 bg-background text-ink-soft hover:border-black/20 hover:text-ink";

type Comum = {
  opcoes: readonly Opcao[];
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Escolha em chips para formulário curto (SPEC 149): poucas opções, todas à
 * vista, um toque para marcar. `multiplo` vira lista de botões alternáveis;
 * sem ele é um radiogroup de escolha única. Quebra linha (é formulário, não
 * barra de filtro).
 */
export function EscolhaChips(
  props: Comum &
    (
      | { multiplo?: false; value: string | null; onChange: (v: string) => void }
      | {
          multiplo: true;
          value: string[];
          onChange: (v: string[]) => void;
        }
    )
) {
  const { opcoes, ariaLabel, disabled, className } = props;

  if (props.multiplo) {
    const marcados = props.value;
    const alternar = (v: string) =>
      props.onChange(marcados.includes(v) ? marcados.filter((m) => m !== v) : [...marcados, v]);
    return (
      <div role="group" aria-label={ariaLabel} className={cn("flex flex-wrap gap-1.5", className)}>
        {opcoes.map((o) => {
          const ativo = marcados.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={ativo}
              disabled={disabled}
              onClick={() => alternar(o.value)}
              className={cn(CHIP, ativo ? ATIVO : INATIVO)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  const { value, onChange } = props;
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex flex-wrap gap-1.5", className)}>
      {opcoes.map((o) => {
        const ativo = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={ativo}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(CHIP, ativo ? ATIVO : INATIVO)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
