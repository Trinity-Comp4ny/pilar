import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Coins,
  FileText,
  Loader2,
  PenLine,
  Sparkles,
  Square,
  Wallet,
  FolderKanban,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgentInbox } from "@/pages/revisao-ia/useAgentRuns";
import { useAlertasNaoLidos } from "@/hooks/useAlertas";
import { RevisaoInbox } from "@/pages/revisao-ia/RevisaoInbox";
import { useChat } from "./useChat";
import { LeadConfirmationCard } from "./LeadConfirmationCard";
import { ProjetoConfirmationCard } from "./ProjetoConfirmationCard";
import { LancamentoCard } from "./LancamentoCard";
import { CartaoCard } from "./CartaoCard";
import { FolhaCard } from "./FolhaCard";
import { SimpleEntityCard } from "./SimpleEntityCard";
import { AditivoCard } from "./AditivoCard";
import { AcaoCard } from "./AcaoCard";

/** Domínios que o orquestrador roteia — refletem os agentes da edge function ai-chat. */
const DOMINIOS: { key: string; label: string; icon: LucideIcon; hint: string }[] = [
  { key: "financeiro", label: "Financeiro", icon: Wallet, hint: "receitas, despesas, lucro, caixa" },
  { key: "projetos", label: "Projetos", icon: Calendar, hint: "status, prazos, projetos ativos" },
  { key: "comercial", label: "Comercial", icon: FileText, hint: "propostas, leads, pipeline" },
];

const ICONE_DOMINIO: Record<string, LucideIcon> = {
  ...Object.fromEntries(DOMINIOS.map((d) => [d.key, d.icon])),
  geral: Sparkles,
};

function saudacao(nome?: string | null): string {
  const h = new Date().getHours();
  const periodo = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return nome ? `${periodo}, ${nome}` : periodo;
}

