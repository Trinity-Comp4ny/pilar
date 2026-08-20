import { useEffect, useRef, useState } from "react";

/**
 * Relógio da cena da hero.
 *
 * A cena é uma sequência de marcos em milissegundos. Em vez de recalcular a
 * cada quadro (o que re-renderizaria a árvore 60 vezes por segundo por causa de
 * um relógio), o relógio só publica um novo estado quando cruza um marco: são
 * ~15 renders por volta de 20 segundos.
 *
 * `ativo` false congela o tempo em vez de zerar. Isso atende dois requisitos da
 * SPEC 060 de uma vez: a cena não gasta CPU fora da viewport nem com a aba em
 * segundo plano, e ao voltar retoma exatamente de onde parou, sem pular atos.
 */
export function useScene(marcos: readonly number[], duracaoTotal: number, ativo: boolean) {
  const [indice, setIndice] = useState(0);
  const decorrido = useRef(0);
  const inicio = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!ativo) return;

    inicio.current = performance.now() - decorrido.current;
    let cancelado = false;

    const indiceEm = (t: number) => {
      let i = 0;
      while (i + 1 < marcos.length && marcos[i + 1] <= t) i++;
      return i;
    };

    const agendar = () => {
      if (cancelado) return;
      const t = performance.now() - inicio.current;
      const proximo = marcos.find((m) => m > t);
      const alvo = proximo ?? duracaoTotal;

      timer.current = window.setTimeout(
        () => {
          if (cancelado) return;
          if (proximo === undefined) {
            inicio.current = performance.now();
            decorrido.current = 0;
            setIndice(0);
          } else {
            setIndice(indiceEm(performance.now() - inicio.current));
          }
          agendar();
        },
        Math.max(16, alvo - t)
      );
    };

    setIndice(indiceEm(performance.now() - inicio.current));
    agendar();

    return () => {
      cancelado = true;
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      decorrido.current = performance.now() - inicio.current;
    };
  }, [ativo, marcos, duracaoTotal]);

  return indice;
}

/** True enquanto a aba está visível. A cena para junto, para não acumular atraso. */
export function useAbaVisivel() {
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    const trocar = () => setVisivel(document.visibilityState === "visible");
    trocar();
    document.addEventListener("visibilitychange", trocar);
    return () => document.removeEventListener("visibilitychange", trocar);
  }, []);

  return visivel;
}
