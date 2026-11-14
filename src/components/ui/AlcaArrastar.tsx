import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { deveFecharSheet } from "@/lib/gestos";
import { haptico } from "@/lib/haptico";

/**
 * Alça no topo do sheet de baixo (celular): arrastar para baixo fecha, como nos apps nativos.
 * Só toque; o botão Fechar e o Esc seguem valendo. Fecha com 1/3 da altura ou num "flick".
 */
export function AlcaArrastar() {
  const alcaRef = React.useRef<HTMLDivElement>(null);
  const estado = React.useRef<{ y: number; t: number; painel: HTMLElement; ultimoDy: number; v: number } | null>(null);

  const painelDaAlca = () => alcaRef.current?.parentElement as HTMLElement | null;

  const aoTocar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    const painel = painelDaAlca();
    if (!painel) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    estado.current = { y: e.clientY, t: performance.now(), painel, ultimoDy: 0, v: 0 };
    painel.style.transition = "none";
  };

  const aoMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = estado.current;
    if (!st) return;
    const dy = Math.max(0, e.clientY - st.y);
    const agora = performance.now();
    st.v = (dy - st.ultimoDy) / Math.max(1, agora - st.t);
    st.ultimoDy = dy;
    st.t = agora;
    st.painel.style.transform = `translate3d(0, ${dy}px, 0)`;
  };

  const aoSoltar = () => {
    const st = estado.current;
    estado.current = null;
    if (!st) return;
    const altura = st.painel.getBoundingClientRect().height;
    if (deveFecharSheet(st.ultimoDy, altura, st.v)) {
      haptico("leve");
      // Termina a descida arrastada e entrega o fechamento ao Radix, sem a animação padrão
      // (ela recomeçaria do topo e daria um salto).
      st.painel.style.transition = "transform 0.18s ease-in";
      st.painel.style.transform = `translate3d(0, ${altura}px, 0)`;
      window.setTimeout(() => {
        st.painel.style.animation = "none";
        st.painel.querySelector<HTMLButtonElement>("[data-sheet-fechar]")?.click();
      }, 180);
      return;
    }
    st.painel.style.transition = "transform 0.2s ease-out";
    st.painel.style.transform = "";
  };

  return (
    <>
      <div
        ref={alcaRef}
        aria-hidden
        className="absolute left-1/2 top-0 z-10 flex h-6 w-28 -translate-x-1/2 touch-none justify-center pt-2"
        onPointerDown={aoTocar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
      </div>
      <SheetPrimitive.Close data-sheet-fechar className="sr-only" tabIndex={-1} aria-hidden />
    </>
  );
}
