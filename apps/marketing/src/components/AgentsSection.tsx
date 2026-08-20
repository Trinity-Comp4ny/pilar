import { useEffect, useRef, useState } from "react";
import { m, useInView, useReducedMotion } from "framer-motion";
import { ClipboardList, FileSpreadsheet, ImageIcon, Lock, ScrollText, Sparkles, Timer, Undo2 } from "lucide-react";
import { Reveal } from "./Reveal";
import { RevealGroup, TextReveal } from "./motion";
import { EASE } from "../lib/motion";

/**
 * Agentes de IA. É o clímax escuro da página (SPEC 060): antes eram cinco
 * seções seguidas em dois cinzas quase idênticos, e nada marcava o meio.
 *
 * Só entram aqui os agentes que rodam de fato hoje; o orçamentista de
 * honorários aparece sem selo "Vivo" porque a fila de revisão funciona mas o
 * gatilho está atrás de uma flag desligada.
 */

const AGENTES = [
  {
    icone: Sparkles,
    nome: "Copiloto do escritório",
    vivo: true,
    texto:
      "Entende o pedido em português e monta o registro: lead, projeto, proposta, receita, despesa, folha. Também executa operações sobre o que já existe, como converter um lead ou quitar uma parcela.",
  },
  {
    icone: ImageIcon,
    nome: "Leitor de orçamento",
    vivo: true,
    texto:
      "Fotografe o orçamento do fornecedor, ou solte o PDF. Ele reconhece sozinho se aquilo é cesta de compra ou comparação entre lojas, e devolve os itens com quantidade, preço, prazo e condição.",
  },
  {
    icone: FileSpreadsheet,
    nome: "Importador de extrato",
    vivo: true,
    texto:
      "Solte o extrato do mês ou a fatura do cartão. Ele separa cada movimento em receita ou despesa, identifica parcela 3 de 12 e sugere a categoria do seu plano de contas.",
  },
  {
    icone: ClipboardList,
    nome: "Orçamentista de honorários",
    vivo: false,
    texto:
      "Calibra horas, custo por hora e margem por disciplina usando o histórico do seu próprio escritório, e entrega premissas e riscos junto. Entra no projeto só depois que você aprova.",
  },
];

const GUARDA_CORPOS = [
  {
    icone: Undo2,
    titulo: "Você aprova, sempre",
    texto:
      "O agente nunca grava direto. O rascunho aparece editável, e o botão de desfazer apaga exatamente o que aquela execução criou.",
  },
  {
    icone: Lock,
    titulo: "Só vê o que você vê",
    texto:
      "O agente lê o banco com a sua permissão, não com chave de administrador. Ele não alcança dado de outra empresa.",
  },
  {
    icone: Timer,
    titulo: "Teto de custo por mês",
    texto: "Existe limite mensal de uso por empresa, contado no servidor. Nenhum cliente estica o próprio teto.",
  },
  {
    icone: ScrollText,
    titulo: "Tudo fica registrado",
    texto: "Cada execução guarda o pedido, o raciocínio passo a passo e o resultado, então dá para auditar depois.",
  },
];

const CAMPOS_RASCUNHO = [
  ["Projeto", "Climatização, centro cirúrgico"],
  ["Valor", "R$ 128.400,00"],
  ["Parcela", "1 de 3"],
  ["Recebido em", "18/08/2026"],
];

/**
 * Conversa encenada. A encenação só decide QUANDO cada balão entra; o conteúdo
 * está sempre no DOM.
 *
 * A versão anterior nascia com todos os balões em `opacity: 0` e só os
 * revelava depois de um IntersectionObserver disparar `setTimeout`s de até
 * 2,5s. Na prática o card ficava em branco durante a leitura, e ficava em
 * branco para sempre quando o observer não batia o limiar de 35%. Agora o
 * estado inicial é "tudo visível" e a animação é um enfeite por cima.
 */
function ChatDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const emVista = useInView(ref, { once: true, amount: 0.25 });
  const [passo, setPasso] = useState(0);

  // Só encena quando dá: sem `prefers-reduced-motion` e já em vista. Em
  // qualquer outro caso `surge` devolve o estado final, então o conteúdo
  // aparece pronto em vez de esperar um timer que pode nunca disparar.
  const animar = !reducedMotion && emVista;

  useEffect(() => {
    if (!animar) return;
    const ids = [150, 800, 1650, 2350].map((ms, i) => window.setTimeout(() => setPasso(i + 1), ms));
    return () => ids.forEach(window.clearTimeout);
  }, [animar]);

  const surge = (n: number) => (!animar || passo >= n ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 });

  return (
    <div ref={ref} className="rounded-2xl border border-white/12 bg-white/[0.045] backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <m.span
          className="w-1.5 h-1.5 rounded-full bg-brand"
          animate={reducedMotion ? undefined : { opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.9, repeat: Infinity }}
        />
        <span className="text-[9px] uppercase tracking-[0.12em] text-white/45">Agente financeiro</span>
      </div>

      <div className="p-5 flex flex-col gap-3 min-h-[290px]">
        <m.div
          className="self-end max-w-[83%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-brand text-ink-on-brand text-[12.5px] leading-relaxed"
          animate={surge(1)}
          transition={{ duration: 0.45, ease: EASE.out }}
        >
          Recebi 128 mil do centro cirúrgico hoje, primeira de três parcelas
        </m.div>

        {animar && passo < 3 && (
          <m.div
            className="self-start flex gap-1 px-3 py-2.5 rounded-2xl bg-white/8"
            animate={surge(2)}
            transition={{ duration: 0.3 }}
          >
            {[0, 1, 2].map((i) => (
              <m.span
                key={i}
                className="w-1 h-1 rounded-full bg-white/50"
                animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.16 }}
              />
            ))}
          </m.div>
        )}

        <m.div
          className="self-start max-w-[83%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white/8 text-white/75 text-[12.5px] leading-relaxed"
          animate={surge(3)}
          transition={{ duration: 0.45, ease: EASE.out }}
        >
          Achei o projeto e montei o lançamento. Confere antes de eu gravar:
        </m.div>

        <m.div
          className="self-start w-[90%] rounded-xl border border-brand/45 bg-white/[0.06] p-3.5"
          animate={surge(4)}
          transition={{ duration: 0.45, ease: EASE.out }}
        >
          <p className="text-[8px] uppercase tracking-[0.12em] text-brand mb-2.5">Rascunho, aguardando aprovação</p>
          {CAMPOS_RASCUNHO.map(([k, v]) => (
            <div key={k} className="flex justify-between text-[11.5px] py-[3px] text-white/55">
              <span>{k}</span>
              <span className="text-white font-medium tabular-nums">{v}</span>
            </div>
          ))}
          <div className="flex gap-1.5 mt-3">
            <span className="text-[10.5px] px-3 py-1.5 rounded-full bg-brand text-ink-on-brand font-semibold">
              Confirmar
            </span>
            <span className="text-[10.5px] px-3 py-1.5 rounded-full border border-white/20 text-white/55">Editar</span>
          </div>
        </m.div>
      </div>
    </div>
  );
}

export function AgentsSection() {
  return (
    <section id="agentes" className="relative py-24 md:py-32 bg-ink text-white scroll-mt-20 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[420px] rounded-full bg-brand/12 blur-[120px] pointer-events-none"
      />

      <div className="relative container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12">
            <Reveal variant="down" className="mb-5">
              <span className="inline-block px-3 py-1 bg-brand text-ink-on-brand text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Agentes de IA
              </span>
            </Reveal>
            <TextReveal
              as="h2"
              text="A IA prepara o trabalho. Você dá a palavra final."
              highlight="Você dá a palavra final."
              highlightClassName="italic text-white/45"
              className="text-3xl md:text-[44px] font-medium text-white leading-[1.1] tracking-tight mb-5"
            />
            <Reveal variant="fade" delay={0.25}>
              <p className="text-[15px] text-white/60 font-light leading-relaxed">
                Escreva em português o que aconteceu. O agente monta o registro pronto, você confere e confirma. Nada é
                gravado sem o seu aval.
              </p>
            </Reveal>
          </div>

          <div className="grid lg:grid-cols-[1.15fr_1fr] gap-5 items-start">
            <Reveal variant="left" loose>
              <ChatDemo />
            </Reveal>

            <RevealGroup className="flex flex-col gap-2.5" stagger={0.09}>
              {AGENTES.map((a) => (
                <RevealGroup.Item key={a.nome} variant="right">
                  <div className="group rounded-xl border border-white/10 bg-white/[0.035] p-4 transition-all duration-300 hover:bg-white/[0.07] hover:border-white/20 hover:-translate-y-0.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <a.icone
                        className="w-3.5 h-3.5 text-brand shrink-0 transition-transform duration-300 group-hover:scale-110"
                        strokeWidth={1.8}
                      />
                      <span className="text-[12.5px] font-medium text-white">{a.nome}</span>
                      {a.vivo && (
                        <span className="ml-auto flex items-center gap-1 text-[7.5px] uppercase tracking-[0.1em] text-brand border border-brand/40 rounded px-1.5 py-0.5 shrink-0">
                          <span className="w-1 h-1 rounded-full bg-brand" />
                          Vivo
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-white/50 leading-relaxed font-light">{a.texto}</p>
                  </div>
                </RevealGroup.Item>
              ))}
            </RevealGroup>
          </div>

          <RevealGroup
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12 pt-9 border-t border-white/10"
            stagger={0.07}
          >
            {GUARDA_CORPOS.map((g) => (
              <RevealGroup.Item key={g.titulo} variant="up">
                <div className="group">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <g.icone
                      className="w-3.5 h-3.5 text-brand shrink-0 transition-transform duration-300 group-hover:scale-110"
                      strokeWidth={1.9}
                    />
                    <span className="text-[12.5px] font-medium text-white">{g.titulo}</span>
                  </div>
                  <p className="text-[11.5px] text-white/50 leading-relaxed font-light">{g.texto}</p>
                </div>
              </RevealGroup.Item>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
