import type { Feature } from "../types";

interface FeaturesSectionProps {
  features: Feature[];
}

export function FeaturesSection({ features }: FeaturesSectionProps) {
  return (
    <section id="funcionalidades" className="py-24 bg-white text-[#2E2E2E] relative overflow-hidden scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16 reveal-up">
          <h2 className="text-3xl md:text-4xl font-medium mb-4 text-[#2E2E2E]">Tudo em um só lugar</h2>
          <p className="text-slate-600 text-lg font-light">
            Centralize a gestão da sua empresa com ferramentas conectadas que eliminam planilhas e retrabalho.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div
              key={i}
              className="bg-white p-8 rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-2 hover:bg-orange-50 border border-slate-100 group reveal-up cursor-default hover:shadow-md hover:border-accent-orange/20"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-accent-orange/10 flex items-center justify-center text-accent-orange mb-6 group-hover:bg-accent-orange group-hover:text-white transition-all duration-300 group-hover:scale-110">
                {feature.icon}
              </div>
              <h3 className="text-xl font-medium text-[#2E2E2E] mb-3">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed font-light">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
