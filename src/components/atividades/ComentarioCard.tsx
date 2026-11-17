import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { segmentarMencoes } from "@/lib/mencoes";
import { PerfilPessoaPopover } from "./PerfilPessoaPopover";

export interface ComentarioExibido {
  id: string;
  texto: string;
  autor: string;
  autorId?: string;
  data: string;
  mencionados?: string[];
}

interface ComentarioCardProps {
  comentario: ComentarioExibido;
  pessoas: { id: string; nome: string }[];
  /** Comentário de destino de um link (notificação): rola até ele e destaca. */
  destacado?: boolean;
  /**
   * Apaga o comentário. Só passe quando o usuário pode apagar este comentário
   * (admin/coordenador qualquer um; demais só os próprios, ver `useComentarioAutoria`).
   */
  onExcluir?: () => void | Promise<void>;
}

/**
 * Um comentário das Atividades (projeto, disciplina, tarefa). "@Nome" de quem foi
 * mencionado fica verde, como no composer, e abre o perfil da pessoa (spec 103). "@all" também
 * fica verde (SPEC 132), sem perfil para abrir.
 */
export function ComentarioCard({ comentario, pessoas, destacado, onExcluir }: ComentarioCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const excluir = async () => {
    if (!onExcluir) return;
    setExcluindo(true);
    try {
      await onExcluir();
      setConfirmando(false);
    } finally {
      setExcluindo(false);
    }
  };

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
        "group relative rounded-lg border bg-background p-3 text-sm shadow-sm transition-[border-color,box-shadow] duration-slow",
        realce && "border-brand ring-2 ring-brand/30"
      )}
    >
      {onExcluir && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          onClick={() => setConfirmando(true)}
          aria-label="Apagar comentário"
          title="Apagar comentário"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
      <p className={cn("whitespace-pre-wrap text-foreground", onExcluir && "pr-6")}>
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
          ) : seg.todos ? (
            <span key={i} className="rounded bg-brand/25 px-0.5 font-medium text-foreground">
              {seg.texto}
            </span>
          ) : (
            <span key={i}>{seg.texto}</span>
          )
        )}
      </p>
      <div className="mt-1.5 flex justify-between text-3xs text-muted-foreground">
        <span>{comentario.autor}</span>
        <span>{formatDateTime(comentario.data)}</span>
      </div>
      {onExcluir && (
        <ConfirmDialog
          open={confirmando}
          onOpenChange={(open) => !excluindo && setConfirmando(open)}
          onConfirm={excluir}
          title="Apagar comentário?"
          description="O comentário sai das atividades para todos. Não dá para desfazer."
          itemName={comentario.texto.length > 80 ? `${comentario.texto.slice(0, 80)}…` : comentario.texto}
          confirmText="Apagar"
          loading={excluindo}
        />
      )}
    </div>
  );
}
