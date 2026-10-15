import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ehTema, TEMA_PADRAO, type TemaInicio } from "@/pages/inicio/hero/temas";

/**
 * Preferências de exibição do cabeçalho do Início (SPEC 121): tema e se o resumo aparece.
 * Ficam no navegador, por usuário: é gosto de tela, não dado de negócio, e não vale uma
 * coluna com migration. Trocar de máquina volta ao padrão.
 */

type Preferencias = { tema: TemaInicio; mostrarResumo: boolean };

const PADRAO: Preferencias = { tema: TEMA_PADRAO, mostrarResumo: true };

const chave = (userId: string | undefined) => `pilar:inicio:cabecalho:${userId ?? "anon"}`;

function ler(userId: string | undefined): Preferencias {
  try {
    const bruto = localStorage.getItem(chave(userId));
    if (!bruto) return PADRAO;
    const lido: unknown = JSON.parse(bruto);
    if (!lido || typeof lido !== "object") return PADRAO;
    const { tema, mostrarResumo } = lido as Record<string, unknown>;
    return {
      tema: ehTema(tema) ? tema : PADRAO.tema,
      mostrarResumo: typeof mostrarResumo === "boolean" ? mostrarResumo : PADRAO.mostrarResumo,
    };
  } catch {
    return PADRAO;
  }
}

export function useTemaInicio() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [estado, setEstado] = useState(() => ({ userId, preferencias: ler(userId) }));
  // O profile pode chegar depois da primeira renderização: se o dono mudou, relê.
  const preferencias = estado.userId === userId ? estado.preferencias : ler(userId);

  const salvar = useCallback(
    (proximo: Preferencias) => {
      setEstado({ userId, preferencias: proximo });
      try {
        localStorage.setItem(chave(userId), JSON.stringify(proximo));
      } catch {
        // localStorage indisponível (modo privado): vale na sessão, sem persistir.
      }
    },
    [userId]
  );

  return {
    ...preferencias,
    setTema: (tema: TemaInicio) => salvar({ ...preferencias, tema }),
    setMostrarResumo: (mostrarResumo: boolean) => salvar({ ...preferencias, mostrarResumo }),
  };
}
