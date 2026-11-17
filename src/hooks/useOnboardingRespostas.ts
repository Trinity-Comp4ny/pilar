import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RESPOSTAS_VAZIAS, type RespostasOnboarding } from "@/lib/onboarding/dores";
import { lerRespostas, paraLinha } from "@/lib/onboarding/respostas";

/**
 * Respostas do onboarding inteligente da pessoa logada (SPEC 165), com rascunho: cada
 * tela grava a linha de `onboarding_respostas`, então quem fecha a aba volta de onde
 * parou. Uma linha por pessoa (`user_id` único).
 */
export function useOnboardingRespostas() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const empresaId = profile?.empresa_id ?? null;
  const [respostas, setRespostas] = useState<RespostasOnboarding>(RESPOSTAS_VAZIAS);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let ativo = true;
    void (async () => {
      const { data } = await supabase.from("onboarding_respostas").select("*").eq("user_id", userId).maybeSingle();
      if (!ativo) return;
      setRespostas(lerRespostas(data));
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [userId]);

  /** Grava o rascunho. Devolve false se não gravou (a tela segue; o dado fica na memória). */
  const salvar = useCallback(
    async (proximas: RespostasOnboarding): Promise<boolean> => {
      setRespostas(proximas);
      if (!userId || !empresaId) return false;
      const { error } = await supabase
        .from("onboarding_respostas")
        .upsert({ user_id: userId, empresa_id: empresaId, ...paraLinha(proximas) }, { onConflict: "user_id" });
      return !error;
    },
    [userId, empresaId]
  );

  return { respostas, carregando, salvar };
}
