import { m, useReducedMotion } from "framer-motion";
import { Camera, KeyRound, WifiOff } from "lucide-react";
import { Reveal } from "./Reveal";
import { Parallax, RevealGroup, TextReveal } from "./motion";
import { EASE } from "../lib/motion";

/**
 * Pilar Campo. Vende o que existe de fato: fila offline em IndexedDB com
 * sincronização automática, login sem e-mail e registro do dia numa tela.
 *
 * Evita de propósito a palavra "aplicativo" (é rota web com service worker,
 * não app de loja) e não promete reconhecimento de imagem por IA na obra,
 * que não existe: a foto do canteiro vai direta para o armazenamento.
 *
 * O layout passou a ser duas colunas equilibradas (SPEC 060). Antes o celular
 * ocupava 300px numa faixa de 1100, e sobrava um vazio de ~400px à direita.
 */

const PONTOS = [
  {
    icone: WifiOff,
    titulo: "Funciona no subsolo",
    texto:
      "Sem rede, o dia inteiro fica guardado no aparelho e sobe sozinho quando o sinal volta. Foto por foto, sem duplicar nada.",
  },
  {
    icone: KeyRound,
    titulo: "Login que o gestor entrega na mão",
    texto:
      "Quem trabalha em obra costuma não ter e-mail corporativo. O gestor gera usuário e senha, e o acesso já nasce limitado a uma obra só.",
  },
  {
    icone: Camera,
    titulo: "Foto, medição e tarefa na mesma tela",
    texto:
      "Clima, efetivo, atividade, foto do serviço, quantidade executada e a tarefa do cronograma marcada como concluída.",
  },
];

const FILA = [
  { label: "Registro do dia", pronto: true },
  { label: "3 fotos", pronto: true },
  { label: "Medição", pronto: false },
];

