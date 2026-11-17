import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ReadingRing } from "@/components/motion/ReadingRing";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useConversaPortal,
  type EscopoConversa,
  type LadoConversa,
  type MensagemPortal,
} from "@/components/portal/useConversaPortal";

function horario(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return mesmoDia ? hora : `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}

function Balao({ m, lado }: { m: MensagemPortal; lado: LadoConversa }) {
  // O lado de quem olha fica à direita: o cliente vê as dele à direita, a equipe vê as do escritório.
  const direita = (lado === "cliente") === (m.autor_tipo === "cliente");
  const minha = m.minha;
  return (
    <li className={cn("flex flex-col gap-1", direita ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
          m.interna
            ? "border border-warning-soft-border bg-warning-soft text-ink"
            : direita
              ? "bg-brand text-ink"
              : "border border-border/60 bg-white text-ink"
        )}
      >
        {m.interna && (
          <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-warning-strong">
            <StickyNote className="h-3 w-3" /> Nota interna · só a equipe vê
          </p>
        )}
        {m.texto}
      </div>
      <span className="px-1 text-[11px] text-muted-foreground">
        {minha ? "Você" : m.autor_nome} · {horario(m.created_at)}
      </span>
    </li>
  );
}

interface ConversaPortalProps {
  lado: LadoConversa;
  escopo: EscopoConversa;
  /** Texto do estado vazio. */
  vazio?: string;
  /** Altura da lista; o painel lateral usa a tela toda. */
  className?: string;
  /** Conversa fechada (ex.: painel recolhido) não consulta nem marca como lida. */
  ativo?: boolean;
}

/**
 * Conversa do portal, a mesma para o cliente e para a equipe (BEZ-575). Aparece no painel
 * "Falar com o escritório", na aba Cliente do projeto/obra e no fio de cada solicitação.
 */
export function ConversaPortal({ lado, escopo, vazio, className, ativo = true }: ConversaPortalProps) {
  const { mensagens, enviar } = useConversaPortal(lado, escopo, ativo);
  const [texto, setTexto] = useState("");
  const [interna, setInterna] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const total = mensagens.data?.length ?? 0;

  useEffect(() => {
    fimRef.current?.scrollIntoView?.({ block: "end" });
  }, [total]);

  const enviarMensagem = () => {
    const conteudo = texto.trim();
    if (!conteudo || enviar.isPending) return;
    enviar.mutate(
      { texto: conteudo, interna: lado === "equipe" && interna },
      {
        onSuccess: () => {
          setTexto("");
          setInterna(false);
        },
        onError: () =>
          toast.error("Não foi possível enviar", {
            description: "Sua mensagem continua no campo. Tente de novo em instantes.",
          }),
      }
    );
  };

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="min-h-[8rem] flex-1 overflow-y-auto pr-1" role="log" aria-label="Mensagens">
        {mensagens.isLoading ? (
          <div className="flex justify-center py-8">
            <ReadingRing size={48} />
          </div>
        ) : mensagens.isError ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar a conversa agora. Ela atualiza sozinha em instantes.
          </p>
        ) : total === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma mensagem ainda"
            description={
              vazio ??
              (lado === "cliente"
                ? "Escreva aqui para falar com o escritório."
                : "Escreva aqui para falar com o cliente pelo portal.")
            }
          />
        ) : (
          <ul className="space-y-3">
            {(mensagens.data ?? []).map((m) => (
              <Balao key={m.id} m={m} lado={lado} />
            ))}
          </ul>
        )}
        <div ref={fimRef} />
      </div>

      <div className="space-y-2 border-t pt-3">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviarMensagem();
            }
          }}
          placeholder={interna ? "Nota interna (o cliente não vê)…" : "Escreva uma mensagem…"}
          aria-label="Mensagem"
          rows={2}
          maxLength={4000}
          className={cn("text-sm", interna && "border-warning-soft-border bg-warning-soft/40")}
        />
        <div className="flex items-center justify-between gap-3">
          {lado === "equipe" ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`interna-${escopo.entregaId ?? escopo.obraId ?? escopo.projetoId}`}
                checked={interna}
                onCheckedChange={(v) => setInterna(v === true)}
              />
              <Label
                htmlFor={`interna-${escopo.entregaId ?? escopo.obraId ?? escopo.projetoId}`}
                className="text-xs font-normal text-muted-foreground"
              >
                Nota interna (só a equipe vê)
              </Label>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">Enter envia · Shift+Enter quebra a linha</span>
          )}
          <Button
            size="sm"
            variant="brand"
            onClick={enviarMensagem}
            loading={enviar.isPending}
            disabled={!texto.trim()}
          >
            <Send className="mr-1.5 h-4 w-4" />
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
