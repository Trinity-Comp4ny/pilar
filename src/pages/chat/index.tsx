import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Coins,
  FileText,
  HardHat,
  Loader2,
  Plus,
  Sparkles,
  Square,
  Users,
  Wallet,
  FolderKanban,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useChat } from "./useChat";
import { MarkdownResposta } from "./MarkdownResposta";
import { PendenciasTab } from "./PendenciasTab";
import { usePendenciasAgentes } from "@/hooks/useEscopos";

// Saldo de tokens no chip: compacto no rótulo ("1,9 mi"), cheio no title.
const fmtTokens = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtTokensCheio = new Intl.NumberFormat("pt-BR");
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
  { key: "obras", label: "Obras", icon: HardHat, hint: "RDO, clima, efetivo, atraso" },
  { key: "equipe", label: "Equipe", icon: Users, hint: "pessoas, cargos, contratos" },
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

  const {
    messages,
    send,
    stop,
    loading,
    reset,
    saldo,
    confirmarDraft,
    cancelarDraft,
    desfazer,
    desfazerFolha,
    executarAcao,
    cancelarAcao,
  } = useChat();
  const [aba, setAba] = useState<"conversar" | "pendencias">("conversar");
  const pendencias = usePendenciasAgentes();
  const numPendencias = pendencias.data?.length ?? 0;
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

  // Alternador Conversar/Pendências (spec 084): centralizado na mesma linha do
  // título a partir de sm; em telas menores não cabe centralizado, então cai
  // numa segunda linha só no mobile (ver uso abaixo).
  const abas = (
    <>
      <AbaAgentesBtn ativo={aba === "conversar"} onClick={() => setAba("conversar")}>
        Conversar
      </AbaAgentesBtn>
      <AbaAgentesBtn ativo={aba === "pendencias"} onClick={() => setAba("pendencias")}>
        Pendências
        {numPendencias > 0 && (
          <span className="ml-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-ink">
            {numPendencias}
          </span>
        )}
      </AbaAgentesBtn>
    </>
  );

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
      {/* Header padrão da casa (spec 002 via PageHeader), sempre visível. */}
      <div className="border-b border-border">
        <PageHeader title="Agentes" center={<div className="hidden items-center gap-1 sm:flex">{abas}</div>}>
          {saldo && (
            <span
              className="hidden lg:flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
              title={`Tokens de IA: ${fmtTokensCheio.format(saldo.tokens_plano)} do plano + ${fmtTokensCheio.format(saldo.tokens_comprado)} avulsos`}
            >
              <Coins className="h-3.5 w-3.5" />
              {fmtTokens.format(saldo.tokens_restantes)} tokens
            </span>
          )}
          {aba === "conversar" && (
            <Button
              onClick={handleReset}
              disabled={loading}
              variant="brand"
              className="h-9 rounded-full px-4 text-[13px] font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova conversa
            </Button>
          )}
        </PageHeader>
        {/* Pendências (spec 084): trabalho de agente esperando decisão, cruzando projetos —
            sem isso, quem só abre /agentes nunca descobre que o guardião de margem preparou algo.
            Em telas >= sm o alternador já está centralizado no header (acima); esta linha só
            existe pro mobile, onde não cabe centralizado na mesma linha do título. */}
        <div className="flex items-center gap-1 px-4 pb-3 sm:hidden">{abas}</div>
      </div>

      {aba === "pendencias" ? (
        <div className="flex-1 overflow-y-auto">
          <PendenciasTab />
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
                5 agentes prontos: Financeiro, Projetos, Comercial, Obras e Equipe. Pergunte em linguagem natural e eles
                consultam seus dados e respondem na hora.
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
                          <MarkdownResposta>{m.content}</MarkdownResposta>
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

/** Alternador Conversar/Pendências (spec 084). */
function AbaAgentesBtn({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center rounded-full px-3 text-[13px] font-medium transition-colors",
        ativo ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
      )}
    >
      {children}
    </button>
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
