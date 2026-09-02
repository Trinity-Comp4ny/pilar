import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { Coins, PenLine, Sparkles } from "lucide-react";
import { EASE } from "../../lib/motion";
import { FRASE, RASCUNHO, idx } from "./scene";

/**
 * Tela de Agentes, copiada de `src/pages/chat/index.tsx`.
 *
 * Substitui a barra de copiloto que ficava flutuando no rodapé do mock: aquilo
 * não existe no produto. No app, o agente mora numa página própria, aberta pelo
 * item "Agentes" da barra lateral, com cabeçalho, alternância Trabalho/Conversa,
 * saldo de créditos e o campo de pergunta ao centro.
 */

/** Digitação caractere a caractere enquanto o ato é "digita". */
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

  return ligado ? texto.slice(0, n) : "";
}

export function TelaAgentes({ ato }: { ato: number }) {
  const digitando = ato === idx("digita");
  const jaEscreveu = ato > idx("digita");
  const parcial = useDigitacao(digitando, FRASE);
  const pedido = jaEscreveu ? FRASE : parcial;

  const pensando = ato === idx("pensa");
  const temConversa = ato >= idx("digita");
  const mostraResposta = ato >= idx("rascunho");
  const aprovado = ato >= idx("confirma");

  return (
    <div className="h-full flex flex-col">
      {/* Cabeçalho do app: título, alternância e saldo de créditos. */}
      <header className="h-14 shrink-0 flex items-center gap-3 px-6 border-b border-black/5">
        <h3 className="text-[15px] font-medium tracking-tight text-ink">Agentes</h3>

        <span className="mx-auto inline-flex rounded-full bg-black/5 p-0.5 text-[11px] font-medium">
          <span className="px-3.5 py-1 rounded-full text-ink-soft">Trabalho</span>
          <span className="px-3.5 py-1 rounded-full bg-brand text-ink">Conversa</span>
        </span>

        <span className="flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-[10.5px] font-medium text-ink-muted">
          <Coins className="w-3 h-3" strokeWidth={1.8} />
          48 créditos restantes
        </span>
        <span className="flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-[10.5px] font-medium text-ink">
          <PenLine className="w-3 h-3" strokeWidth={1.8} />
          Nova conversa
        </span>
      </header>

      <div className="flex-1 overflow-hidden px-4 py-6">
        {!temConversa ? (
          /* Estado vazio: herói centralizado, como no app. */
          <div className="h-full flex flex-col items-center justify-center text-center">
            <span className="mb-5 flex w-12 h-12 items-center justify-center rounded-2xl bg-brand text-ink">
              <Sparkles className="w-6 h-6" strokeWidth={1.8} />
            </span>
            <h4 className="text-[22px] font-semibold tracking-tight text-ink">Boa tarde, Marina</h4>
            <p className="mt-2 max-w-md text-[12.5px] text-ink-muted leading-relaxed">
              3 agentes prontos: Financeiro, Projetos e Comercial. Pergunte em linguagem natural e eles consultam seus
              dados e respondem na hora.
            </p>
            <div className="mt-7 w-full max-w-[520px] rounded-2xl border border-black/10 bg-white px-4 py-3 text-left">
              <span className="text-[12.5px] text-black/30">Pergunte alguma coisa…</span>
            </div>
          </div>
        ) : (
          /* Conversa: coluna estreita e centralizada, como o app faz. */
          <div className="mx-auto flex max-w-[560px] flex-col gap-4">
            <div className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-black/5 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink">
              {pedido}
              {digitando && (
                <m.span
                  className="inline-block w-[1.5px] h-[13px] align-middle ml-[1px] bg-ink"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                />
              )}
            </div>

            {pensando && (
              <div className="flex gap-1 self-start px-1 py-2">
                {[0, 1, 2].map((i) => (
                  <m.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-black/25"
                    animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            )}

            <m.div
              className="self-start w-full"
              animate={{ opacity: mostraResposta ? 1 : 0, y: mostraResposta ? 0 : 12 }}
              transition={{ duration: 0.45, ease: EASE.out }}
            >
              <p className="mb-2.5 text-[12.5px] leading-relaxed text-ink-soft">
                Achei o projeto e montei o lançamento. Confere antes de eu gravar:
              </p>

              {/* Cartão de ação aguardando aprovação, o padrão do AcaoCard. */}
              <div className="rounded-xl border border-black/10 bg-white p-3.5">
                <p className="mb-2.5 text-[8.5px] uppercase tracking-[0.11em] text-ink-muted">
                  Receita · aguardando aprovação
                </p>
                {RASCUNHO.map(([chave, valor], i) => (
                  <m.div
                    key={chave}
                    className="flex justify-between items-center gap-3 border-b border-black/5 py-[5px] text-[11.5px] last:border-0"
                    animate={{ opacity: mostraResposta ? 1 : 0, x: mostraResposta ? 0 : 6 }}
                    transition={{ duration: 0.32, delay: mostraResposta ? 0.15 + i * 0.1 : 0, ease: EASE.out }}
                  >
                    <span className="text-ink-muted">{chave}</span>
                    <span className="font-medium tabular-nums text-ink">{valor}</span>
                  </m.div>
                ))}

                <div className="mt-3 flex gap-2">
                  <m.span
                    className="flex h-8 flex-1 items-center justify-center rounded-full text-[11.5px] font-medium"
                    animate={{
                      backgroundColor: aprovado ? "hsl(var(--positive-strong))" : "hsl(var(--brand-accent))",
                      color: aprovado ? "#ffffff" : "hsl(var(--text-on-brand))",
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {aprovado ? "Gravado no financeiro" : "Confirmar"}
                  </m.span>
                  <span className="flex h-8 items-center rounded-full border border-black/10 px-3.5 text-[11.5px] text-ink-muted">
                    Editar
                  </span>
                </div>
              </div>
            </m.div>
          </div>
        )}
      </div>
    </div>
  );
}
