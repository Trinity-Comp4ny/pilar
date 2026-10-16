import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, CheckCircle2, MessageCircle, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormDialog } from "@/components/FormDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDecidirAcao } from "../hooks";
import { ehLinkExterno, linkWhatsApp, rotuloDoLink, type Decisao } from "../lib";

const AGENTE_LABEL: Record<Decisao["agente"], string> = {
  chefe: "Chefe",
  receita: "Receita",
  clientes: "Clientes",
  marketing: "Marketing",
  produto: "Produto",
  qualidade: "Qualidade",
  financas: "Finanças",
};

/**
 * Fila de decisões: cada linha diz o que houve, a evidência e a próxima ação. O
 * WhatsApp abre com o texto pronto; quem envia é você (nível N1, ADR 0060). Ação gravada
 * por agente ainda pode ser editada, marcada como enviada ou descartada.
 */
export function ListaDecisoes({
  decisoes,
  mostrarAgente = false,
  vazio = "Nada esperando você agora.",
}: {
  decisoes: Decisao[];
  mostrarAgente?: boolean;
  vazio?: string;
}) {
  // Texto editado por ação, ainda não enviado: o link do WhatsApp já usa a versão editada.
  const [editados, setEditados] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<Decisao | null>(null);
  const [rascunho, setRascunho] = useState("");
  const decidir = useDecidirAcao();
  const navigate = useNavigate();

  if (decisoes.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-soft" role="status">
        <CheckCircle2 size={16} className="text-positive-strong" />
        {vazio}
      </div>
    );
  }

  const textoAtual = (d: Decisao) => (d.acao ? (editados[d.acao.id] ?? d.acao.texto) : "");

  return (
    <>
      <ul className="divide-y divide-black/5">
        {decisoes.map((d) => {
          const acao = d.acao;
          const texto = textoAtual(d);
          const whatsapp = acao?.canal === "whatsapp" ? linkWhatsApp(acao.telefone, texto) : d.whatsapp;
          const ocupado = decidir.isPending && decidir.variables?.acaoId === acao?.id;
          return (
            <li key={d.id} className="flex flex-col gap-2 py-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm text-ink">
                  {mostrarAgente && (
                    <span className="mr-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                      {AGENTE_LABEL[d.agente]}
                    </span>
                  )}
                  {d.titulo}
                </p>
                <p className="text-xs text-ink-muted">{d.detalhe}</p>
                {acao?.canal === "whatsapp" && texto && (
                  <div className="rounded-lg bg-muted/60 px-3 py-2">
                    <p className="line-clamp-3 text-xs text-ink-soft">{texto}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {whatsapp && (
                  <Button asChild size="sm" variant="brand">
                    <a href={whatsapp} target="_blank" rel="noreferrer">
                      <MessageCircle size={14} />
                      Abrir no WhatsApp
                    </a>
                  </Button>
                )}
                {acao ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={ocupado && decidir.variables?.decisao === "enviada"}
                      onClick={() =>
                        decidir.mutate({
                          acaoId: acao.id,
                          decisao: "enviada",
                          texto: editados[acao.id] ?? null,
                        })
                      }
                    >
                      <Check size={14} />
                      {acao.canal === "whatsapp" ? "Marcar como enviada" : "Feito"}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-full p-0"
                          aria-label={`Mais ações: ${d.titulo}`}
                        >
                          <MoreHorizontal size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {acao.canal === "whatsapp" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setRascunho(texto);
                              setEditando(d);
                            }}
                          >
                            Editar mensagem
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            ehLinkExterno(d.link)
                              ? window.open(d.link, "_blank", "noopener,noreferrer")
                              : navigate(d.link)
                          }
                        >
                          {rotuloDoLink(d.link)}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => decidir.mutate({ acaoId: acao.id, decisao: "descartada" })}
                        >
                          Descartar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <Button asChild size="sm" variant="outline">
                    {ehLinkExterno(d.link) ? (
                      <a href={d.link} target="_blank" rel="noopener noreferrer">
                        {rotuloDoLink(d.link)}
                      </a>
                    ) : (
                      <Link to={d.link}>{rotuloDoLink(d.link)}</Link>
                    )}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <FormDialog
        open={editando !== null}
        onOpenChange={(aberto) => !aberto && setEditando(null)}
        title="Editar mensagem"
        description={editando?.titulo}
        submitLabel="Usar este texto"
        submitDisabled={!rascunho.trim()}
        onSubmit={() => {
          const id = editando?.acao?.id;
          if (id) setEditados((m) => ({ ...m, [id]: rascunho.trim() }));
          setEditando(null);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="texto-acao">Texto que vai no WhatsApp</Label>
          <Textarea
            id="texto-acao"
            rows={6}
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            maxLength={700}
          />
          <p className="text-xs text-ink-muted">O envio continua com você: o botão abre a conversa com este texto.</p>
        </div>
      </FormDialog>
    </>
  );
}
