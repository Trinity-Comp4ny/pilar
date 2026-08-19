import { useEffect, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";

interface RotatingWordProps {
  words: string[];
  intervalMs?: number;
  className?: string;
}

/** Palavra que gira em loop dentro do H1, estilo Notion. Pausa com a aba em segundo plano. */
export function RotatingWord({ words, intervalMs = 2200, className }: RotatingWordProps) {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setIndex((i) => (i + 1) % words.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [reducedMotion, words.length, intervalMs]);

  if (reducedMotion) {
    return <span className={`block ${className ?? ""}`}>{words[0]}</span>;
  }

  return (
    <span className="block overflow-hidden">
      <AnimatePresence mode="wait">
        <m.span
          key={words[index]}
          className={`inline-block ${className ?? ""}`}
          initial={{ y: 28, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -28, opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
        >
          {words[index]}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
