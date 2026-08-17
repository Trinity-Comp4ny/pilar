export function RentabilidadeSection() {
  return (
    <section id="rentabilidade" className="py-28 md:py-36 bg-paper scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-12 lg:gap-20 items-center">
          <div className="lg:col-span-7 reveal-up">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-brand text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Rentabilidade
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight mb-6">
              <em className="landing-highlight">Saiba se o projeto dá lucro</em>{" "}
              <span className="italic text-ink/55">antes de terminar.</span>
            </h2>
            <p className="text-base text-slate-500 font-light leading-relaxed max-w-lg">
              Compare receita, custo e mão de obra por projeto em tempo real. Descubra o projeto no vermelho a tempo
              de corrigir, não no fechamento do mês.
            </p>
          </div>

          <div className="lg:col-span-5 reveal-up" style={{ transitionDelay: "150ms" }}>
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_32px_-12px_rgba(0,0,0,0.08)] p-8">
              <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400 font-medium mb-1">
                Residencial Villa Verde
              </p>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-3xl font-medium text-ink tracking-tight">18%</span>
                <span className="text-sm text-slate-500 font-light">margem líquida</span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-t border-slate-100">
                  <span className="text-slate-500 font-light">Receita</span>
                  <span className="text-ink-soft font-medium tabular-nums">R$ 145.000</span>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-slate-100">
                  <span className="text-slate-500 font-light">Custo + mão de obra</span>
                  <span className="text-ink-soft font-medium tabular-nums">R$ 118.900</span>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-slate-100">
                  <span className="text-negative-strong font-medium">2 projetos no vermelho</span>
                  <span className="text-negative-strong font-medium">este mês</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
