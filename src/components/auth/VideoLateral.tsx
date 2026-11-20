import { useEffect, useState } from "react";

const DESKTOP = "(min-width: 1024px)";

/**
 * Vídeo do painel lateral das telas de entrada. O painel só aparece a partir de `lg`;
 * em tela menor o vídeo (14 MB) nem é pedido, em vez de baixar escondido.
 */
export function VideoLateral({ className }: { className?: string }) {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(DESKTOP).matches
      : false
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(DESKTOP);
    const mudou = () => setDesktop(mq.matches);
    mq.addEventListener("change", mudou);
    return () => mq.removeEventListener("change", mudou);
  }, []);

  if (!desktop) return null;
  return (
    <video
      src="/video-login.mp4"
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      className={className}
      style={{ animationDuration: "20s" }}
    />
  );
}
