import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Caixa opcional de análise de uso, ao lado do aceite dos Termos (cadastro e primeiro acesso).
 * Separada de propósito: consentimento tem de ser específico e nunca condição para criar a conta
 * (LGPD). Começa desmarcada.
 */
export function AnaliseOptIn({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id="analise-opt-in"
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5 data-[state=checked]:bg-brand data-[state=checked]:border-brand data-[state=checked]:text-ink"
      />
      <label
        htmlFor="analise-opt-in"
        className="cursor-pointer select-none text-sm font-normal leading-snug text-ink-soft"
      >
        Opcional: posso medir como uso a Pilar (telas e cliques, nunca nomes, valores ou documentos), para melhorar o
        produto.{" "}
        <Link
          to="/privacidade"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline underline-offset-2"
        >
          Saiba mais
        </Link>
      </label>
    </div>
  );
}
