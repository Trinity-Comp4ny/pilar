import { Suspense, lazy } from "react";
import type { SwipeRowProps } from "./SwipeRowImpl";

// Lazy: o gesto só serve em tela de toque e fica fora do bundle de entrada (teto apertado).
const SwipeRowImpl = lazy(() => import("./SwipeRowImpl").then((m) => ({ default: m.SwipeRowImpl })));
const TELA_DE_TOQUE = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

/**
 * Linha de lista deslizável (celular): arrasta para um lado e solta para executar a ação.
 * Em tela sem toque vira só a linha; o carregamento do gesto é sob demanda (ver SwipeRowImpl).
 */
export function SwipeRow(props: SwipeRowProps) {
  if (!TELA_DE_TOQUE) return <div className={props.className}>{props.children}</div>;
  return (
    <Suspense fallback={<div className={props.className}>{props.children}</div>}>
      <SwipeRowImpl {...props} />
    </Suspense>
  );
}
