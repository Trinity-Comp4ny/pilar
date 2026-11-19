import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchDaRota } from "@/lib/entradaPrefetch";

/** Teto: se os dados da primeira tela demorarem mais que isso, o véu sai e a tela mostra o seu loading. */
export const TETO_ENTRADA_MS = 4000;

/**
 * true quando os dados da primeira tela já estão no cache (ou estourou o teto).
 * Começa assim que a empresa é conhecida, em paralelo com a checagem de assinatura.
 * Sem empresa ainda, não segura nada.
 */
export function useEntradaPronta(empresaId: string | undefined, pathname: string): boolean {
  const qc = useQueryClient();
  const [pronta, setPronta] = useState(false);
  const rota = useRef(pathname);
  rota.current = pathname;

  useEffect(() => {
    if (!empresaId) return;
    let ativo = true;
    const concluir = () => {
      if (ativo) setPronta(true);
    };
    const teto = window.setTimeout(concluir, TETO_ENTRADA_MS);
    void Promise.allSettled(prefetchDaRota(qc, rota.current)).then(() => {
      window.clearTimeout(teto);
      concluir();
    });
    return () => {
      ativo = false;
      window.clearTimeout(teto);
    };
  }, [empresaId, qc]);

  return pronta || !empresaId;
}
