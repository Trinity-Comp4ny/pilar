import { m } from "framer-motion";
import { EASE } from "../../lib/motion";
import { idx } from "./scene";

/* ── Cursor do agente ────────────────────────────────────────────────── */

export function CursorAgente({ ato, x, y, rotulo }: { ato: number; x: number; y: number; rotulo: string | null }) {
  const clicando = ato === idx("clicaAgentes") || ato === idx("confirma");

  return (
    <m.div
      className="absolute top-0 left-0 z-30 pointer-events-none"
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 130, damping: 22, mass: 0.85 }}
    >
      <m.span
        className="absolute -top-3 -left-3 w-11 h-11 rounded-full bg-brand/35"
        animate={{ scale: clicando ? [1, 2.1, 1] : 1, opacity: clicando ? [0.65, 0, 0] : 0.28 }}
        transition={{ duration: 0.55, ease: EASE.out }}
      />

      <svg width="20" height="24" viewBox="0 0 20 24" fill="none" className="relative drop-shadow-md">
        <path d="M2 1.6 17.4 12.2 10.4 13 6.6 20.6 2 1.6Z" fill="hsl(var(--text-ink))" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>

      <m.span
        className="absolute left-[18px] top-[18px] whitespace-nowrap rounded-full bg-ink text-white text-[10px] font-medium px-2.5 py-1 shadow-md"
        animate={{ opacity: rotulo ? 1 : 0, scale: rotulo ? 1 : 0.85, x: rotulo ? 0 : -5 }}
        transition={{ duration: 0.28, ease: EASE.out }}
      >
        {rotulo ?? ""}
      </m.span>
    </m.div>
  );
}
