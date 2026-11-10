import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { mfaDevBypass } from "@/lib/mfaDevBypass";
import { monitoring } from "@/lib/monitoring";
import {
  guardarAutorizacaoPendente,
  hostDoRetorno,
  idDeAutorizacaoValido,
  irPara,
  limparAutorizacaoPendente,
  redirecionamentoSeguro,
} from "@/lib/oauthPendente";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { EntryVeil } from "@/components/motion/EntryVeil";
import { PageLoader } from "@/components/motion/PageLoader";

/**
 * Tela de autorização do conector (SPEC 151). O ChatGPT, o Claude ou outro cliente MCP manda o
 * usuário para cá pelo servidor OAuth 2.1 do Supabase Auth; ele vê quem está pedindo, o que o
 * app vai poder fazer (só consultar) e decide. A decisão volta para o app pelo redirect que o
 * próprio Supabase Auth monta.
 *
 * Fora do PrivateRoute de propósito: sem login, o PrivateRoute mandaria para a landing e o
 * pedido se perderia. Aqui a tela guarda o pedido e manda para o login; o PrivateRoute retoma.
 */

type Detalhes = {
  cliente: string;
  retorno: string | null;
};

type Estado =
  | { tipo: "carregando" }
  | { tipo: "pronto"; detalhes: Detalhes }
  | { tipo: "redirecionando" }
  | { tipo: "erro"; mensagem: string };

const LINK_INVALIDO = "Este pedido de conexão não é válido ou já expirou. Volte ao app que pediu e conecte de novo.";

