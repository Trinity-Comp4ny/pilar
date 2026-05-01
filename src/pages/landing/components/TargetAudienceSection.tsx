const personas = [
  {
    number: "01",
    label: "Eng. estrutural · MEP",
    headline: "Disciplinas técnicas como eixo do projeto.",
  },
  {
    number: "02",
    label: "Arquitetura res · com",
    headline: "Etapas, entregas e portal do cliente.",
  },
  {
    number: "03",
    label: "Multidisciplinar",
    headline: "Arq + eng sob um contrato. Uma visão só.",
  },
  {
    number: "04",
    label: "Eng. complementar",
    headline: "Volume alto com templates e pipeline.",
  },
];

export function TargetAudienceSection() {
  return (
    <section className="py-28 md:py-36 bg-paper-alt">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16 md:mb-20 reveal-up">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium mb-6">Para quem é o Pilar</p>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight">
              Escritórios técnicos de 3 a 30 profissionais. <span className="italic text-ink/55">No Brasil.</span>
            </h2>
            <p className="mt-6 text-base text-slate-500 font-light leading-relaxed max-w-xl">
              Feito pra escritório técnico que cobra por fee, trabalha por disciplina e emite nota fiscal.{" "}
              <span className="text-ink/45">Não é pra solo autônomo, construtora ou agência de design.</span>
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-x-12 gap-y-12">
            {personas.map((p, i) => (
              <div key={p.number} className="reveal-up" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="flex items-baseline gap-4 mb-4">
                  <span className="text-xs font-medium text-brand tabular-nums tracking-wider">{p.number}</span>
                  <div className="flex-1 h-px bg-slate-300/60" />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium mb-3">{p.label}</p>
                <h3 className="text-xl md:text-2xl font-medium text-ink tracking-tight leading-snug">{p.headline}</h3>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
