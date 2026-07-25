import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Coins,
  FileText,
  Inbox,
  Loader2,
  MessageSquare,
  PenLine,
  ShieldCheck,
  Sparkles,
  Square,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { isContractRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { useAgentInbox } from "@/pages/revisao-ia/useAgentRuns";
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

/** Sugestões agrupadas por domínio — ensinam o que dá pra perguntar. */
const SUGESTOES: { dominio: string; texto: string }[] = [
  { dominio: "financeiro", texto: "Quanto recebi esse mês?" },
  { dominio: "projetos", texto: "Quantos projetos ativos eu tenho?" },
  { dominio: "comercial", texto: "Cadastrar lead: João da Construtora X, (11) 99999-0000, indicação" },
  { dominio: "projetos", texto: "Criar projeto estrutural para a Construtora X, R$ 80 mil" },
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

  // Revisão IA fundida como aba. Só owner (ou papéis legados) revisa — preserva
  // o gate ACH-ADM-01 que antes era o RequireRole da rota /revisao-ia.
  const role = useRole();
  const podeRevisar = !isContractRole(role) || role === "owner";
  const [searchParams, setSearchParams] = useSearchParams();
  const [aba, setAba] = useState<"conversa" | "revisao">(
    podeRevisar && searchParams.get("tab") === "revisao" ? "revisao" : "conversa"
  );
  const { data: pendentes } = useAgentInbox({ enabled: podeRevisar });
  const totalPendentes = pendentes?.length ?? 0;

  const trocarAba = (nova: "conversa" | "revisao") => {
    setAba(nova);
    setSearchParams(nova === "revisao" ? { tab: "revisao" } : {}, { replace: true });
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

  // Hero do Início (spec 001): chega com a pergunta em location.state.prompt e envia
  // uma vez. O state é limpo em seguida para refresh/back não reenviarem.
  const location = useLocation();
  const navigate = useNavigate();
  const promptInicialEnviado = useRef(false);
  useEffect(() => {
    const prompt = (location.state as { prompt?: string } | null)?.prompt?.trim();
    if (!prompt || promptInicialEnviado.current) return;
    promptInicialEnviado.current = true;
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
    send(input);
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
  const mostrarHeader = !vazio || aba === "revisao" || (podeRevisar && totalPendentes > 0);

  const inputPanel = (
    <InputPanel
      value={input}
      onChange={setInput}
      onSend={handleSend}
      onStop={stop}
      loading={loading}
      autoFocus={vazio}
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
        <header className="flex items-center gap-3 border-b border-border px-6 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-ink">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold leading-none text-foreground">
              {aba === "revisao" ? "Revisão da IA" : "Agentes"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {aba === "revisao"
                ? "Trabalho gerado por agentes, aguardando sua aprovação"
                : "Pergunte ou peça uma ação · nada grava sem você confirmar"}
            </p>
          </div>

          {podeRevisar && (
            <div className="inline-flex rounded-full bg-muted p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => trocarAba("conversa")}
                aria-current={aba === "conversa" ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                  aba === "conversa" ? "bg-brand text-ink" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Conversa
              </button>
              <button
                type="button"
                onClick={() => trocarAba("revisao")}
                aria-current={aba === "revisao" ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                  aba === "revisao" ? "bg-brand text-ink" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Inbox className="h-3.5 w-3.5" />
                Revisão
                {totalPendentes > 0 && (
                  <span className="ml-0.5 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] leading-none">
                    {totalPendentes}
                  </span>
                )}
              </button>
            </div>
          )}

          {aba === "conversa" && (
            <>
              {saldo && (
                <span
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
                  title={`Créditos de IA restantes este mês (${saldo.usados} de ${saldo.limite} usados)`}
                >
                  <Coins className="h-3.5 w-3.5" />
                  {saldo.restante} crédito{saldo.restante === 1 ? "" : "s"} restantes
                </span>
              )}
              {creditosUsados > 0 && (
                <span
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
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
        </header>
      )}

      {aba === "revisao" ? (
        /* ── Aba Revisão: fila persistente de trabalho aguardando aprovação ── */
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-2xl">
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

            {/* Sugestões */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGESTOES.map((s) => {
                const Icon = ICONE_DOMINIO[s.dominio];
                return (
                  <button
                    key={s.texto}
                    type="button"
                    onClick={() => send(s.texto)}
                    className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:border-brand hover:bg-muted"
                  >
                    {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                    {s.texto}
                  </button>
                );
              })}
            </div>
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

          <div className="border-t border-border px-4 py-3">
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
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  autoFocus?: boolean;
}) {
  const podeEnviar = value.trim().length > 0 && !loading;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-elegant transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="Pergunte alguma coisa…"
        aria-label="Mensagem para os agentes"
        rows={1}
        autoFocus={autoFocus}
        className="max-h-40 min-h-[24px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Nada grava sem você confirmar
        </span>
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