export default function Autorizar() {
  usePageTitle("Conectar app");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id");
  const idValido = idDeAutorizacaoValido(authorizationId);
  const { loading, isAuthenticated, mfaChallengeRequired, profile, user, signOut } = useAuth();
  const precisaMfa = mfaChallengeRequired && !mfaDevBypass();
  const podeCarregar = idValido && !loading && isAuthenticated && !precisaMfa;

  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [decidindo, setDecidindo] = useState<"permitir" | "recusar" | null>(null);

  useEffect(() => {
    if (!podeCarregar) return;
    // A tela assumiu o pedido: o PrivateRoute não deve trazer o usuário de volta para cá.
    limparAutorizacaoPendente();
    let ativo = true;
    void (async () => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!ativo) return;
      if (error || !data) {
        setEstado({ tipo: "erro", mensagem: LINK_INVALIDO });
        return;
      }
      // Já autorizado antes: o Supabase devolve direto o retorno, sem pedir de novo.
      if (!("authorization_id" in data)) {
        const destino = redirecionamentoSeguro(data.redirect_url);
        if (!destino) {
          setEstado({ tipo: "erro", mensagem: LINK_INVALIDO });
          return;
        }
        setEstado({ tipo: "redirecionando" });
        irPara(destino);
        return;
      }
      setEstado({
        tipo: "pronto",
        detalhes: {
          cliente: data.client?.name?.trim() || "Um app externo",
          retorno: hostDoRetorno(data.redirect_uri),
        },
      });
    })();
    return () => {
      ativo = false;
    };
  }, [podeCarregar, authorizationId]);

  if (!idValido) return <Moldura conteudo={<Erro mensagem={LINK_INVALIDO} onVoltar={() => navigate("/inicio")} />} />;
  if (loading) return <EntryVeil />;
  if (!isAuthenticated) {
    guardarAutorizacaoPendente(authorizationId);
    return <Navigate to="/login" replace />;
  }
  if (precisaMfa) {
    guardarAutorizacaoPendente(authorizationId);
    return <Navigate to="/mfa" replace />;
  }

  const decidir = async (decisao: "permitir" | "recusar") => {
    setDecidindo(decisao);
    const { data, error } =
      decisao === "permitir"
        ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    const destino = redirecionamentoSeguro(data?.redirect_url);
    if (error || !destino) {
      if (error) monitoring.captureException(error, { context: "oauth-autorizar", decisao });
      setDecidindo(null);
      setEstado({ tipo: "erro", mensagem: LINK_INVALIDO });
      return;
    }
    setEstado({ tipo: "redirecionando" });
    irPara(destino);
  };

  const trocarDeConta = async () => {
    await signOut();
    guardarAutorizacaoPendente(authorizationId);
    navigate("/login", { replace: true });
  };

  if (estado.tipo === "carregando" || estado.tipo === "redirecionando") {
    return (
      <Moldura
        conteudo={<PageLoader label={estado.tipo === "redirecionando" ? "Voltando ao app" : "Carregando o pedido"} />}
      />
    );
  }
  if (estado.tipo === "erro") {
    return <Moldura conteudo={<Erro mensagem={estado.mensagem} onVoltar={() => navigate("/inicio")} />} />;
  }

  const { cliente, retorno } = estado.detalhes;
  const empresa = profile?.empresas?.nome ?? "seu escritório";

  return (
    <Moldura
      conteudo={
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-ink text-balance">Conectar {cliente} à Pilar</h1>
            <p className="text-sm text-ink-soft">
              {cliente} vai consultar os dados de <span className="font-medium text-ink">{empresa}</span> com o seu
              acesso.
            </p>
          </div>

          <div className="rounded-lg border border-paper-border bg-paper-alt p-4 space-y-4 text-sm">
            <Lista
              titulo="Vai poder"
              icone="sim"
              itens={[
                "Consultar projetos, aditivos, propostas, leads e clientes",
                "Ver o resumo financeiro, se o seu perfil vê o financeiro",
              ]}
            />
            <Lista
              titulo="Não vai poder"
              icone="nao"
              itens={["Criar, alterar ou apagar nada na Pilar", "Ver o que o seu perfil não vê no app"]}
            />
          </div>

          <p className="text-xs text-ink-muted text-center text-balance">
            {retorno ? (
              <>
                Depois da decisão você volta para <span className="font-medium text-ink-soft">{retorno}</span>.{" "}
              </>
            ) : null}
            Só permita se foi você quem pediu esta conexão.
          </p>

          <div className="flex flex-col gap-3">
            <Button
              variant="brand"
              size="lg"
              loading={decidindo === "permitir"}
              disabled={decidindo !== null}
              onClick={() => void decidir("permitir")}
            >
              Permitir acesso
            </Button>
            <Button
              variant="outline"
              size="lg"
              loading={decidindo === "recusar"}
              disabled={decidindo !== null}
              onClick={() => void decidir("recusar")}
            >
              Recusar
            </Button>
          </div>

          <p className="text-xs text-ink-muted text-center">
            Entrou como <span className="text-ink-soft">{user?.email}</span>.{" "}
            <button
              type="button"
              onClick={() => void trocarDeConta()}
              disabled={decidindo !== null}
              className="font-medium text-ink underline-offset-2 hover:underline decoration-brand"
            >
              Trocar de conta
            </button>
          </p>
        </div>
      }
    />
  );
}

function Moldura({ conteudo }: { conteudo: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-[440px] space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        {conteudo}
      </div>
    </div>
  );
}

function Lista({ titulo, icone, itens }: { titulo: string; icone: "sim" | "nao"; itens: string[] }) {
  const Icone = icone === "sim" ? Check : X;
  return (
    <div className="space-y-2">
      <p className="font-medium text-ink">{titulo}</p>
      <ul className="space-y-1.5">
        {itens.map((item) => (
          <li key={item} className="flex items-start gap-2 text-ink-soft">
            <Icone
              className={`mt-0.5 h-4 w-4 shrink-0 ${icone === "sim" ? "text-positive-strong" : "text-ink-muted"}`}
              aria-hidden
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Erro({ mensagem, onVoltar }: { mensagem: string; onVoltar: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Não deu para conectar</h1>
        <p className="text-sm text-ink-soft text-balance">{mensagem}</p>
      </div>
      <Button variant="outline" onClick={onVoltar}>
        Ir para a Pilar
      </Button>
    </div>
  );
}
