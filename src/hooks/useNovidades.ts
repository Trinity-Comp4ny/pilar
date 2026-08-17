import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ULTIMA_VERSAO } from "@/lib/novidades";

// Marca de "visto" por usuário: guarda no localStorage a última versão que a
// pessoa abriu. Sem banco (spec 038). Sem profileId (deslogado), não persiste.
const chave = (profileId: string) => `pilar:novidades-vista:${profileId}`;

function lerVista(profileId: string | undefined): string | null {
  if (!profileId) return null;
  try {
    return localStorage.getItem(chave(profileId));
  } catch {
    return null;
  }
}

export function useNovidades() {
  const { profile } = useAuth();
  const profileId = profile?.id;

  // Leitura inicial síncrona: evita o "flash" do dot novo em quem já viu.
  const [vista, setVista] = useState<string | null>(() => lerVista(profileId));

  const temNovidade = useCallback(() => {
    if (!profileId) return false;
    return vista !== ULTIMA_VERSAO;
  }, [profileId, vista]);

  const marcarVista = useCallback(() => {
    if (!profileId) return;
    try {
      localStorage.setItem(chave(profileId), ULTIMA_VERSAO);
    } catch {
      // localStorage indisponível (modo privado, cota): degrada sem quebrar.
    }
    setVista(ULTIMA_VERSAO);
  }, [profileId]);

  return { temNovidade, marcarVista };
}
