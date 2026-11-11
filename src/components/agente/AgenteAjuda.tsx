import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, MessageCircleQuestion, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/motion/PageLoader";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { ArtigoMarkdown } from "@/components/ajuda/ArtigoMarkdown";
import { NOME_DA_TELA, type ArtigoAjuda } from "@/content/ajuda/indice";
import { artigosDaRota, buscarArtigos, carregarCorpo } from "@/lib/ajudaBusca";
import { registrarPerguntaSemResposta } from "@/lib/ajudaLacunas";
import { EVENTO_ABRIR_AGENTE } from "@/lib/agenteAjudaEvento";

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

function RespostaArtigo({ artigo, onIr }: { artigo: ArtigoAjuda; onIr: () => void }) {
  const corpo = useQuery({
    queryKey: ["ajuda-artigo", artigo.slug],
    queryFn: () => carregarCorpo(artigo.slug),
    staleTime: Infinity,
  });
  return (
    <div className="space-y-3 rounded-lg border border-black/5 p-4">
      <p className="text-sm font-semibold text-ink">{artigo.titulo}</p>
      {corpo.isLoading ? (
        <PageLoader label="Abrindo o passo a passo" />
      ) : corpo.data ? (
        <ArtigoMarkdown>{corpo.data}</ArtigoMarkdown>
      ) : (
        <p className="text-sm text-ink-muted">{artigo.resumo}</p>
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

/**
 * Agente da ajuda no canto da tela (SPEC 155). Responde "como faço X" pela central de ajuda: o
 * caminho e o botão para a tela vêm de artigo escrito a partir do código, nunca de texto gerado,
 * e a pergunta não gasta tokens. O que a central não cobre segue para os agentes (/agentes, com a
 * pergunta pronta) ou para o suporte (feedback com a tela e a versão), e vira pauta de artigo.
 */
export function AgenteAjuda() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pergunta, setPergunta] = useState("");
  const [suporteAberto, setSuporteAberto] = useState(false);

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR_AGENTE, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_AGENTE, abrir);
  }, []);

  const daTela = useMemo(() => artigosDaRota(pathname).slice(0, 3), [pathname]);
  const respostas = useMemo(() => (pergunta ? buscarArtigos(pergunta).slice(0, 3) : []), [pergunta]);
  const semResposta = !!pergunta && respostas.length === 0;

  useEffect(() => {
    if (semResposta) void registrarPerguntaSemResposta(pergunta, pathname, "agente");
  }, [semResposta, pergunta, pathname]);

  const fechar = () => setAberto(false);

  const perguntar = (e: React.FormEvent) => {
    e.preventDefault();
    setPergunta(texto.trim());
  };

  const naoResolveu = () => void registrarPerguntaSemResposta(pergunta, pathname, "agente");

  const levarAosAgentes = () => {
    naoResolveu();
    fechar();
    navigate("/agentes", { state: { prompt: pergunta } });
  };

  const falarComSuporte = () => {
    naoResolveu();
    fechar();
    setSuporteAberto(true);
  };

  // A própria tela dos agentes já é a conversa: o balão some lá.
  const naTelaDosAgentes = pathname.startsWith("/agentes");

  return (
    <>
      {!naTelaDosAgentes && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Como faço? Perguntar ao agente do Pilar"
          title="Como faço?"
          className="fixed bottom-16 right-4 z-40 hidden h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-white shadow-elegant transition-transform hover:scale-[1.02] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand md:flex"
        >
          <MessageCircleQuestion size={18} aria-hidden />
          Como faço?
        </button>
      )}

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles size={18} aria-hidden /> Agente do Pilar
            </SheetTitle>
            <SheetDescription>Pergunte como fazer algo. Eu mostro o caminho e levo você até a tela.</SheetDescription>
          </SheetHeader>

          <form onSubmit={perguntar} className="flex gap-2">
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex.: como eu crio um lead?"
              aria-label="Sua pergunta"
              maxLength={300}
              autoFocus
            />
            <Button type="submit" variant="brand" disabled={texto.trim().length < 2}>
              Perguntar
            </Button>
          </form>

          {!pergunta && daTela.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-ink-muted">Nesta tela</p>
              <ul className="space-y-1">
                {daTela.map((a) => (
                  <li key={a.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        setTexto(a.titulo);
                        setPergunta(a.titulo);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-muted"
                    >
                      {a.titulo}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {respostas.length > 0 && (
            <div className="space-y-3">
              <RespostaArtigo artigo={respostas[0]} onIr={fechar} />
              {respostas.length > 1 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-ink-muted">Também pode ajudar</p>
                  {respostas.slice(1).map((a) => (
                    <button
                      key={a.slug}
                      type="button"
                      onClick={() => {
                        setTexto(a.titulo);
                        setPergunta(a.titulo);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-muted"
                    >
                      {a.titulo}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {semResposta && (
            <p className="text-sm text-ink">
              Ainda não tenho um passo a passo para isso. Os agentes podem responder com os dados do seu escritório, ou
              o time do Pilar responde direto.
            </p>
          )}

          {pergunta && (
            <div className="mt-auto space-y-2 border-t border-black/5 pt-3">
              {!semResposta && <p className="text-xs text-ink-muted">Não resolveu?</p>}
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
        </SheetContent>
      </Sheet>

      <FeedbackDialog
        open={suporteAberto}
        onOpenChange={setSuporteAberto}
        mensagemInicial={pergunta ? `Dúvida: ${pergunta}` : undefined}
      />
    </>
  );
}
