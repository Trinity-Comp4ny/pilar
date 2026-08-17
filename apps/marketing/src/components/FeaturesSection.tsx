const modules = [
  { number: "01", label: "Comercial", headline: "Proposta aprovada vira projeto. Sem retrabalho." },
  { number: "02", label: "Operação", headline: "Escopos, fases e disciplinas no lugar certo." },
  { number: "03", label: "Financeiro", headline: "Resultado do projeto antes de fechar o mês." },
  { number: "04", label: "Equipe", headline: "Custo real de cada profissional por projeto." },
  { number: "05", label: "Portal", headline: "O cliente acompanha. Seu WhatsApp descansa." },
];

export function FeaturesSection() {
  return (
    <section id="modulos" className="py-28 md:py-36 bg-paper scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-20 reveal-up">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-brand text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Módulos
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight">
              <em className="landing-highlight">Cinco frentes.</em>{" "}
              <span className="italic text-ink/55">Um sistema. Zero planilha.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-12 mb-28">
            {modules.map((m, i) => (
              <div key={m.number} className="reveal-up" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="flex items-baseline gap-4 mb-4">
                  <span className="text-xs font-medium text-slate-400 tabular-nums tracking-wider">{m.number}</span>
                  <div className="flex-1 h-px bg-brand/50" />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium mb-3">{m.label}</p>
                <h3 className="text-xl md:text-2xl font-medium text-ink-soft tracking-tight leading-snug">
                  {m.headline}
                </h3>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-center">
            <div className="lg:col-span-5 reveal-up">
              <div className="mb-6">
                <span className="inline-block px-3 py-1 bg-brand text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                  Portal do cliente
                </span>
              </div>
              <h3 className="text-2xl md:text-4xl font-medium text-ink leading-[1.1] tracking-tight mb-6">
                <em className="landing-highlight">Transparência pro cliente.</em>{" "}
                <span className="italic text-ink/55">Silêncio no seu WhatsApp.</span>
              </h3>
              <p className="text-base text-slate-500 font-light leading-relaxed max-w-lg">
                Entregas, pagamentos e documentos num só lugar. Cliente acompanha sozinho, sem depender de você estar
                online.
              </p>
            </div>

            <div className="lg:col-span-7 reveal-up" style={{ transitionDelay: "150ms" }}>
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_32px_-12px_rgba(0,0,0,0.08)]">
                <div className="px-6 py-3 flex items-center gap-2 border-b border-slate-100">
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                  <span className="ml-3 text-[11px] text-slate-400 font-light tabular-nums tracking-tight">
                    portal.pilar.app
                  </span>
                </div>

                <div className="p-8">
                  <div className="mb-6">
                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400 font-medium mb-1">Projeto</p>
                    <p className="text-lg font-medium text-ink tracking-tight">Residencial Villa Verde</p>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between py-4 border-y border-slate-100">
                      <div>
                        <p className="text-xs text-slate-400 font-light mb-1">Fase atual</p>
                        <p className="text-sm font-medium text-ink-soft">Anteprojeto · revisão 02</p>
                      </div>
                      <span className="text-xs text-slate-500 font-light tabular-nums">70%</span>
                    </div>
                    <div className="w-full h-px bg-slate-100 relative">
                      <div className="absolute top-0 left-0 h-px bg-ink-soft w-[70%]" />
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <div>
                        <p className="text-xs text-slate-400 font-light mb-1">Próximo pagamento</p>
                        <p className="text-sm font-medium text-ink tabular-nums">R$ 8.500,00</p>
                      </div>
                      <button className="px-4 py-2 rounded-full bg-ink-soft text-white text-xs font-medium tracking-tight">
                        Pagar via PIX
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
