const steps = [
  {
    number: "01",
    title: "Crie o escritório",
    desc: "Cadastre CNPJ, dados e configurações em minutos. Sem instalação, direto no navegador.",
  },
  {
    number: "02",
    title: "Convide equipe e clientes",
    desc: "Cada profissional vê só o que precisa. Portal do cliente ativo desde o primeiro projeto.",
  },
  {
    number: "03",
    title: "Lance projetos e escopos",
    desc: "Importe projetos existentes ou comece do zero. Proposta, escopo e cronograma num mesmo lugar.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-28 md:py-36 bg-paper-alt border-t border-paper-border">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16 reveal-up">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-accent-orange text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Como começar
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight">
              <em className="landing-highlight">Três passos.</em>{" "}
              <span className="italic text-ink/55">Escritório rodando.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {steps.map((step, i) => (
              <div key={step.number} className="reveal-up md:pr-12" style={{ transitionDelay: `${i * 120}ms` }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-8 h-8 rounded-full border border-slate-300 bg-paper flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-medium text-slate-500 tabular-nums tracking-wider">
                      {step.number}
                    </span>
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-medium text-ink tracking-tight mb-3">{step.title}</h3>
                <p className="text-sm text-slate-500 font-light leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
