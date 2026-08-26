import { Lock, ScrollText, Sparkles, Undo2 } from "lucide-react";
import { Reveal } from "./Reveal";
import { RevealGroup, TextReveal } from "./motion";

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

const PASSOS = [
  { n: "01", titulo: "Você escreve em português", texto: "“Recebi 128 mil do centro cirúrgico, primeira de três”." },
  { n: "02", titulo: "O agente monta o registro", texto: "Acha o projeto, calcula a parcela e prepara o lançamento." },
  { n: "03", titulo: "Você confirma", texto: "Só depois do seu aval alguma coisa é gravada." },
];

const GARANTIAS = [
  { icone: Undo2, texto: "Desfazer apaga exatamente o que aquela execução criou" },
  { icone: Lock, texto: "O agente lê com a sua permissão, nunca com chave de administrador" },
  { icone: ScrollText, texto: "Cada execução fica registrada e auditável" },
];

export function AgentsSection() {
  return (
    <section id="agentes" className="relative py-24 md:py-32 bg-ink text-white scroll-mt-28 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[420px] rounded-full bg-brand/12 blur-[120px] pointer-events-none"
      />

      <div className="relative mx-auto max-w-6xl px-6 md:px-10">
        <div className="max-w-2xl mb-14">
          <TextReveal
            as="h2"
            text="A IA prepara o trabalho. Você dá a palavra final."
            highlight="Você dá a palavra final."
            highlightClassName="italic text-white/45"
            className="text-[clamp(30px,4.2vw,52px)] font-medium text-white leading-[1.08] tracking-[-0.035em]"
          />
        </div>

        {/* Três passos, uma linha cada. */}
        <RevealGroup className="grid md:grid-cols-3 gap-x-8 gap-y-10 mb-14" stagger={0.1}>
          {PASSOS.map((p) => (
            <RevealGroup.Item key={p.n} variant="up">
              <div>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand text-ink text-[12px] font-semibold mb-4">
                  {p.n}
                </span>
                <h3 className="text-[17px] font-medium text-white mb-1.5">{p.titulo}</h3>
                <p className="text-[13.5px] text-white/55 leading-relaxed">{p.texto}</p>
              </div>
            </RevealGroup.Item>
          ))}
        </RevealGroup>

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