/** Celular do encarregado, com a fila de sincronização em movimento. */
function Celular() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="relative bg-white border-[7px] border-ink rounded-[30px] overflow-hidden shadow-[0_30px_70px_-30px_rgba(0,0,0,0.5)] w-[268px]">
      <div className="bg-ink h-5 flex items-center justify-center">
        <span className="w-14 h-1 rounded-full bg-white/25" />
      </div>
      <div className="p-3 flex flex-col gap-2.5 min-h-[420px]">
        <div>
          <p className="text-[8px] uppercase tracking-[0.08em] text-ink-muted">Obra Aurora · 18 ago</p>
          <p className="text-[13.5px] font-medium text-ink">Registrar o dia</p>
        </div>

        {[
          ["Clima", "Nublado, sem chuva"],
          ["Efetivo", "14 pessoas"],
          ["Medição", "Alvenaria, 62 m²"],
        ].map(([k, v], i) => (
          <m.div
            key={k}
            className="bg-paper-alt rounded-lg px-2.5 py-2"
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.45, delay: 0.15 + i * 0.1, ease: EASE.out }}
          >
            <p className="text-[7.5px] uppercase tracking-[0.09em] text-ink-muted mb-0.5">{k}</p>
            <p className="text-[11px] text-ink">{v}</p>
          </m.div>
        ))}

        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <m.span
              key={i}
              className="aspect-square rounded bg-gradient-to-br from-paper-border to-paper-alt"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.08, ease: EASE.out }}
            />
          ))}
        </div>

        <div className="mt-auto rounded-xl p-2.5 bg-paper-alt border border-dashed border-paper-border">
          <p className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.08em] text-modulo-obra-strong mb-2">
            <WifiOff className="w-2.5 h-2.5" strokeWidth={2.4} />
            Sem sinal, na fila
          </p>
          <div className="flex flex-col gap-1.5">
            {FILA.map((f, i) => (
              <m.div
                key={f.label}
                className="flex items-center gap-1.5 text-[9.5px] text-ink-muted"
                animate={reducedMotion ? undefined : { opacity: [0.45, 1, 1] }}
                transition={{ duration: 5.5, repeat: Infinity, delay: i * 0.5, times: [0, 0.4, 1] }}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-sm border shrink-0 ${
                    f.pronto ? "bg-brand border-brand" : "border-paper-border"
                  }`}
                />
                {f.label}
              </m.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tela do escritório recebendo o que veio do canteiro. Fecha o "ninguém digita duas vezes". */
function Escritorio() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="rounded-xl border border-paper-border/70 bg-white overflow-hidden shadow-[0_16px_40px_-22px_rgba(0,0,0,0.3)]">
      <div className="px-3.5 py-2.5 border-b border-paper-border/60 bg-paper-alt flex items-center gap-2">
        <span className="text-[8.5px] uppercase tracking-[0.11em] text-ink-muted">No escritório, sem redigitar</span>
        <m.span
          className="ml-auto flex items-center gap-1 text-[8px] text-modulo-obra-strong"
          animate={reducedMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          <span className="w-1 h-1 rounded-full bg-modulo-obra-strong" />
          Recebido agora
        </m.span>
      </div>
      <div className="p-3.5">
        {[
          ["Diário de 18/08", "Obra Aurora"],
          ["Alvenaria", "62 m² medidos"],
          ["Fotos anexadas", "3 arquivos"],
          ["Tarefa do cronograma", "Concluída"],
        ].map(([k, v], i) => (
          <m.div
            key={k}
            className="flex justify-between items-center text-[11.5px] py-[7px] border-b border-paper-border/40 last:border-0"
            initial={reducedMotion ? false : { opacity: 0, x: 14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.11, ease: EASE.out }}
          >
            <span className="text-ink-muted">{k}</span>
            <span className="text-ink font-medium">{v}</span>
          </m.div>
        ))}
      </div>
    </div>
  );
}

export function CampoSection() {
  return (
    <section id="campo" className="py-24 md:py-32 bg-paper-alt border-t border-paper-border scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12">
            <Reveal variant="down" className="mb-5">
              <span className="inline-block px-3 py-1 bg-modulo-obra text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Pilar Campo
              </span>
            </Reveal>
            <TextReveal
              as="h2"
              text="O canteiro registra. Sem sinal e sem e-mail."
              highlight="Sem sinal e sem e-mail."
              highlightClassName="italic text-ink/45"
              className="text-3xl md:text-[44px] font-medium text-ink leading-[1.1] tracking-tight mb-5"
            />
            <Reveal variant="fade" delay={0.25}>
              <p className="text-[15px] text-ink-soft font-light leading-relaxed">
                O encarregado abre no navegador do celular, registra o dia e vai embora. O escritório recebe tudo,
                ninguém digita duas vezes.
              </p>
            </Reveal>
          </div>

          {/* Sem `items-start`: a coluna do texto estica até a altura do celular e
              distribui a folga entre os blocos, em vez de largar ~80px de vazio
              embaixo. */}
          <div className="grid lg:grid-cols-[290px_1fr] gap-10 lg:gap-14">
            {/* O celular sobe um pouco mais devagar que o resto: a diferença de
                velocidade é o que dá profundidade à coluna. */}
            <Parallax distance={-40} className="flex justify-center lg:justify-start">
              <Reveal variant="scale" loose>
                <Celular />
              </Reveal>
            </Parallax>

            <div className="flex flex-col gap-8 h-full justify-between">
              <RevealGroup className="grid sm:grid-cols-3 gap-6" stagger={0.09}>
                {PONTOS.map((p) => (
                  <RevealGroup.Item key={p.titulo} variant="up">
                    <div className="group">
                      <span className="w-8 h-8 mb-3 rounded-lg bg-paper flex items-center justify-center transition-colors duration-300 group-hover:bg-modulo-obra">
                        <p.icone
                          className="w-4 h-4 text-modulo-obra-strong transition-transform duration-300 group-hover:scale-110"
                          strokeWidth={1.9}
                        />
                      </span>
                      <h3 className="text-[13.5px] font-medium text-ink mb-1">{p.titulo}</h3>
                      <p className="text-[12.5px] text-ink-muted font-light leading-relaxed">{p.texto}</p>
                    </div>
                  </RevealGroup.Item>
                ))}
              </RevealGroup>

              <Reveal variant="up" delay={0.15}>
                <Escritorio />
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
