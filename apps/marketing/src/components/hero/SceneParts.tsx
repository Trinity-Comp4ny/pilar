import { useEffect, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { EASE } from "../../lib/motion";
import { FRASE, RASCUNHO, idx } from "./scene";

/* Sobrepostos do palco: a barra do copiloto, o cartão de rascunho e o cursor
   do agente. As telas em si vivem em SceneScreens; a moldura, em SceneChrome.
   Medidas em pixels do palco de 1120x680 (ver scene.ts), que o HeroScene
   escala por CSS. */

/* ── Copiloto e rascunho ─────────────────────────────────────────────── */

/**
 * Digitação caractere a caractere. Roda sozinha enquanto o ato é "digita", em
 * vez de derivar do relógio da cena: o relógio só publica marcos, e uma frase
 * de 60 caracteres precisa de 60 atualizações próprias.
 */
function useDigitacao(ligado: boolean, texto: string, msPorChar = 46) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!ligado) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= texto.length) window.clearInterval(id);
    }, msPorChar);
    return () => window.clearInterval(id);
  }, [ligado, texto, msPorChar]);

  // Desligado devolve string vazia em vez de zerar `n` por efeito: o contador
  // fica obsoleto por um tique ao religar (~46ms), e em troca o reset não vira
  // um setState no corpo do efeito.
  return ligado ? texto.slice(0, n) : "";
}

export function BarraCopiloto({ ato }: { ato: number }) {
  const digitando = ato === idx("digita");
  const focado = ato >= idx("clicaCopiloto") && ato <= idx("rascunho");
  const cheio = ato > idx("digita") && ato < idx("funil");
  const parcial = useDigitacao(digitando, FRASE);
  const texto = cheio ? FRASE : parcial;

  return (
    <m.div
      className="absolute left-[236px] right-[40px] bottom-[26px] z-20 pointer-events-none"
      animate={{ y: focado ? -2 : 0 }}
      transition={{ duration: 0.3, ease: EASE.out }}
    >
      <m.div
        className="flex items-center gap-2.5 rounded-full bg-white border px-4 py-3"
        animate={{
          borderColor: focado ? "hsl(var(--brand-accent))" : "hsl(var(--border-landing) / 0.8)",
          boxShadow: focado
            ? "0 0 0 4px hsl(var(--brand-accent) / 0.22), 0 10px 34px -14px rgba(0,0,0,0.35)"
            : "0 10px 34px -14px rgba(0,0,0,0.35)",
        }}
        transition={{ duration: 0.35, ease: EASE.out }}
      >
        <Sparkles className="w-4 h-4 text-modulo-gestao-strong shrink-0" strokeWidth={1.9} />
        <span className="text-[12.5px] text-ink leading-none">
          {texto || <span className="text-ink-muted">Peça em português: recebi 128 mil do hospital</span>}
          {digitando && (
            <m.span
              className="inline-block w-[1.5px] h-[13px] align-middle ml-[1px] bg-ink"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          )}
        </span>
        <span className="ml-auto shrink-0 w-7 h-7 rounded-full bg-ink flex items-center justify-center">
          <span className="w-2 h-2 border-t-[1.5px] border-r-[1.5px] border-white rotate-[-45deg] -mt-[1px]" />
        </span>
      </m.div>
    </m.div>
  );
}

export function CartaoRascunho({ ato }: { ato: number }) {
  const reducedMotion = useReducedMotion();
  const pensando = ato === idx("pensa");
  const visivel = ato >= idx("rascunho") && ato < idx("funil");
  const aprovado = ato >= idx("confirma") && ato < idx("funil");

  return (
    <>
      <m.div
        className="absolute left-[252px] bottom-[86px] z-20 flex gap-1.5 rounded-full bg-white border border-paper-border/70 px-3 py-2 shadow-sm"
        animate={{ opacity: pensando ? 1 : 0, y: pensando ? 0 : 6 }}
        transition={{ duration: 0.25 }}
      >
        {[0, 1, 2].map((i) => (
          <m.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-ink-muted"
            animate={{ y: [0, -3.5, 0], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.14 }}
          />
        ))}
      </m.div>

      <m.div
        className="absolute right-[40px] bottom-[92px] w-[352px] z-20 pointer-events-none rounded-2xl bg-white border border-paper-border p-4 shadow-[0_22px_60px_-24px_rgba(0,0,0,0.4)]"
        animate={{
          opacity: visivel ? 1 : 0,
          y: visivel ? 0 : 22,
          scale: visivel ? 1 : 0.96,
        }}
        transition={{ type: "spring", stiffness: 240, damping: 26, mass: 0.8 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <m.span
            className="w-1.5 h-1.5 rounded-full bg-modulo-gestao-strong"
            animate={reducedMotion ? undefined : { opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span className="text-[8.5px] uppercase tracking-[0.11em] text-modulo-gestao-strong">
            Rascunho, aguardando aprovação
          </span>
        </div>

        {RASCUNHO.map(([chave, valor], i) => (
          <m.div
            key={chave}
            className="flex justify-between items-center text-[11px] py-[5px] border-b border-paper-border/40 last:border-0"
            animate={{ opacity: visivel ? 1 : 0, x: visivel ? 0 : 8 }}
            transition={{ duration: 0.35, delay: visivel ? 0.18 + i * 0.13 : 0, ease: EASE.out }}
          >
            <span className="text-ink-muted">{chave}</span>
            <span className="text-ink font-medium tabular-nums">{valor}</span>
          </m.div>
        ))}

        <div className="flex gap-2 mt-3.5">
          <m.span
            className="flex-1 text-center text-[10.5px] py-1.5 rounded-full font-medium"
            animate={{
              backgroundColor: aprovado ? "hsl(var(--modulo-gestao-strong))" : "hsl(var(--brand-accent))",
              color: aprovado ? "#ffffff" : "hsl(var(--text-on-brand))",
            }}
            transition={{ duration: 0.3 }}
          >
            {aprovado ? "Gravado no financeiro" : "Confirmar"}
          </m.span>
          <span className="px-3 text-[10.5px] py-1.5 rounded-full border border-paper-border text-ink-muted">
            Editar
          </span>
        </div>
      </m.div>
    </>
  );
}

/* ── Cursor do agente ────────────────────────────────────────────────── */

export function CursorAgente({ ato, x, y, rotulo }: { ato: number; x: number; y: number; rotulo: string | null }) {
  const clicando = ato === idx("clicaCopiloto") || ato === idx("confirma");

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