export default function ChatPage() {
  const { state, isMobile } = useSidebar();
  const left = isMobile ? "0px" : state === "collapsed" ? "64px" : "240px";
  const { profile } = useAuth();

  // Revisão IA fundida como aba. Só admin da empresa (ou ultra_admin) revisa —
  // preserva o gate ACH-ADM-01 que antes era o RequireRole da rota /revisao-ia.
  const podeRevisar = profile?.role === "admin" || profile?.role === "ultra_admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const [aba, setAba] = useState<"conversa" | "revisao">(() => {
    if (!podeRevisar) return "conversa";
    // Inbox-first (spec 007): a mesa de trabalho é a landing; ?tab=conversa força o chat.
    return searchParams.get("tab") === "conversa" ? "conversa" : "revisao";
  });
  // Badge = tudo que espera você: alertas do agente (não lidos) + orçamentos a revisar.
  const { data: pendentes } = useAgentInbox({ enabled: podeRevisar });
  const { data: alertasNaoLidos = 0 } = useAlertasNaoLidos();
  const totalPendentes = (pendentes?.length ?? 0) + (podeRevisar ? alertasNaoLidos : 0);

  const trocarAba = (nova: "conversa" | "revisao") => {
    setAba(nova);
    setSearchParams(nova === "conversa" ? { tab: "conversa" } : {}, { replace: true });
  };

  const {
    messages,
    send,
    stop,
    loading,
    reset,
    creditosUsados,
    saldo,
    confirmarDraft,
    cancelarDraft,
    desfazer,
    desfazerFolha,
    executarAcao,
    cancelarAcao,
  } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Projeto em foco (spec 007): escopa a conversa a um projeto real do escritório.
  const [projetoAtivo, setProjetoAtivo] = useState<string | null>(null);
  const { data: projetos = [] } = useQuery({
    queryKey: ["chat-projetos-lista"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projetos")
        .select("id, codigo_projeto, nome")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []).map((p) => ({
        id: p.id as string,
        label: (p.codigo_projeto as string) || (p.nome as string),
      }));
    },
  });

  // Hero do Início (spec 001): chega com a pergunta em location.state.prompt e envia
  // uma vez. O state é limpo em seguida para refresh/back não reenviarem.
  const location = useLocation();
  const navigate = useNavigate();
  const promptInicialEnviado = useRef(false);
  useEffect(() => {
    const prompt = (location.state as { prompt?: string } | null)?.prompt?.trim();
    if (!prompt || promptInicialEnviado.current) return;
    promptInicialEnviado.current = true;
    setAba("conversa"); // pergunta vinda do Início abre a conversa, não a fila
    send(prompt);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Só auto-rola quando o usuário já está perto do fim; senão, mostra o botão "descer".
  const pertoDoFimRef = useRef(true);
  const [mostrarDescer, setMostrarDescer] = useState(false);

  const aoRolar = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanciaDoFim = el.scrollHeight - el.scrollTop - el.clientHeight;
    const perto = distanciaDoFim < 120;
    pertoDoFimRef.current = perto;
    setMostrarDescer(!perto);
  };

  const descer = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    pertoDoFimRef.current = true;
    setMostrarDescer(false);
  };

  useEffect(() => {
    if (!pertoDoFimRef.current) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    send(input, projetoAtivo ?? undefined);
    setInput("");
  };

  // "Nova conversa" some com o histórico (e os botões de Desfazer). Confirma se já houve criação/ação.
  const handleReset = () => {
    const temCriados = messages.some((m) => m.draft?.status === "criado" || m.acao?.status === "feito");
    if (temCriados) {
      toast("Começar uma nova conversa?", {
        description: "O histórico atual e os atalhos de Desfazer somem daqui.",
        action: { label: "Nova conversa", onClick: reset },
      });
      return;
    }
    reset();
  };

  const vazio = messages.length === 0;
  const primeiroNome = profile?.first_name || profile?.nome?.split(" ")[0] || null;
  // Header some no herói vazio, mas reaparece na aba Revisão ou quando há pendências.
  // Quem revisa tem o toggle Conversa/Trabalho no header, então ele fica sempre visível
  // (inclusive no herói vazio). Quem não revisa mantém o herói limpo, sem header.
  const mostrarHeader = podeRevisar || !vazio || aba === "revisao";

  const inputPanel = (
    <InputPanel
      value={input}
      onChange={setInput}
      onSend={handleSend}
      onStop={stop}
      loading={loading}
      autoFocus={vazio}
      projetos={projetos}
      projetoAtivo={projetoAtivo}
      onProjeto={setProjetoAtivo}
    />
  );

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 flex flex-col bg-background transition-[left] duration-300 ease-in-out"
      style={{ left }}
    >
      {/* Cabeçalho — no herói vazio some para o input virar herói, mas reaparece
          quando a aba Revisão está ativa ou há pendências a mostrar. */}
      {mostrarHeader && (
        <header className="relative flex items-center gap-3 border-b border-border px-6 py-3.5">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-medium tracking-tight text-foreground">Agentes</h1>
          </div>

          {/* Toggle central Conversa/Trabalho (spec 007, inspirado no ChatGPT Chat/Work). */}
          {podeRevisar && (
            <div className="shrink-0">
              <div className="inline-flex rounded-full bg-black/5 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => trocarAba("revisao")}
                  aria-current={aba === "revisao" ? "page" : undefined}
                  className={cn(
                    "flex min-h-8 items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors",
                    aba === "revisao" ? "bg-brand text-ink" : "text-ink-soft hover:text-ink"
                  )}
                >
                  Trabalho
                  {totalPendentes > 0 && (
                    <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] leading-none">
                      {totalPendentes}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => trocarAba("conversa")}
                  aria-current={aba === "conversa" ? "page" : undefined}
                  className={cn(
                    "flex min-h-8 items-center rounded-full px-4 py-1.5 transition-colors",
                    aba === "conversa" ? "bg-brand text-ink" : "text-ink-soft hover:text-ink"
                  )}
                >
                  Conversa
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-1 items-center justify-end gap-2">
            {aba === "conversa" && (
              <>
                {saldo && (
                  <span
                    className="hidden lg:flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
                    title={`Créditos de IA restantes este mês (${saldo.usados} de ${saldo.limite} usados)`}
                  >
                    <Coins className="h-3.5 w-3.5" />
                    {saldo.restante} crédito{saldo.restante === 1 ? "" : "s"} restantes
                  </span>
                )}
                {creditosUsados > 0 && (
                  <span
                    className="hidden lg:flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
                    title="Créditos de IA debitados nesta conversa"
                  >
                    <Coins className="h-3.5 w-3.5" />
                    {creditosUsados} usado{creditosUsados === 1 ? "" : "s"} agora
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Nova conversa
                </button>
              </>
            )}
          </div>
        </header>
      )}

      {aba === "revisao" ? (
        /* ── Aba Revisão: fila persistente de trabalho aguardando aprovação ── */
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-7xl">
            <RevisaoInbox enabled={podeRevisar} />
          </div>
        </div>
      ) : vazio ? (
        /* ── Estado vazio: herói centralizado (padrão agent-first) ── */
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10">
          <div className="w-full max-w-2xl">
            <div className="mb-8 flex flex-col items-center text-center">
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-ink shadow-elegant">
                <Sparkles className="h-6 w-6" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{saudacao(primeiroNome)}</h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                3 agentes prontos: Financeiro, Projetos e Comercial. Pergunte em linguagem natural e eles consultam seus
                dados e respondem na hora.
              </p>
            </div>

            {inputPanel}
          </div>
        </div>
      ) : (
        /* ── Estado com conversa ── */
        <>
          <div ref={scrollRef} onScroll={aoRolar} className="flex-1 overflow-y-auto px-4 py-6">
            <div
              className="mx-auto flex max-w-2xl flex-col gap-5"
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {messages.map((m, i) => (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  {m.role === "assistant" ? (
                    <div className="flex max-w-[90%] gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand text-ink">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                      {m.draft ? (
                        (() => {
                          const cardProps = {
                            index: i,
                            draft: m.draft,
                            onConfirmar: confirmarDraft,
                            onCancelar: cancelarDraft,
                            onDesfazer: desfazer,
                          };
                          switch (m.draft.entidade) {
                            case "projeto":
                              return <ProjetoConfirmationCard {...cardProps} />;
                            case "receita":
                              return <LancamentoCard {...cardProps} tipo="receita" />;
                            case "despesa":
                              return <LancamentoCard {...cardProps} tipo="despesa" />;
                            case "cartao":
                              return <CartaoCard {...cardProps} />;
                            case "folha":
                              return (
                                <FolhaCard
                                  draft={m.draft}
                                  onConfirmar={confirmarDraft}
                                  onCancelar={cancelarDraft}
                                  onDesfazerFolha={desfazerFolha}
                                />
                              );
                            case "cliente":
                            case "fornecedor":
                            case "categoria":
                            case "conta":
                            case "centro_custo":
                            case "pessoa":
                            case "proposta":
                            case "marco":
                            case "disciplina":
                              return <SimpleEntityCard {...cardProps} entidade={m.draft.entidade} />;
                            case "aditivo":
                              return <AditivoCard {...cardProps} />;
                            default:
                              return <LeadConfirmationCard {...cardProps} />;
                          }
                        })()
                      ) : m.acao ? (
                        <AcaoCard index={i} acao={m.acao} onExecutar={executarAcao} onCancelar={cancelarAcao} />
                      ) : (
                        <div
                          className={cn(
                            "rounded-2xl rounded-tl-sm border px-4 py-2.5 text-sm",
                            m.erro
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-border bg-card text-foreground"
                          )}
                        >
                          {m.agentes?.[0] &&
                            (() => {
                              const meta = m.agentes[0];
                              const Icon = ICONE_DOMINIO[meta.agente] ?? Sparkles;
                              const label = meta.agente_label.replace(/^\p{Emoji}+\s*/u, "");
                              return (
                                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <Icon className="h-3.5 w-3.5" />
                                  {label}
                                </div>
                              );
                            })()}
                          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm text-ink">
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex max-w-[90%] gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand text-ink">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground"
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span>Orquestrador roteando · agentes trabalhando…</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="relative mx-auto max-w-2xl">
              {mostrarDescer && (
                <button
                  type="button"
                  onClick={descer}
                  className="absolute -top-14 left-1/2 flex h-11 min-w-11 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card px-3 text-muted-foreground shadow-elegant transition-colors hover:bg-muted"
                  aria-label="Descer para a mensagem mais recente"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              )}
              {inputPanel}
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Os agentes respondem e executam ações com sua confirmação. Confira os valores antes de aprovar.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Caixa de input com toolbar interna (padrão agent-first). Reutilizada nos dois estados. */
function InputPanel({
  value,
  onChange,
  onSend,
  onStop,
  loading,
  autoFocus,
  projetos,
  projetoAtivo,
  onProjeto,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  autoFocus?: boolean;
  projetos: { id: string; label: string }[];
  projetoAtivo: string | null;
  onProjeto: (id: string | null) => void;
}) {
  const podeEnviar = value.trim().length > 0 && !loading;
  const projetoLabel = projetos.find((p) => p.id === projetoAtivo)?.label;
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize: a caixa cresce com as linhas até ~160px e só então rola (não fica engessada).
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-elegant transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={projetoLabel ? `Pergunte sobre ${projetoLabel}…` : "Pergunte alguma coisa…"}
        aria-label="Mensagem para os agentes"
        rows={1}
        autoFocus={autoFocus}
        className="max-h-40 min-h-[24px] w-full resize-none overflow-y-auto bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
        <div className="flex items-center gap-2 min-w-0">
          {/* Escolher projeto: escopa a conversa a um projeto real (spec 007). */}
          {projetoAtivo ? (
            <span className="flex items-center gap-1.5 rounded-full bg-brand/15 pl-2.5 pr-1 py-1 text-xs text-ink">
              <FolderKanban className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[160px]">{projetoLabel}</span>
              <button
                type="button"
                onClick={() => onProjeto(null)}
                aria-label="Remover projeto em foco"
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full hover:bg-black/10"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <>
              <Select value="" onValueChange={(v) => onProjeto(v || null)}>
                <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full border-black/10 px-3 text-xs text-ink-soft">
                  <FolderKanban className="h-3.5 w-3.5" />
                  <SelectValue placeholder="Escolher projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projetos.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-ink-muted">Nenhum projeto</div>
                  ) : (
                    projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <span className="hidden md:inline text-xs text-ink-muted">
                escolha um projeto para os agentes focarem nele
              </span>
            </>
          )}
        </div>
        {loading ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Parar geração"
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-ink transition-opacity hover:opacity-90"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!podeEnviar}
            aria-label="Enviar"
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
