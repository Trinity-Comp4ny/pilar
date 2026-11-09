import { useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { ArrowUp, AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { idsMencionados, segmentarMencoes } from "@/lib/mencoes";
import { usePessoasSemConta } from "../hooks/usePessoasSemConta";

const TODOS_ID = "__todos__";

interface AtividadeComposerProps {
  pessoas: { id: string; nome: string }[];
  onSubmit: (texto: string, mencionados: string[]) => void;
  placeholder?: string;
}

/**
 * Caixa de escrever atividade no padrão do chat de Agentes: textarea sem moldura
 * dentro de uma caixa arredondada, botão @ para mencionar e botão de enviar (seta,
 * verde da marca). Enter envia; Shift+Enter quebra linha. (spec 013)
 *
 * Digitar "@" no meio do texto já abre a lista de pessoas filtrada pelo que vem
 * depois (sem precisar clicar no botão); o botão @ continua como atalho que abre
 * a lista completa na posição do cursor.
 */
export function AtividadeComposer({ pessoas, onSubmit, placeholder }: AtividadeComposerProps) {
  const [texto, setTexto] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const segmentos = useMemo(() => segmentarMencoes(texto, pessoas), [texto, pessoas]);

  const mentionOpen = mentionStart !== null;
  const semConta = usePessoasSemConta();
  const consulta = mentionQuery.toLowerCase();
  const sugestoes = mentionOpen
    ? [
        ...("all".startsWith(consulta) || "todos".startsWith(consulta) ? [{ id: TODOS_ID, nome: "all" }] : []),
        ...pessoas.filter((p) => p.nome.toLowerCase().includes(consulta)),
      ]
    : [];
  // A fonte da verdade é o texto: marcar pelo menu ou digitar o nome inteiro dá no mesmo.
  const marcadas = useMemo(() => idsMencionados(texto, pessoas), [texto, pessoas]);
  const semAviso = pessoas.filter((p) => marcadas.includes(p.id) && semConta.has(p.id));

  const fecharMencao = () => {
    setMentionStart(null);
    setMentionQuery("");
    setHighlight(0);
  };

  const detectarMencao = (value: string, cursor: number) => {
    const antesDoCursor = value.slice(0, cursor);
    const arroba = antesDoCursor.lastIndexOf("@");
    const resto = arroba === -1 ? "" : antesDoCursor.slice(arroba + 1);
    // Espaço só fecha o menu quando o que veio depois do @ deixa de ser começo de nome
    // ("@Maria S" ainda é Maria Silva; "@Maria e" já é frase).
    const continuaNome = pessoas.some((p) => p.nome.toLowerCase().startsWith(resto.toLowerCase()));
    if (arroba === -1 || (/\s/.test(resto) && !continuaNome)) {
      fecharMencao();
      return;
    }
    setMentionStart(arroba);
    setMentionQuery(resto);
    setHighlight(0);
  };

  const marcar = (id: string) => {
    const p = id === TODOS_ID ? { id, nome: "all" } : pessoas.find((x) => x.id === id);
    if (!p) return;
    const cursor = textareaRef.current?.selectionStart ?? texto.length;
    const inicio = mentionStart ?? cursor;
    const antes = texto.slice(0, inicio);
    const depois = texto.slice(cursor);
    const novoTexto = `${antes}@${p.nome} ${depois}`;
    setTexto(novoTexto);
    fecharMencao();
    const novaPos = antes.length + p.nome.length + 2;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(novaPos, novaPos);
    });
  };

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    onSubmit(t, idsMencionados(t, pessoas));
    setTexto("");
    fecharMencao();
  };

  return (
    <div>
      <div className="rounded-xl border border-border bg-card transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
        <Popover open={mentionOpen && sugestoes.length > 0}>
          <PopoverAnchor asChild>
            <div className="relative">
              <div
                ref={backdropRef}
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre-wrap wrap-break-word px-3 py-2 text-sm text-transparent"
              >
                {segmentos.map((seg, i) =>
                  seg.pessoaId || seg.todos ? (
                    <span key={i} className="rounded bg-brand/25 box-decoration-clone">
                      {seg.texto}
                    </span>
                  ) : (
                    <span key={i}>{seg.texto}</span>
                  )
                )}
              </div>
              <Textarea
                ref={textareaRef}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  detectarMencao(e.target.value, e.target.selectionStart);
                }}
                onScroll={(e) => {
                  if (backdropRef.current) {
                    backdropRef.current.scrollTop = e.currentTarget.scrollTop;
                    backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
                onKeyDown={(e) => {
                  if (mentionOpen && sugestoes.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlight((h) => (h + 1) % sugestoes.length);
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlight((h) => (h - 1 + sugestoes.length) % sugestoes.length);
                      return;
                    }
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      marcar(sugestoes[highlight].id);
                      return;
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      fecharMencao();
                      return;
                    }
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                rows={2}
                placeholder={placeholder ?? "Escrever um comentário..."}
                className="relative z-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="max-h-64 w-56 overflow-y-auto p-1"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {sugestoes.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => marcar(p.id)}
                className={cn(
                  "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-foreground",
                  i === highlight ? "bg-muted" : "hover:bg-muted"
                )}
              >
                {p.id === TODOS_ID ? (
                  <>
                    @all <span className="ml-1 text-xs text-muted-foreground">todos da empresa</span>
                  </>
                ) : (
                  p.nome
                )}
                {semConta.has(p.id) && <span className="ml-auto text-[10px] text-muted-foreground">sem acesso</span>}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-1 px-2 pb-2">
          <button
            type="button"
            onClick={() => {
              const cursor = textareaRef.current?.selectionStart ?? texto.length;
              setMentionStart(cursor);
              setMentionQuery("");
              setHighlight(0);
              textareaRef.current?.focus();
            }}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Mencionar alguém"
          >
            <AtSign className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={enviar}
            disabled={!texto.trim()}
            aria-label="Enviar"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
      {semAviso.length > 0 && (
        <p role="status" className="mt-1.5 px-1 text-xs text-muted-foreground">
          {semAviso.map((p) => p.nome).join(", ")}{" "}
          {semAviso.length > 1 ? "não têm conta e não recebem" : "não tem conta e não recebe"} o aviso.
        </p>
      )}
    </div>
  );
}
