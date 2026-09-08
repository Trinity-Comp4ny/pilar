import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import type { CategoriaNotificacao } from "@/lib/notificacoes";

export type NotificacaoPreferencia = Tables<"notificacao_preferencias">;

const KEY = ["notificacao-preferencias"];

/** Preferências do usuário. Ausência de linha para uma categoria = ligada (in_app). */
export function useNotificacaoPreferencias() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<NotificacaoPreferencia[]> => {
      const { data, error } = await supabase
        .from("notificacao_preferencias")
        .select("id, user_id, empresa_id, categoria, in_app, email, created_at, updated_at");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60,
  });
}

/**
 * Liga/desliga uma categoria no canal in-app. Upsert por (user_id, categoria);
 * o roteamento (função notificar) lê in_app=false para não gerar. RLS exige o
 * próprio user_id + empresa_id da empresa do usuário.
 */
export function useSetPreferenciaInApp() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({ categoria, inApp }: { categoria: CategoriaNotificacao; inApp: boolean }) => {
      if (!user?.id || !profile?.empresa_id) throw new Error("Sessão sem empresa definida.");
      const { error } = await supabase
        .from("notificacao_preferencias")
        .upsert(
          { user_id: user.id, empresa_id: profile.empresa_id, categoria, in_app: inApp },
          { onConflict: "user_id,categoria" }
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

/**
 * Liga/desliga uma categoria no canal e-mail (SPEC 096). Upsert por
 * (user_id, categoria); só a coluna `email` muda, `in_app` mantém o que estiver
 * (default true numa linha nova). NULL nunca é gravado por aqui: o usuário
 * escolheu, então a coluna sai do "vale o padrão".
 */
export function useSetPreferenciaEmail() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({ categoria, email }: { categoria: CategoriaNotificacao; email: boolean }) => {
      if (!user?.id || !profile?.empresa_id) throw new Error("Sessão sem empresa definida.");
      const { error } = await supabase
        .from("notificacao_preferencias")
        .upsert(
          { user_id: user.id, empresa_id: profile.empresa_id, categoria, email },
          { onConflict: "user_id,categoria" }
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
