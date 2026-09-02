import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { EASE } from "../../lib/motion";
import { FRASE, RASCUNHO, idx } from "./scene";

/**
 * Versão retrato da cena, para telas estreitas.
 *
 * O palco de desktop tem 1120px de largura fixa e é escalado por CSS. Num
 * celular de 390px isso dá escala 0,30: um rótulo de 10,5px vira 3,2px e nada
 * é legível. Em vez de encolher a mesma tela, aqui a cena conta a MESMA
 * história sem a moldura do app (barra de navegador e barra lateral são o que
 * menos importa num celular), com tipografia em tamanho de leitura.
 *
 * Compartilha o relógio e o roteiro com a versão de desktop: o `ato` que chega
 * é o mesmo índice, então as duas nunca contam histórias diferentes.
 */

function useDigitacao(ligado: boolean, texto: string, msPorChar = 42) {
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

export function HeroSceneMobile({ ato, estatico }: { ato: number; estatico: boolean }) {
  const digitando = !estatico && ato === idx("digita");
  const jaEscreveu = ato > idx("digita");
  const parcial = useDigitacao(digitando, FRASE);
  const pedido = estatico || jaEscreveu ? FRASE : parcial;

  const pensando = !estatico && ato === idx("pensa");
  const mostraRascunho = estatico || ato >= idx("rascunho");
  const aprovado = ato >= idx("confirma");
  const mostraResultado = ato >= idx("financeiro");

  return (
    <div
      aria-hidden="true"
      className="relative rounded-2xl border border-paper-border bg-white overflow-hidden shadow-[0_2px_4px_rgba(0,0,0,0.04),0_20px_50px_-24px_rgba(0,0,0,0.3)]"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-paper-border/70 bg-paper-alt/60">
        <img src="/pilar-logo.svg" alt="" className="w-5 h-5 shrink-0" />
        <span className="text-[12px] font-medium text-ink">Copiloto do escritório</span>
        <m.span
          className="ml-auto w-1.5 h-1.5 rounded-full bg-brand"
          animate={estatico ? undefined : { opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.9, repeat: Infinity }}
        />
      </div>

      <div className="p-4 flex flex-col gap-3 min-h-[400px]">
        {/* Pedido do usuário. Enquanto nada foi digitado, o balão vira o
            convite: no reinício do loop a cena tem ~1,5s sem conteúdo, e um
            retângulo vazio pareceria quebrado. */}
        {pedido ? (
          <div className="self-end max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-ink text-white text-[13px] leading-relaxed">
            {pedido}
            {digitando && (
              <m.span
                className="inline-block w-[1.5px] h-[13px] align-middle ml-[1px] bg-white"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
              />
            )}
          </div>
        ) : (
          <div className="self-end max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-br-md border border-dashed border-paper-border text-ink-muted text-[13px] leading-relaxed">
            Peça em português o que aconteceu
          </div>
        )}

        {pensando && (
          <div className="self-start flex gap-1 px-3 py-2.5 rounded-2xl bg-paper-alt">
            {[0, 1, 2].map((i) => (
              <m.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-ink-muted"
                animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        )}

        {/* Espaço reservado do rascunho: mantém a altura estável entre os atos
            e explica o que vai acontecer, em vez de deixar um vão branco. */}
        {!mostraRascunho && (
          <div className="rounded-xl border border-dashed border-paper-border px-3.5 py-6 text-center">
            <p className="text-[11.5px] text-ink-muted leading-snug">
              O agente monta o lançamento aqui e espera o seu aval.
            </p>
          </div>
        )}

        {/* Rascunho */}
        <m.div
          className={`rounded-xl border border-paper-border bg-white p-3.5 shadow-sm ${mostraRascunho ? "" : "hidden"}`}
          animate={{ opacity: mostraRascunho ? 1 : 0, y: mostraRascunho ? 0 : 14 }}
          transition={{ duration: 0.45, ease: EASE.out }}
        >
          <p className="text-[8.5px] uppercase tracking-[0.11em] text-ink mb-2.5">
            Rascunho, aguardando aprovação
          </p>
          {RASCUNHO.map(([chave, valor]) => (
            <div
              key={chave}
              className="flex justify-between items-center gap-3 text-[12px] py-1 border-b border-paper-border/40 last:border-0"
            >
              <span className="text-ink-muted shrink-0">{chave}</span>
              <span className="text-ink font-medium tabular-nums text-right">{valor}</span>
            </div>
          ))}
          <m.div
            className="mt-3 flex items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-medium"
            animate={{
              backgroundColor: aprovado ? "hsl(var(--brand-accent))" : "hsl(var(--brand-accent))",
              color: aprovado ? "#ffffff" : "hsl(var(--text-on-brand))",
            }}
            transition={{ duration: 0.3 }}
          >
            {aprovado && <Check className="w-3.5 h-3.5" strokeWidth={2.6} />}
            {aprovado ? "Gravado no financeiro" : "Confirmar"}
          </m.div>
        </m.div>

        {/* Resultado: o que mudou no sistema depois do aval */}
        <m.div
          className="mt-auto grid grid-cols-2 gap-2"
          animate={{ opacity: mostraResultado ? 1 : 0, y: mostraResultado ? 0 : 12 }}
          transition={{ duration: 0.5, ease: EASE.out }}
        >
          <div className="rounded-xl border border-paper-border/70 bg-paper-alt/50 px-3 py-2.5">
            <p className="text-[8.5px] uppercase tracking-[0.1em] text-ink-muted mb-1">Recebido no mês</p>
            <p className="text-[15px] font-medium text-ink tabular-nums">R$ 412.900</p>
          </div>
          <div className="rounded-xl border border-paper-border/70 bg-paper-alt/50 px-3 py-2.5">
            <p className="text-[8.5px] uppercase tracking-[0.1em] text-ink-muted mb-1">Margem do projeto</p>
            <p className="text-[15px] font-medium text-ink tabular-nums">31,4%</p>
          </div>
        </m.div>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-paper-border/70">
        <Sparkles className="w-3.5 h-3.5 text-ink shrink-0" strokeWidth={1.9} />
        <p className="text-[11px] text-ink-muted leading-snug">Nada é gravado sem o seu aval.</p>
      </div>
    </div>
  );
}
