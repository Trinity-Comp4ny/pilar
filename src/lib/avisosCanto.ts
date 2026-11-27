import { useEffect, useSyncExternalStore } from "react";

/**
 * Quantos avisos do canto inferior direito estão na tela agora. O checklist de início lê isso para
 * virar pílula enquanto há aviso (os dois no mesmo canto não cabem abertos em notebook).
 */
let total = 0;
const ouvintes = new Set<() => void>();

function mudar(delta: number) {
  total += delta;
  ouvintes.forEach((l) => l());
}

/** Chamado por quem desenha um aviso: conta enquanto estiver montado. */
export function useRegistrarAviso() {
  useEffect(() => {
    mudar(1);
    return () => mudar(-1);
  }, []);
}

export function useTemAvisoNoCanto(): boolean {
  return useSyncExternalStore(
    (l) => {
      ouvintes.add(l);
      return () => ouvintes.delete(l);
    },
    () => total > 0,
    () => false
  );
}
