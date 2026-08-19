import { m, useReducedMotion } from "framer-motion";
import { Camera, KeyRound, WifiOff } from "lucide-react";
import { Reveal } from "./Reveal";

/**
 * Pilar Campo. Vende o que existe de fato: fila offline em IndexedDB com
 * sincronização automática, login sem e-mail e registro do dia numa tela.
 *
 * Evita de propósito a palavra "aplicativo" (é rota web com service worker,
 * não app de loja) e não promete reconhecimento de imagem por IA na obra,
 * que não existe: a foto do canteiro vai direta para o armazenamento.
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

export function CampoSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section id="campo" className="py-28 md:py-36 bg-paper-alt border-t border-paper-border scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_300px] gap-12 lg:gap-16 items-center">
          <Reveal>
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-modulo-obra text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Pilar Campo
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight mb-5">
              O canteiro registra. <span className="italic text-ink/55">Sem sinal e sem e-mail.</span>
            </h2>
            <p className="text-base text-ink-soft font-light leading-relaxed mb-10 max-w-lg">
              O encarregado abre no navegador do celular, registra o dia e vai embora. O escritório recebe tudo, ninguém
              digita duas vezes.
            </p>

            <div className="flex flex-col gap-6">
              {PONTOS.map((p) => (
                <div key={p.titulo} className="group flex gap-3.5">
                  <span className="w-7 h-7 rounded-lg bg-paper flex items-center justify-center shrink-0 transition-colors duration-300 group-hover:bg-modulo-obra">
                    <p.icone
                      className="w-3.5 h-3.5 text-modulo-obra-strong transition-transform duration-300 group-hover:scale-110"
                      strokeWidth={1.9}
                    />
                  </span>
                  <div>
                    <h3 className="text-[13.5px] font-medium text-ink mb-0.5">{p.titulo}</h3>
                    <p className="text-[13px] text-ink-muted font-light leading-relaxed">{p.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="bg-white border-[7px] border-ink rounded-[26px] overflow-hidden shadow-xl max-w-[290px] mx-auto">
              <div className="bg-ink h-3.5" />
              <div className="p-3 flex flex-col gap-2.5 min-h-[290px]">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.08em] text-ink-muted">Obra Aurora · 18 ago</p>
                  <p className="text-[12.5px] font-medium text-ink">Registrar o dia</p>
                </div>

                {[
                  ["Clima", "Nublado, sem chuva"],
                  ["Efetivo", "14 pessoas"],
                  ["Medição", "Alvenaria, 62 m²"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-paper-alt rounded-md px-2.5 py-2">
                    <p className="text-[7.5px] uppercase tracking-[0.09em] text-ink-muted mb-0.5">{k}</p>
                    <p className="text-[11px] text-ink">{v}</p>
                  </div>
                ))}

                <div className="grid grid-cols-3 gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="aspect-square rounded bg-gradient-to-br from-paper-border to-paper-alt" />
                  ))}
                </div>

                <div className="mt-auto rounded-lg p-2.5 bg-paper-alt border border-dashed border-paper-border">
                  <p className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.08em] text-modulo-obra-strong mb-1.5">
                    <WifiOff className="w-2.5 h-2.5" strokeWidth={2.4} />
                    Sem sinal, na fila
                  </p>
                  <div className="flex flex-col gap-1">
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
          </Reveal>
        </div>
      </div>
    </section>
  );
}
