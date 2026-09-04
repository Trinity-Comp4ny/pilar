import { useEffect, useRef, useState } from "react";
import { m, useInView, useReducedMotion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { EASE } from "../../lib/motion";

/**
 * Demonstração do agente trabalhando, encenada em cinco tempos.
 *
 * Roda uma vez quando entra na viewport e fica no estado final: é explicação,
 * não enfeite em loop. O conteúdo nasce inteiro no DOM e a encenação só decide
 * quando cada parte aparece, então nada fica em branco se a animação não puder
 * rodar (mesma correção do bug do ChatDemo antigo).
 */

const PEDIDO = "Recebi 128 mil do centro cirúrgico, primeira de três parcelas";

const CAMPOS: [string, string][] = [
  ["Projeto", "Climatização, centro cirúrgico"],
  ["Categoria", "Receita de projeto"],
  ["Valor", "R$ 128.400,00"],
  ["Parcela", "1 de 3, vence 18/09"],
];

/** Marcos da encenação, em ms a partir da entrada em vista. */
const MARCOS = [120, 1900, 2600, 4200, 5400];

function useDigitacao(ligado: boolean, texto: string, msPorChar = 28) {
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

  return ligado ? texto.slice(0, n) : "";
}

export function AgentDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const emVista = useInView(ref, { once: true, amount: 0.4 });
  const [passo, setPasso] = useState(0);

  const animar = !reducedMotion && emVista;

  useEffect(() => {
    if (!animar) return;
    const ids = MARCOS.map((ms, i) => window.setTimeout(() => setPasso(i + 1), ms));
    return () => ids.forEach(window.clearTimeout);
  }, [animar]);

  // Sem encenação, tudo já está no passo final.
  const p = animar ? passo : MARCOS.length;

  const digitando = animar && p === 1;
  const parcial = useDigitacao(digitando, PEDIDO);
  const pedido = p >= 2 ? PEDIDO : parcial;

  const surge = (n: number) => (p >= n ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 });

  return (
    <div ref={ref} className="rounded-2xl border border-white/12 bg-white/[0.04] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Sparkles className="w-3.5 h-3.5 text-brand" strokeWidth={1.9} />
        <span className="text-[11px] font-medium text-white">Agentes</span>
        <span className="ml-auto flex items-center gap-1.5 text-[9.5px] text-white/70">
          <m.span
            className="w-1.5 h-1.5 rounded-full bg-brand"
            animate={reducedMotion ? undefined : { opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.9, repeat: Infinity }}
          />
          48 créditos restantes
        </span>
      </div>

      <div className="flex flex-col gap-3.5 p-5 min-h-[340px]">
        {/* 1. O pedido, escrito em português. */}
        <m.div
          className="self-end max-w-[86%] rounded-2xl rounded-br-md bg-white/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-white"
          animate={surge(1)}
          transition={{ duration: 0.4, ease: EASE.out }}
        >
          {pedido || PEDIDO}
          {digitando && (
            <m.span
              className="ml-[1px] inline-block h-[13px] w-[1.5px] align-middle bg-white"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          )}
        </m.div>

        {/* 2. O agente lendo. */}
        {animar && p === 2 && (
          <div className="flex gap-1 self-start px-1 py-1.5">
            {[0, 1, 2].map((i) => (
              <m.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-white/40"
                animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.14 }}
              />
            ))}
          </div>
        )}

        {/* 3. O rascunho, campo a campo. */}
        <m.div className="self-start w-full" animate={surge(3)} transition={{ duration: 0.45, ease: EASE.out }}>
          <p className="mb-2.5 text-[12.5px] leading-relaxed text-white/70">
            Achei o projeto e montei o lançamento. Confere antes de eu gravar:
          </p>

          <div className="rounded-xl border border-white/12 bg-white/[0.05] p-3.5">
            <p className="mb-2.5 text-[8.5px] uppercase tracking-[0.11em] text-brand">Receita · aguardando aprovação</p>

            {CAMPOS.map(([k, v], i) => (
              <m.div
                key={k}
                className="flex items-center justify-between gap-3 border-b border-white/10 py-[5px] text-[11.5px] last:border-0"
                animate={p >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 8 }}
                transition={{ duration: 0.32, delay: p >= 3 ? 0.15 + i * 0.11 : 0, ease: EASE.out }}
              >
                <span className="text-white/70">{k}</span>
                <span className="font-medium tabular-nums text-white">{v}</span>
              </m.div>
            ))}

            {/* 4 e 5. O aval, e o botão vira confirmação. */}
            <div className="mt-3.5 flex gap-2">
              <m.span
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-[11.5px] font-medium"
                animate={{
                  backgroundColor: p >= 5 ? "hsl(var(--positive-strong))" : "hsl(var(--brand-accent))",
                  color: p >= 5 ? "#ffffff" : "hsl(var(--text-on-brand))",
                  scale: p === 4 ? [1, 0.96, 1] : 1,
                }}
                transition={{ duration: 0.35, ease: EASE.out }}
              >
                {p >= 5 && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                {p >= 5 ? "Gravado no financeiro" : "Confirmar"}
              </m.span>
              <span className="flex h-8 items-center rounded-full border border-white/15 px-3.5 text-[11.5px] text-white/70">
                Editar
              </span>
            </div>
          </div>
        </m.div>

        {/* 6. O que mudou no sistema depois do aval. */}
        <m.div
          className="mt-auto grid grid-cols-2 gap-2"
          animate={surge(5)}
          transition={{ duration: 0.45, ease: EASE.out }}
        >
          {[
            { r: "Recebido no mês", v: "R$ 412.900" },
            { r: "Margem do projeto", v: "31,4%" },
          ].map((k) => (
            <div key={k.r} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <p className="mb-1 text-[8.5px] uppercase tracking-wider text-white/65">{k.r}</p>
              <p className="text-[14px] font-semibold tabular-nums text-brand">{k.v}</p>
            </div>
          ))}
        </m.div>
      </div>
    </div>
  );
}
