import { Lock, ScrollText, Sparkles, Undo2 } from "lucide-react";
import { Reveal } from "./Reveal";
import { RevealGroup, TextReveal } from "./motion";
import { AgentDemo } from "./agents/AgentDemo";

/**
 * Agentes de IA, o clímax escuro da página.
 *
 * A versão anterior tinha uma conversa encenada, quatro cartões de agente com
 * parágrafo cada e mais quatro de guarda-corpo: dezoito linhas de texto para
 * dizer uma ideia só. Ninguém lê isso numa landing.
 *
 * Agora a seção diz a ideia em três passos e três garantias curtas. A conversa
 * encenada saiu porque a cena da hero já mostra o agente trabalhando, e repetir
 * o mesmo diálogo mais abaixo não acrescentava nada.
 */

/**
 * Os passos falam da dor, não do mecanismo.
 *
 * A versão anterior anunciava "você escreve em português", que não é benefício
 * nenhum: ninguém troca de sistema para poder escrever no próprio idioma. O que
 * o sócio reconhece é a noite de sexta lançando o que aconteceu na semana, e o
 * projeto que ele descobre no vermelho quando já acabou.
 */
const PASSOS = [
  {
    n: "01",
    titulo: "Some o lançamento manual",
    texto:
      "Aquela hora de sexta abrindo formulário, escolhendo categoria e conferindo parcela. Você conta o que aconteceu e acabou.",
  },
  {
    n: "02",
    titulo: "Ele não erra o projeto",
    texto:
      "Acha pelo nome, calcula a parcela, categoriza no seu plano de contas. É o trabalho que o estagiário faria, sem a revisão que ele exigiria.",
  },
  {
    n: "03",
    titulo: "A margem se refaz na hora",
    texto:
      "No segundo em que você aprova, o projeto sabe se ainda está dando lucro. Você descobre agora, não quando já entregou.",
  },
];

const GARANTIAS = [
  { icone: Undo2, texto: "Desfazer apaga exatamente o que aquela execução criou" },
  { icone: Lock, texto: "O agente lê com a sua permissão, nunca com chave de administrador" },
  { icone: ScrollText, texto: "Cada execução fica registrada e auditável" },
];

export function AgentsSection() {
  return (
    <section id="agentes" className="relative py-16 md:py-32 bg-ink text-white scroll-mt-28 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[420px] rounded-full bg-brand/12 blur-[120px] pointer-events-none"
      />

      <div className="relative mx-auto max-w-6xl px-5 md:px-10">
        <div className="max-w-2xl mb-14">
          <TextReveal
            as="h2"
            text="A IA faz o trabalho chato. Você só dá o aval."
            highlight="Você só dá o aval."
            highlightClassName="italic text-white/45"
            className="text-[52px] max-[1100px]:text-[42px] max-[850px]:text-[29px] max-[420px]:text-[25px] font-medium text-white leading-[1.08] tracking-[-0.035em]"
          />
        </div>

        {/* A demonstração à esquerda, os passos à direita: o visitante vê
            acontecendo e lê o que está acontecendo, lado a lado. */}
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-14 items-center mb-14">
          <Reveal variant="left" loose>
            <AgentDemo />
          </Reveal>

          <RevealGroup className="flex flex-col gap-7" stagger={0.12}>
            {PASSOS.map((p) => (
              <RevealGroup.Item key={p.n} variant="right">
                <div className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-ink">
                    {p.n}
                  </span>
                  <div className="pt-1">
                    <h3 className="mb-1.5 text-[17px] font-medium text-white">{p.titulo}</h3>
                    <p className="text-[13.5px] leading-relaxed text-white/55">{p.texto}</p>
                  </div>
                </div>
              </RevealGroup.Item>
            ))}
          </RevealGroup>
        </div>

        <Reveal variant="fade" delay={0.1}>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-8 border-t border-white/10">
            <span className="flex items-center gap-2 text-[12px] font-medium text-brand">
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.9} />
              Três agentes rodando hoje
            </span>
            {GARANTIAS.map((g) => (
              <span key={g.texto} className="flex items-center gap-2 text-[12px] text-white/50">
                <g.icone className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
                {g.texto}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
