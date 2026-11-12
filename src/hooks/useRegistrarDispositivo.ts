import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { descricaoDoNavegador, idDoDispositivo } from "@/lib/dispositivo";

const registrados = new Set<string>();

/**
 * Registra o navegador da sessão (SPEC 159): navegador novo, a partir do segundo da conta, gera o
 * alerta "Novo acesso à sua conta" no sino e por e-mail. Uma vez por usuário por carregamento.
 */
export function useRegistrarDispositivo() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user || registrados.has(user.id)) return;
    const id = idDoDispositivo();
    if (!id) return;
    registrados.add(user.id);
    void supabase
      .rpc("registrar_dispositivo", { p_dispositivo_id: id, p_descricao: descricaoDoNavegador(navigator.userAgent) })
      .then(({ error }) => {
        if (error) registrados.delete(user.id);
      });
  }, [user]);
}
