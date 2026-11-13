import { useEffect, useState, type RefObject } from "react";

const TOPO = 24;
const LIMIAR = 6;

/**
 * Diz se uma faixa do cabeçalho deve recolher: rolou para baixo, recolhe; rolou para cima ou
 * voltou ao topo, mostra de novo. Escuta a rolagem de qualquer área dentro de `alvo` (a tela
 * pode rolar no `main` ou numa lista interna) e ignora rolagem só na horizontal (quadro, abas).
 * No celular, o cabeçalho do Financeiro somava 197 px de 844 (auditoria de espaço, 2026-11).
 */
export function useRecolherAoRolar(alvo: RefObject<HTMLElement>, ativo: boolean): boolean {
  const [recolhido, setRecolhido] = useState(false);

  useEffect(() => {
    const el = alvo.current;
    if (!el || !ativo) return;
    const ultimo = new WeakMap<EventTarget, number>();
    const aoRolar = (e: Event) => {
      const origem = e.target;
      if (!(origem instanceof HTMLElement)) return;
      const topo = origem.scrollTop;
      const delta = topo - (ultimo.get(origem) ?? 0);
      ultimo.set(origem, topo);
      if (topo < TOPO) setRecolhido(false);
      else if (delta > LIMIAR) setRecolhido(true);
      else if (delta < -LIMIAR) setRecolhido(false);
    };
    el.addEventListener("scroll", aoRolar, { capture: true, passive: true });
    return () => el.removeEventListener("scroll", aoRolar, { capture: true });
  }, [alvo, ativo]);

  return ativo && recolhido;
}
