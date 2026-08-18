import { useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { ClipboardList, FileSpreadsheet, ImageIcon, Lock, ScrollText, Sparkles, Timer, Undo2 } from "lucide-react";
import { Reveal } from "./Reveal";
import { SpotlightCard } from "./SpotlightCard";

/**
 * Agentes de IA. Só entram aqui os que rodam de fato hoje; o orçamentista de
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

/** Conversa encenada, que roda quando a seção entra na viewport. */
function ChatDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [emVista, setEmVista] = useState(false);
  const [encenado, setEncenado] = useState(0);

  // IntersectionObserver direto em vez do useInView do framer-motion: são
  // poucas linhas e evita puxar o pacote além do preset `domAnimation`.
  useEffect(() => {
    const alvo = ref.current;
    if (!alvo || typeof IntersectionObserver === "undefined") {
      setEmVista(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setEmVista(true);
          obs.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion || !emVista) return;
    const marcos = [200, 900, 1800, 2500];
    const ids = marcos.map((ms, i) => window.setTimeout(() => setEncenado(i + 1), ms));
    return () => ids.forEach(window.clearTimeout);
  }, [emVista, reducedMotion]);

  // Sem animação, a conversa nasce inteira; com ela, o passo vem da encenação.
  const passo = reducedMotion ? 4 : encenado;

  const surge = (n: number) => (passo >= n ? { opacity: 1, y: 0 } : { opacity: 0, y: reducedMotion ? 0 : 7 });

  return (
    <div ref={ref} className="bg-white border border-paper-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-paper-border/60 bg-paper-alt flex items-center gap-2">
        <m.span
          className="w-1.5 h-1.5 rounded-full bg-modulo-gestao-strong"
          animate={reducedMotion ? undefined : { opacity: [1, 0.35, 1] }}
          transition={{ duration: 1.9, repeat: Infinity }}
        />
        <span className="text-[9px] uppercase tracking-[0.1em] text-ink-muted">Agente financeiro</span>
      </div>

      <div className="p-4 flex flex-col gap-3 min-h-[250px]">
        <m.div
          className="self-end max-w-[83%] px-3 py-2 rounded-xl rounded-br-sm bg-ink text-white text-xs leading-relaxed"
          animate={surge(1)}
          transition={{ duration: 0.45 }}
        >
          Recebi 128 mil do centro cirúrgico hoje, primeira de três parcelas
        </m.div>

        {passo < 3 && (
          <m.div
            className="self-start flex gap-1 px-3 py-2.5 rounded-xl bg-paper-alt"
            animate={surge(2)}
            transition={{ duration: 0.3 }}
          >
            {[0, 1, 2].map((i) => (
              <m.span
                key={i}
                className="w-1 h-1 rounded-full bg-ink-muted"
                animate={reducedMotion ? undefined : { y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.16 }}
              />
            ))}
          </m.div>
        )}

        <m.div
          className="self-start max-w-[83%] px-3 py-2 rounded-xl rounded-bl-sm bg-paper-alt text-ink-soft text-xs leading-relaxed"
          animate={surge(3)}
          transition={{ duration: 0.45 }}
        >
          Achei o projeto e montei o lançamento. Confere antes de eu gravar:
        </m.div>

        <m.div
          className="self-start w-[88%] bg-white border border-modulo-gestao-strong rounded-lg p-3"
          animate={surge(4)}
          transition={{ duration: 0.45 }}
        >
          <p className="text-[8px] uppercase tracking-[0.1em] text-modulo-gestao-strong mb-2">
            Rascunho, aguardando aprovação
          </p>
          {[
            ["Projeto", "Climatização, centro cirúrgico"],
            ["Valor", "R$ 128.400,00"],
            ["Parcela", "1 de 3"],
            ["Recebido em", "18/08/2026"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-[11px] py-0.5 text-ink-soft">
              <span>{k}</span>
              <span className="text-ink font-medium tabular-nums">{v}</span>
            </div>
          ))}
          <div className="flex gap-1.5 mt-2.5">
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-brand text-ink-on-brand font-semibold">
              Confirmar
            </span>
            <span className="text-[10px] px-2.5 py-1 rounded-full border border-paper-border text-ink-muted">
              Editar
            </span>
          </div>
        </m.div>
      </div>
    </div>
  );
}

export function AgentsSection() {
  return (
    <section id="agentes" className="py-28 md:py-36 bg-paper scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <Reveal className="max-w-2xl mb-14">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-brand text-ink-on-brand text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Agentes de IA
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight mb-5">
              A IA prepara o trabalho. <span className="italic text-ink/55">Você dá a palavra final.</span>
            </h2>
            <p className="text-base text-ink-soft font-light leading-relaxed">
              Escreva em português o que aconteceu. O agente monta o registro pronto, você confere e confirma. Nada é
              gravado sem o seu aval.
            </p>
          </Reveal>

          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6 items-start">
            <Reveal>
              <ChatDemo />
            </Reveal>

            <Reveal delay={0.08} className="flex flex-col gap-2.5">
              {AGENTES.map((a) => (
                <SpotlightCard
                  key={a.nome}
                  className="bg-white border border-paper-border/60 rounded-xl p-4 hover:border-paper-border transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <a.icone className="w-3.5 h-3.5 text-modulo-gestao-strong shrink-0" strokeWidth={1.8} />
                    <span className="text-[12.5px] font-medium text-ink">{a.nome}</span>
                    {a.vivo && (
                      <span className="ml-auto text-[7.5px] uppercase tracking-[0.09em] text-modulo-gestao-strong border border-modulo-gestao-strong rounded px-1.5 py-0.5 shrink-0">
                        Vivo
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-ink-muted leading-relaxed font-light">{a.texto}</p>
                </SpotlightCard>
              ))}
            </Reveal>
          </div>

          <Reveal className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10 pt-8 border-t border-paper-border/60">
            {GUARDA_CORPOS.map((g) => (
              <div key={g.titulo} className="group">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <g.icone
                    className="w-3.5 h-3.5 text-modulo-gestao-strong shrink-0 transition-transform duration-300 group-hover:scale-110"
                    strokeWidth={1.9}
                  />
                  <span className="text-[12.5px] font-medium text-ink">{g.titulo}</span>
                </div>
                <p className="text-[11.5px] text-ink-muted leading-relaxed font-light">{g.texto}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
