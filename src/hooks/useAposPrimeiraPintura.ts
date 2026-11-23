import { useEffect, useState } from "react";

/**
 * false por ~1 s depois que a tela entra. Chamadas que não pintam nada na primeira tela
 * (avisos, novidades, registro do aparelho) esperam por isto para não disputar rede
 * com os dados que a tela precisa.
 */
export function useAposPrimeiraPintura(): boolean {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setPronto(true), 1000);
    return () => window.clearTimeout(id);
  }, []);
  return pronto;
}
