import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUp, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/motion/PageLoader";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { ArtigoMarkdown } from "@/components/ajuda/ArtigoMarkdown";
import { NOME_DA_TELA, type ArtigoAjuda } from "@/content/ajuda/indice";
import { artigosDaRota, buscarArtigos, carregarCorpo } from "@/lib/ajudaBusca";
import { registrarPerguntaSemResposta } from "@/lib/ajudaLacunas";
import { EVENTO_ABRIR_AGENTE } from "@/lib/agenteAjudaEvento";

type Mensagem =
  { id: number; de: "pessoa"; texto: string } | { id: number; de: "pilar"; pergunta: string; artigos: ArtigoAjuda[] };

function IrParaTela({ artigo, onIr }: { artigo: ArtigoAjuda; onIr: () => void }) {
  const rota = artigo.rotas[0];
  if (!rota) return null;
  return (
    <Button variant="brand" size="sm" className="gap-1.5" asChild>
      <Link to={rota} onClick={onIr}>
        {`Ir para ${NOME_DA_TELA[rota] ?? "a tela"}`}
        <ArrowRight size={14} aria-hidden />
      </Link>
    </Button>
  );
}

function PassoAPasso({ artigo, onIr }: { artigo: ArtigoAjuda; onIr: () => void }) {
  const corpo = useQuery({
    queryKey: ["ajuda-artigo", artigo.slug],
    queryFn: () => carregarCorpo(artigo.slug),
    staleTime: Infinity,
  });
  return (
    <div className="space-y-3">
      <p className="font-semibold text-ink">{artigo.titulo}</p>
      {corpo.isLoading ? (
        <PageLoader label="Abrindo o passo a passo" />
      ) : corpo.data ? (
        <ArtigoMarkdown>{corpo.data}</ArtigoMarkdown>
      ) : (
        <p className="text-ink-muted">{artigo.resumo}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <IrParaTela artigo={artigo} onIr={onIr} />
        <Button variant="outline" size="sm" asChild>
          <Link to={`/ajuda/${artigo.slug}`} onClick={onIr}>
            Abrir na central
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Sugestoes({ artigos, onEscolher }: { artigos: ArtigoAjuda[]; onEscolher: (titulo: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {artigos.map((a) => (
        <button
          key={a.slug}
          type="button"
          onClick={() => onEscolher(a.titulo)}
          className="rounded-full border border-border bg-surface-card px-3 py-1.5 text-left text-xs font-medium text-ink transition-colors hover:bg-muted"
        >
          {a.titulo}
        </button>
      ))}
    </div>
  );
}

function BalaoPilar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-ink">
        <Sparkles size={14} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-2 rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-ink">
        {children}
      </div>
    </div>
  );
}

/**
 * Dúvidas no canto da tela (SPEC 155): um chat que responde "como faço X" pela central de ajuda.
 * O caminho e o botão para a tela vêm de artigo escrito a partir do código, nunca de texto gerado,
 * e a pergunta não gasta tokens. O que a central não cobre segue para os agentes (/agentes, com a
 * pergunta pronta) ou para o suporte (feedback com a tela e a versão), e vira pauta de artigo.
 */
export function AgenteAjuda() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [suporteAberto, setSuporteAberto] = useState(false);
  const proximoId = useRef(0);
  const campo = useRef<HTMLTextAreaElement>(null);
  const perguntaAtual = useRef<HTMLDivElement>(null);
  // Quem abriu o painel (o "?" do cabeçalho, o "Dúvidas" do menu mobile): o foco volta pra ele.
  const quemAbriu = useRef<HTMLElement | null>(null);
  const devolverFoco = useRef(false);

  useEffect(() => {
    const abrir = () => {
      const ativo = document.activeElement;
      quemAbriu.current = ativo instanceof HTMLElement && ativo !== document.body ? ativo : null;
      setAberto(true);
    };
    window.addEventListener(EVENTO_ABRIR_AGENTE, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_AGENTE, abrir);
  }, []);

  useEffect(() => {
    if (aberto) campo.current?.focus();
    else if (devolverFoco.current) {
      // Devolve o foco a quem abriu (teclado não se perde).
      devolverFoco.current = false;
      quemAbriu.current?.focus();
    }
  }, [aberto]);

  // Rola até a pergunta recém-feita: a resposta é lida do começo, não do fim.
  useEffect(() => {
    perguntaAtual.current?.scrollIntoView?.({ block: "start" });
  }, [mensagens]);

  const daTela = useMemo(() => artigosDaRota(pathname).slice(0, 3), [pathname]);
  const ultimaPergunta = [...mensagens].reverse().find((m) => m.de === "pessoa")?.texto ?? "";

  const fechar = () => {
    devolverFoco.current = true;
    setAberto(false);
  };

  const perguntar = (pergunta: string) => {
    const limpa = pergunta.trim();
    if (limpa.length < 2) return;
    const artigos = buscarArtigos(limpa).slice(0, 3);
    if (artigos.length === 0) void registrarPerguntaSemResposta(limpa, pathname, "agente");
    setMensagens((atual) => [
      ...atual,
      { id: proximoId.current++, de: "pessoa", texto: limpa },
      { id: proximoId.current++, de: "pilar", pergunta: limpa, artigos },
    ]);
    setTexto("");
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    perguntar(texto);
  };

  const enterEnvia = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    perguntar(texto);
  };

  const naoResolveu = () => void registrarPerguntaSemResposta(ultimaPergunta, pathname, "agente");

  const levarAosAgentes = () => {
    naoResolveu();
    setAberto(false);
    navigate("/agentes", { state: { prompt: ultimaPergunta } });
  };

  const falarComSuporte = () => {
    naoResolveu();
    setAberto(false);
    setSuporteAberto(true);
  };

  const ultimaResposta = mensagens.at(-1);

  // Sem botão flutuante (auditoria de espaço, 2026-11): a pílula "Dúvidas" ficava fixa por cima
  // do conteúdo em toda tela. Agora abre pelo "?" do cabeçalho (AjudaDaTela) e pelo menu mobile,
  // ambos via abrirAgenteAjuda(). O painel abre no alto, perto do "?" que o chamou.
  return (
    <>
      {aberto && (
        <section
          role="dialog"
          aria-label="Dúvidas sobre o Pilar"
          onKeyDown={(e) => e.key === "Escape" && fechar()}
          className="fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-50 flex h-[min(560px,calc(100dvh-5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface-card shadow-elegant md:inset-x-auto md:bottom-auto md:right-4 md:top-16 md:w-[380px]"
        >
          <div className="flex shrink-0 justify-end px-2 pt-2">
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-muted hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>

          <div role="log" aria-live="polite" className="flex-1 scroll-pt-2 space-y-4 overflow-y-auto px-4 pb-4">
            <BalaoPilar>
              <p>Oi! Me diga o que você quer fazer que eu mostro o caminho e levo você até a tela.</p>
              {daTela.length > 0 && (
                <>
                  <p className="text-xs text-ink-muted">Nesta tela:</p>
                  <Sugestoes artigos={daTela} onEscolher={perguntar} />
                </>
              )}
            </BalaoPilar>

            {mensagens.map((m) =>
              m.de === "pessoa" ? (
                <div key={m.id} ref={m === mensagens.at(-2) ? perguntaAtual : undefined} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand px-3.5 py-2 text-sm text-ink">
                    {m.texto}
                  </p>
                </div>
              ) : (
                <BalaoPilar key={m.id}>
                  {m.artigos.length > 0 ? (
                    <>
                      <PassoAPasso artigo={m.artigos[0]} onIr={() => setAberto(false)} />
                      {m.artigos.length > 1 && (
                        <>
                          <p className="pt-1 text-xs text-ink-muted">Também pode ajudar:</p>
                          <Sugestoes artigos={m.artigos.slice(1)} onEscolher={perguntar} />
                        </>
                      )}
                    </>
                  ) : (
                    <p>
                      Ainda não tenho um passo a passo para isso. Os agentes podem responder com os dados do seu
                      escritório, ou o time do Pilar responde direto.
                    </p>
                  )}
                  {m === ultimaResposta && (
                    <div className="space-y-1.5 border-t border-border pt-2">
                      {m.artigos.length > 0 && <p className="text-xs text-ink-muted">Não resolveu?</p>}
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={levarAosAgentes}>
                          Perguntar aos agentes
                        </Button>
                        <Button variant="outline" size="sm" onClick={falarComSuporte}>
                          Falar com o suporte
                        </Button>
                      </div>
                    </div>
                  )}
                </BalaoPilar>
              )
            )}
          </div>

          <form onSubmit={enviar} className="flex items-end gap-2 border-t border-border p-3">
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={enterEnvia}
              placeholder="Ex.: como eu crio um lead?"
              aria-label="Sua pergunta"
              maxLength={300}
              rows={1}
              className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus-visible:border-brand focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/40 max-md:text-base"
            />
            <Button
              type="submit"
              variant="brand"
              size="icon"
              aria-label="Enviar"
              disabled={texto.trim().length < 2}
              className="h-10 w-10 shrink-0 rounded-full"
            >
              <ArrowUp size={18} aria-hidden />
            </Button>
          </form>
        </section>
      )}

      <FeedbackDialog
        open={suporteAberto}
        onOpenChange={setSuporteAberto}
        mensagemInicial={ultimaPergunta ? `Dúvida: ${ultimaPergunta}` : undefined}
      />
    </>
  );
}
