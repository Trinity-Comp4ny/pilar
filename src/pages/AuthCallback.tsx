import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { usePageTitle } from "@/hooks/usePageTitle";
import { marcarLogin } from "@/lib/ultimoLogin";
import { translateAuthError } from "@/lib/authErrors";
import { Logo } from "@/components/Logo";

// Foto do Google (raw_user_meta_data.avatar_url ou .picture) já é gravada no
// profile no signup (trigger handle_new_user). Login subsequente não passa
// pelo trigger, então repetimos aqui para cobrir quem criou a conta antes
// dessa migration. Só grava se avatar_url ainda estiver NULL: upload manual
// (spec 075) sempre vence, então login Google nunca sobrescreve uma foto que
// o usuário escolheu.
function sincronizarAvatarGoogle(user: User) {
  const avatarUrl = (user.user_metadata?.avatar_url ?? user.user_metadata?.picture) as string | undefined;
  if (!avatarUrl) return;

  supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id)
    .is("avatar_url", null)
    .then(({ error }) => {
      if (error) console.error("Falha ao sincronizar avatar do Google:", error);
    });
}

// Retorno do OAuth (Google). O detectSessionInUrl (default do supabase-js) troca o
// code/hash por sessão automaticamente; aqui só esperamos ela existir e roteamos.
// PrivateRoute manda para /profile-setup se o onboarding estiver incompleto.
export default function AuthCallback() {
  usePageTitle("Entrando");
  const navigate = useNavigate();

  useEffect(() => {
    let done = false;

    const falhar = (mensagem: string) => {
      if (done) return;
      done = true;
      toast.error("Não foi possível entrar", { description: mensagem });
      navigate("/login", { replace: true });
    };

    // Erro do provedor pode vir na query (?error=) ou no hash (#error=).
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const oauthError =
      query.get("error_description") || query.get("error") || hash.get("error_description") || hash.get("error");
    if (oauthError) {
      falhar(translateAuthError(oauthError));
      return;
    }

    const concluir = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || done) return;
      done = true;

      const provider = session.user.app_metadata?.provider;
      if (provider === "google") {
        marcarLogin("google");
        sincronizarAvatarGoogle(session.user);
      }

      navigate("/inicio", { replace: true });
    };

    // A sessão pode já estar pronta (getSession) ou chegar via evento (troca do code).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) concluir();
    });

    concluir();

    // Se em 10s não houve sessão nem erro, o link provavelmente expirou/foi aberto solto.
    const timeout = window.setTimeout(() => {
      falhar("O link de acesso expirou ou é inválido. Tente entrar novamente.");
    }, 10000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-4 text-center animate-in fade-in duration-500">
        <Logo variant="mark" size="md" />
        <div className="flex items-center gap-2 text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Entrando...</span>
        </div>
      </div>
    </div>
  );
}
