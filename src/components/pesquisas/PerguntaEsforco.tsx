import { ThumbsDown, ThumbsUp, X } from "lucide-react";
import { toast } from "sonner";
import { gravarResposta } from "@/lib/pesquisasApi";

/** Toast da pergunta de esforço (SPEC 156). */
export function PerguntaEsforco({ id, fluxo, rota }: { id: string | number; fluxo: string; rota: string }) {
  const responder = (nota: 0 | 1 | null) => {
    void gravarResposta({ tipo: "ces", nota, fluxo, rota });
    toast.dismiss(id);
    if (nota !== null) toast.success(nota === 1 ? "Obrigado!" : "Obrigado. Vamos olhar esse fluxo.");
  };
  return (
    <div className="flex w-[340px] max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-black/10 bg-surface-card p-3 text-sm text-ink shadow-elegant">
      <span className="flex-1">Foi fácil fazer isso no Pilar?</span>
      <button
        type="button"
        aria-label="Foi fácil"
        onClick={() => responder(1)}
        className="rounded-full p-2 text-ink-soft transition-colors hover:bg-positive/10 hover:text-positive-strong"
      >
        <ThumbsUp size={16} />
      </button>
      <button
        type="button"
        aria-label="Não foi fácil"
        onClick={() => responder(0)}
        className="rounded-full p-2 text-ink-soft transition-colors hover:bg-danger-soft hover:text-danger-strong"
      >
        <ThumbsDown size={16} />
      </button>
      <button
        type="button"
        aria-label="Dispensar pergunta"
        onClick={() => responder(null)}
        className="rounded-full p-1 text-ink-muted hover:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}
