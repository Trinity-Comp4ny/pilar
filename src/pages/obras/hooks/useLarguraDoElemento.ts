import { useEffect, useState, type RefObject } from "react";

/** Largura do elemento em px, atualizada quando ele muda de tamanho. 0 até medir (ou sem ResizeObserver). */
export function useLarguraDoElemento(ref: RefObject<HTMLElement | null>): number {
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setLargura(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(() => setLargura(el.clientWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return largura;
}
