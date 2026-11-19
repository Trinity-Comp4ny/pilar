import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { parseModulosOcultos, type ModuleId } from "@/lib/modules";

export type PessoaModulos = {
  id: string;
  nome: string;
  email: string;
  role: string;
  ocultos: ModuleId[];
};

export type ModulosOcultosData = {
  empresa: ModuleId[];
  pessoas: PessoaModulos[];
};

export type AlvoModulos = { alvo: "empresa" } | { alvo: "usuario"; usuarioId: string };

const KEY = ["modulos-ocultos"] as const;

/** Módulos ocultos da empresa e de cada pessoa (ADR 0066). Só o admin usa. */
export function useModulosOcultos(empresaId: string | null | undefined) {
  return useQuery<ModulosOcultosData>({
    queryKey: [...KEY, empresaId],
    enabled: Boolean(empresaId),
    queryFn: async () => {
      const [empresa, pessoas] = await Promise.all([
        supabase
          .from("empresas")
          .select("modulos_ocultos")
          .eq("id", empresaId as string)
          .single(),
        supabase
          .from("profiles")
          .select("id, nome, email, role, modulos_ocultos")
          .eq("empresa_id", empresaId as string)
          .order("nome"),
      ]);
      if (empresa.error) throw empresa.error;
      if (pessoas.error) throw pessoas.error;
      return {
        empresa: parseModulosOcultos(empresa.data.modulos_ocultos),
        pessoas: (pessoas.data ?? []).map((p) => ({
          id: p.id,
          nome: p.nome ?? p.email ?? "",
          email: p.email ?? "",
          role: String(p.role),
          ocultos: parseModulosOcultos(p.modulos_ocultos),
        })),
      };
    },
  });
}

export function useSetModulosOcultos(empresaId: string | null | undefined) {
  const qc = useQueryClient();
  const { refreshProfile } = useAuth();
  return useMutation({
    mutationFn: async ({ alvo, modulos }: { alvo: AlvoModulos; modulos: ModuleId[] }) => {
      const { error } = await supabase.rpc("set_modulos_ocultos", {
        p_alvo: alvo.alvo,
        // A RPC ignora o usuário quando o alvo é a empresa; o uuid nulo só preenche a assinatura.
        p_usuario_id: alvo.alvo === "usuario" ? alvo.usuarioId : "00000000-0000-0000-0000-000000000000",
        p_modulos: modulos,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [...KEY, empresaId] });
      await refreshProfile();
    },
  });
}
