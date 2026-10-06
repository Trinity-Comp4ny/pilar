import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { monitoring } from "@/lib/monitoring";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PilarPage } from "@/components/PilarPage";

type RecoveryState = "checking" | "missing" | "error";

export function AccountRecoveryScreen() {
  usePageTitle("Acesso ao escritório");
  const { user, profileError, refreshProfile, signOut } = useAuth();
  const [state, setState] = useState<RecoveryState>(profileError ? "error" : "checking");
  const [attempt, setAttempt] = useState(0);
  const refreshProfileRef = useRef(refreshProfile);
  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  useEffect(() => {
    let active = true;
    const recover = async () => {
      try {
        // Erro de infraestrutura não prova ausência de profile.
        if (profileError) {
          if (attempt === 0) return;
          await refreshProfileRef.current();
          if (active) setState("error");
          return;
        }
        const { data, error } = await supabase.rpc("aceitar_convite_pendente");
        if (error) throw error;
        if (!active) return;
        if (!data) {
          setState("missing");
          return;
        }
        const { error: sessionError } = await supabase.auth.refreshSession();
        if (sessionError) throw sessionError;
        await refreshProfileRef.current();
        // Se a consulta não conseguiu atualizar o contexto, permite retry.
        if (active) setState("error");
      } catch (error) {
        monitoring.captureException(error, { context: "account-recovery", userId: user?.id });
        if (active) setState("error");
      }
    };
    void recover();
    return () => {
      active = false;
    };
  }, [user?.id, attempt, profileError]);

  const retry = () => {
    setState("checking");
    setAttempt((value) => value + 1);
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <PilarPage title="Acesso ao escritório" standalone containerClassName="max-w-lg pt-12">
        <div className="space-y-6" aria-live="polite">
          <p className="text-ink-muted">
            {state === "checking"
              ? "Verificando o acesso da sua conta..."
              : state === "missing"
                ? "Sua conta não está ligada a nenhum escritório. Peça ao administrador um novo convite para este e-mail."
                : "Não foi possível verificar o acesso da sua conta. Tente novamente."}
          </p>
          {user?.email && <p className="text-sm text-ink">{user.email}</p>}
          <div className="flex gap-3">
            <Button variant="brand" disabled={state === "checking"} onClick={retry}>
              Verificar novamente
            </Button>
            <Button variant="ghost" onClick={() => void signOut()}>
              Sair
            </Button>
          </div>
        </div>
      </PilarPage>
    </SidebarProvider>
  );
}
