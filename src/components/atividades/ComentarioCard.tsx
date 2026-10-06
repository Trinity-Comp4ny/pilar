import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { segmentarMencoes } from "@/lib/mencoes";
import { PerfilPessoaPopover } from "./PerfilPessoaPopover";

export interface ComentarioExibido {
  id: string;
  texto: string;
  autor: string;
  data: string;
  mencionados?: string[];
}

interface ComentarioCardProps {
  comentario: ComentarioExibido;
  pessoas: { id: string; nome: string }[];
  /** Comentário de destino de um link (notificação): rola até ele e destaca. */
  destacado?: boolean;
}

/**
 * Um comentário das Atividades (projeto, disciplina, tarefa). "@Nome" de quem foi
 * mencionado fica verde, como no composer, e abre o perfil da pessoa (spec 103).
 */
export function ComentarioCard({ comentario, pessoas, destacado }: ComentarioCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Só quem está em `mencionados` vira chip: um "@" digitado sem escolher da lista
  // continua texto comum, como no composer.
  const segmentos = useMemo(() => {
    const ids = new Set(comentario.mencionados ?? []);
    const mencionadas = pessoas.filter((p) => ids.has(p.id));
    return segmentarMencoes(comentario.texto, mencionadas);
  }, [comentario.texto, comentario.mencionados, pessoas]);

  const [realce, setRealce] = useState(!!destacado);

  useEffect(() => {
    if (!destacado) return;
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setRealce(false), 4000);
    return () => clearTimeout(t);
  }, [destacado]);

  return (
    <div
      ref={ref}
      data-comentario-id={comentario.id}
      className={cn(
        "rounded-lg border bg-background p-3 text-sm shadow-sm transition-[border-color,box-shadow] duration-slow",
        realce && "border-brand ring-2 ring-brand/30"
      )}
    >
      <p className="whitespace-pre-wrap text-foreground">
        {segmentos.map((seg, i) =>
          seg.pessoaId ? (
            <PerfilPessoaPopover key={i} pessoaId={seg.pessoaId}>
              <button
                type="button"
                className="rounded bg-brand/25 px-0.5 font-medium text-foreground transition-colors hover:bg-brand/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                {seg.texto}
              </button>
            </PerfilPessoaPopover>
          ) : (
            <span key={i}>{seg.texto}</span>
          )
        )}
      </p>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{comentario.autor}</span>
        <span>{formatDateTime(comentario.data)}</span>
      </div>
    </div>
  );
}
