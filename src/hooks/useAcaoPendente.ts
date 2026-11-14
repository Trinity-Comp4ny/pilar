import { useCallback, useRef, useState } from "react";

/**
 * Marca uma ação assíncrona como "em andamento" por chave (ex.: o id da linha), para o
 * botão mostrar a marca de espera e não aceitar o segundo clique enquanto o primeiro não
 * termina (ADR 0049: toda espera dá retorno visível). A promessa da ação é devolvida
 * como veio; quem chama continua tratando o erro.
 *
 * `executar` ignora uma chave que já está pendente e resolve `undefined`.
 */
export function useAcaoPendente() {
  const [pendentes, setPendentes] = useState<ReadonlySet<string>>(() => new Set());
  // Ref para o clique duplo no mesmo tick, antes do re-render refletir o estado.
  const emCurso = useRef(new Set<string>());

  const executar = useCallback(async <T>(chave: string, acao: () => Promise<T>): Promise<T | undefined> => {
    if (emCurso.current.has(chave)) return undefined;
    emCurso.current.add(chave);
    setPendentes(new Set(emCurso.current));
    try {
      return await acao();
    } finally {
      emCurso.current.delete(chave);
      setPendentes(new Set(emCurso.current));
    }
  }, []);

  const pendente = useCallback((chave: string) => pendentes.has(chave), [pendentes]);

  return { executar, pendente, algumaPendente: pendentes.size > 0 };
}
