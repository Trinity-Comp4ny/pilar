import { HardHat } from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/usePageTitle";

/**
 * Módulo Obras — página "Em breve" (spec 001-shell-3-pilares, req. 7).
 * Sem chamadas de rede: só o shell. O interesse é registrado quando o módulo
 * tiver fila própria; por ora o CTA confirma e orienta.
 */
export default function Obras() {
  usePageTitle("Obras");

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.06em] text-black/55">
        <HardHat size={12} /> Em breve
      </span>

      <h1 className="text-2xl font-semibold tracking-tight text-ink mt-4 mb-3 text-balance">
        Saiba o que vai parar sua obra antes que ela pare
      </h1>
      <p className="text-[15px] leading-relaxed text-black/60 mb-7 max-w-[56ch]">
        O módulo Obras conecta o planejamento das próximas semanas com material, equipe e fornecedor, e avisa com
        antecedência o que precisa ser resolvido hoje para o trabalho não parar depois.
      </p>

      <ul className="flex flex-col gap-2.5 mb-8">
        {[
          "Planejamento das frentes de trabalho das próximas 3 a 6 semanas",
          "Prontidão de cada atividade: material, equipe e liberações no prazo",
          "Visão simples para a equipe de campo acompanhar e reportar",
        ].map((item) => (
          <li
            key={item}
            className="flex items-baseline gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-ink/85"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand relative -top-px" />
            {item}
          </li>
        ))}
      </ul>

      <button
        onClick={() =>
          toast.success("Interesse registrado", {
            description: "Você recebe um aviso quando o módulo Obras abrir.",
          })
        }
        className="rounded-full bg-brand px-5 py-2.5 text-[13.5px] font-medium text-ink hover:opacity-90 transition-opacity"
      >
        Me avise quando lançar
      </button>
    </div>
  );
}
