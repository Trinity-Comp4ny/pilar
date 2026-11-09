import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { BusyMark } from "@/components/motion/BusyMark";

// Etapas reais do import (enviar → ler → estruturar). O Gemini structured output
// não emite progresso token a token, então avançamos por tempo: dá feedback
// honesto de atividade sem prometer streaming que a API não entrega.
const ETAPAS_IMPORT = ["Enviando o arquivo", "Lendo o orçamento com a IA", "Organizando os itens"];

/** Avança as etapas do import por tempo enquanto `pending` (setState só a partir de timers). */
export function useImportSteps(pending: boolean): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const t0 = setTimeout(() => setStep(0), 0);
    const t1 = setTimeout(() => setStep(1), 500);
    const t2 = setTimeout(() => setStep(2), 4000);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pending]);
  return step;
}

/** Lista de etapas do import com check/spinner (feedback de progresso da IA). */
export function ImportStepper({ step }: { step: number }) {
  return (
    <ol className="space-y-1.5 rounded-md bg-muted/40 p-3 text-sm">
      {ETAPAS_IMPORT.map((label, i) => {
        const feito = i < step;
        const atual = i === step;
        return (
          <li
            key={label}
            className={`flex items-center gap-2 ${feito || atual ? "text-ink" : "text-muted-foreground/50"}`}
          >
            {feito ? (
              <Check className="h-4 w-4 text-positive-strong" />
            ) : atual ? (
              <BusyMark className="h-4 w-4" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-current/30" />
            )}
            {label}
          </li>
        );
      })}
    </ol>
  );
}
