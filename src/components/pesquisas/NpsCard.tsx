import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { podeMostrarNps } from "@/lib/pesquisas";
import { gravarResposta, minhasRespostas } from "@/lib/pesquisasApi";
import { cn } from "@/lib/utils";

const ESPERA_MS = 20_000;
const NOTAS = Array.from({ length: 11 }, (_, i) => i);

/**
 * NPS dentro do app (SPEC 156). Card no canto, sem bloquear a tela, só no Início e depois de a
 * pessoa ficar 20 s por lá; 14 dias de conta no mínimo e no máximo uma vez a cada 90 dias.
 * Fechar conta como resposta "dispensou" e respeita o mesmo intervalo.
 */
export function NpsCard() {
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  const [pronto, setPronto] = useState(false);
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [encerrado, setEncerrado] = useState<"nao" | "obrigado" | "fechado">("nao");

  const noInicio = pathname === "/inicio";
  const contaCriadaEm = (profile as { created_at?: string | null } | null)?.created_at ?? null;

  const respostas = useQuery({
    queryKey: ["minhas-pesquisas", user?.id],
    queryFn: () => minhasRespostas(user!.id),
    enabled: !!user && noInicio,
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (!noInicio) return;
    const t = window.setTimeout(() => setPronto(true), ESPERA_MS);
    return () => window.clearTimeout(t);
  }, [noInicio]);

  const elegivel = respostas.data ? podeMostrarNps(contaCriadaEm, respostas.data, respostas.dataUpdatedAt) : false;
  if (encerrado === "fechado" || !pronto || !elegivel || (!noInicio && encerrado === "nao")) return null;

  if (encerrado === "obrigado") {
    return (
      <div
        role="status"
        className="fixed bottom-32 right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-black/10 bg-surface-card p-4 text-sm text-ink shadow-elegant"
      >
        Obrigado. Sua resposta chega direto ao time do Pilar.
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => setEncerrado("fechado")}
          className="float-right text-ink-muted hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  const dispensar = () => {
    void gravarResposta({ tipo: "nps", nota: null, rota: pathname });
    setEncerrado("fechado");
  };

  const enviar = () => {
    if (nota === null) return;
    void gravarResposta({ tipo: "nps", nota, comentario, rota: pathname });
    setEncerrado("obrigado");
  };

  return (
    <section
      aria-label="Pesquisa de satisfação"
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-black/10 bg-surface-card p-4 shadow-elegant md:bottom-32"
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm font-medium text-ink">
          De 0 a 10, quanto você recomendaria o Pilar a um colega de outro escritório?
        </p>
        <button type="button" aria-label="Agora não" onClick={dispensar} className="text-ink-muted hover:text-ink">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label="Nota de 0 a 10">
        {NOTAS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={nota === n}
            onClick={() => setNota(n)}
            className={cn(
              "h-8 rounded-md border text-xs font-medium transition-colors",
              nota === n ? "border-ink bg-ink text-white" : "border-black/10 text-ink hover:bg-muted"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-ink-muted">
        <span>Nada provável</span>
        <span>Muito provável</span>
      </div>
      {nota !== null && (
        <>
          <Textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="O que mais pesou na sua nota? (opcional)"
            rows={2}
            maxLength={1000}
            aria-label="Comentário"
          />
          <Button variant="brand" size="sm" className="w-full" onClick={enviar}>
            Enviar
          </Button>
        </>
      )}
    </section>
  );
}
