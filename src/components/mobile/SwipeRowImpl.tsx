import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { decidirDeslize, ehHorizontal, limitarDeslize } from "@/lib/gestos";
import { haptico } from "@/lib/haptico";

interface AcaoDeslize {
  rotulo: string;
  icone: ReactNode;
  /** Fundo da ação: token semântico (ex.: "bg-success", "bg-destructive"). */
  className: string;
  onAcionar: () => void;
}

export interface SwipeRowProps {
  children: ReactNode;
  /** Revelada ao arrastar para a direita. */
  acaoEsquerda?: AcaoDeslize;
  /** Revelada ao arrastar para a esquerda. */
  acaoDireita?: AcaoDeslize;
  className?: string;
}

const LARGURA_ACAO = 88;

/**
 * Linha de lista deslizável (celular): arrasta para um lado e solta para executar a ação
 * (arquivar, marcar como lida, aprovar). Só reage a toque; mouse e teclado seguem usando os
 * botões da própria linha, que continuam sendo o caminho acessível. Gesto vertical rola a página.
 */
export function SwipeRowImpl({ children, acaoEsquerda, acaoDireita, className }: SwipeRowProps) {
  const [dx, setDx] = useState(0);
  const [solto, setSolto] = useState(true);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const travado = useRef(false);
  const passouLimiar = useRef(false);
  const larguraEsq = acaoEsquerda ? LARGURA_ACAO : 0;
  const larguraDir = acaoDireita ? LARGURA_ACAO : 0;

  if (!acaoEsquerda && !acaoDireita) return <div className={className}>{children}</div>;

  const aoTocar = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    inicio.current = { x: e.clientX, y: e.clientY };
    travado.current = false;
    passouLimiar.current = false;
  };

  const aoMover = (e: React.PointerEvent) => {
    if (!inicio.current || e.pointerType !== "touch") return;
    const ddx = e.clientX - inicio.current.x;
    const ddy = e.clientY - inicio.current.y;
    if (!travado.current) {
      if (Math.abs(ddy) > 12 && !ehHorizontal(ddx, ddy)) {
        inicio.current = null;
        return;
      }
      if (!ehHorizontal(ddx, ddy)) return;
      travado.current = true;
      setSolto(false);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    const valor = limitarDeslize(ddx, larguraEsq, larguraDir);
    setDx(valor);
    const passou = decidirDeslize(valor, larguraEsq, larguraDir) !== "volta";
    if (passou && !passouLimiar.current) haptico("leve");
    passouLimiar.current = passou;
  };

  const aoSoltar = () => {
    const decisao = travado.current ? decidirDeslize(dx, larguraEsq, larguraDir) : "volta";
    inicio.current = null;
    travado.current = false;
    setSolto(true);
    setDx(0);
    if (decisao === "esquerda") acaoEsquerda?.onAcionar();
    if (decisao === "direita") acaoDireita?.onAcionar();
  };

  // Toque que virou arrasto não deve disparar o clique da linha ao soltar.
  const aoClicarCaptura = (e: React.MouseEvent) => {
    if (travado.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const mostrando = dx > 0 ? acaoEsquerda : dx < 0 ? acaoDireita : undefined;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {mostrando && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-y-0 flex items-center gap-1.5 px-5 text-sm font-medium text-white",
            dx > 0 ? "left-0 justify-start" : "right-0 justify-end",
            mostrando.className
          )}
          style={{ width: Math.abs(dx) + 1 }}
        >
          {mostrando.icone}
          <span className="whitespace-nowrap">{mostrando.rotulo}</span>
        </div>
      )}
      <div
        className="relative touch-pan-y bg-background"
        style={{
          transform: `translate3d(${dx}px,0,0)`,
          transition: solto ? "transform 0.2s ease-out" : "none",
        }}
        onPointerDown={aoTocar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={() => {
          inicio.current = null;
          travado.current = false;
          setSolto(true);
          setDx(0);
        }}
        onClickCapture={aoClicarCaptura}
      >
        {children}
      </div>
    </div>
  );
}
