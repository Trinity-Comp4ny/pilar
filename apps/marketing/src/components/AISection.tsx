const actions = [
  { label: "Consultar", desc: "Pergunte o status de um projeto ou o que vence essa semana." },
  { label: "Preparar", desc: "A IA monta o rascunho: proposta, orçamento ou lançamento." },
  { label: "Aprovar", desc: "Nada sai nem entra no sistema sem você revisar e confirmar." },
];

export function AISection() {
  return (
    <section id="ia" className="py-28 md:py-36 bg-ink-soft text-white scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16 reveal-up">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-brand text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Agentes de IA
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-medium leading-[1.1] tracking-tight">
              <em className="italic text-brand">A IA faz o trabalho.</em>{" "}
              <span className="text-white/60">Você dá a palavra final.</span>
            </h2>
            <p className="mt-6 text-base text-white/70 font-light leading-relaxed max-w-xl">
              O agente consulta os dados reais do seu escritório e prepara a ação. Nada é executado sem revisão e
              aprovação sua.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-x-12 gap-y-10">
            {actions.map((action, i) => (
              <div key={action.label} className="reveal-up" style={{ transitionDelay: `${i * 80}ms` }}>
                <p className="text-xs uppercase tracking-[0.2em] text-brand font-medium mb-3">{action.label}</p>
                <p className="text-lg text-white/85 font-light leading-relaxed">{action.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
