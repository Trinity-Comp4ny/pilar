import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { AvisoCanto } from "@/components/AvisoCanto";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PRIVACY_VERSION, TERMS_VERSION, TERMS_VIGENCIA_TEXTO, termosVigentes } from "@/lib/legalVersions";

/**
 * Reaceite dos Termos pelo administrador da conta (Termos v2.0, cláusula 15).
 *
 * Quem responde pela empresa no contrato é o administrador: ele aceita a versão nova
 * dentro do app, e o aceite fica gravado com data e versão (`terms_acceptances`,
 * source 'reaceite'). Membro da equipe não vê nada: o contrato é com a empresa.
 *
 * Antes da vigência: cartão no canto inferior direito (nunca faixa no topo), com "Agora não" (volta na próxima sessão).
 * Depois da vigência: janela que só fecha com o aceite.
 *
 * `modo` separa as duas partes porque elas vivem em lugares diferentes: a janela é global
 * (App), para bloquear em qualquer tela; a faixa fica no Layout, depois do skip link, para
 * o primeiro Tab continuar sendo "Pular para conteúdo principal".
 */

const CHAVE_ADIADO = "pilar_aceite_termos_adiado";
// Telas onde a faixa atrapalha: o aceite já é pedido no próprio cadastro.
const ROTAS_SEM_FAIXA = ["/profile-setup", "/cadastro", "/login"];

function lerAdiado(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_ADIADO) === TERMS_VERSION;
  } catch {
    return false;
  }
}

function useVersaoAceita(userId: string | undefined, ativo: boolean) {
  return useQuery({
    queryKey: ["aceite-termos", userId],
    enabled: !!userId && ativo,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms_acceptances")
        .select("terms_version")
        .eq("user_id", userId as string)
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.terms_version ?? null;
    },
  });
}

function LinkTermos({ className }: { className?: string }) {
  return (
    <a href="/termos" target="_blank" rel="noopener noreferrer" className={className}>
      Ler os Termos de Uso
    </a>
  );
}

export type ModoAceiteTermos = "faixa" | "janela" | "ambos";

export function AceiteTermosBanner({ modo = "ambos" }: { modo?: ModoAceiteTermos }) {
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const [adiado, setAdiado] = useState(lerAdiado);

  const ehAdmin = profile?.role === "admin";
  const versao = useVersaoAceita(user?.id, ehAdmin);

  const aceitar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada. Entre de novo.");
      const { error } = await supabase.from("terms_acceptances").insert({
        user_id: user.id,
        empresa_id: profile?.empresa_id ?? null,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        source: "reaceite",
      });
      if (error) throw new Error("Não foi possível registrar o aceite. Tente de novo.");
    },
    onSuccess: () => {
      toast.success("Aceite registrado. Obrigado.");
      queryClient.invalidateQueries({ queryKey: ["aceite-termos", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!ehAdmin || !user) return null;
  if (ROTAS_SEM_FAIXA.some((r) => pathname.startsWith(r))) return null;
  // Erro ou carregando: não bloqueia ninguém por falha de rede.
  if (versao.isLoading || versao.isError) return null;
  if (versao.data === TERMS_VERSION) return null;

  const vigente = termosVigentes();

  if (vigente) {
    if (modo === "faixa") return null;
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="aceite-termos-titulo"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <div className="mx-4 w-full max-w-md space-y-5 rounded-2xl bg-card p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-paper-alt">
            <FileText className="h-7 w-7 text-ink-soft" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <h2 id="aceite-termos-titulo" className="text-xl font-semibold tracking-tight text-ink">
              Novos Termos de Uso
            </h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              {`Os Termos de Uso e a Política de Privacidade da Pilar mudaram e valem desde ${TERMS_VIGENCIA_TEXTO}. Como administrador da conta, você aceita em nome da empresa para seguir usando.`}
            </p>
          </div>
          <LinkTermos className="block text-sm font-medium text-ink underline underline-offset-2" />
          <Button
            className="w-full"
            size="lg"
            variant="brand"
            loading={aceitar.isPending}
            onClick={() => aceitar.mutate()}
          >
            Li e aceito os Termos de Uso
          </Button>
          <p className="text-xs text-ink-disabled">Dúvidas: privacidade@pilarsoft.com.br</p>
        </div>
      </div>
    );
  }

  if (adiado || modo === "janela") return null;

  const adiar = () => {
    try {
      sessionStorage.setItem(CHAVE_ADIADO, TERMS_VERSION);
    } catch {
      // sem armazenamento: some só nesta tela
    }
    setAdiado(true);
  };

  return (
    <AvisoCanto
      icone={<FileText className="h-4 w-4" strokeWidth={2} />}
      titulo="Atualizamos os Termos de Uso e a Política de Privacidade"
      acoes={
        <>
          <LinkTermos className="mr-auto text-xs font-medium underline underline-offset-2" />
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={adiar}>
            Agora não
          </Button>
          <Button
            size="sm"
            variant="brand"
            className="h-7 px-3 text-xs"
            loading={aceitar.isPending}
            onClick={() => aceitar.mutate()}
          >
            Li e aceito
          </Button>
        </>
      }
    >
      {`Valem para a sua conta a partir de ${TERMS_VIGENCIA_TEXTO}.`}
    </AvisoCanto>
  );
}
