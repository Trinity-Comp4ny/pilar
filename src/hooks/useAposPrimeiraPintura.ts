import { useEffect, useState } from "react";

/**
 * false até a tela entrar e o navegador ficar ocioso (teto de 2 s). Chamadas que não
 * pintam nada na primeira tela (avisos, novidades, registro do aparelho) esperam por isto
 * para não disputar rede com os dados que a tela precisa.
 */
export function useAposPrimeiraPintura(): boolean {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const liberar = () => setPronto(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(liberar, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(liberar, 800);
    return () => window.clearTimeout(id);
  }, []);
  return pronto;
}
