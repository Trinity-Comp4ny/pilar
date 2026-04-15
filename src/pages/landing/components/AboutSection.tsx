import { Building2, LayoutTemplate, LineChart } from "lucide-react";

export function AboutSection() {
  const items = [
    {
      icon: <LayoutTemplate className="w-5 h-5" />,
      title: "Interface Intuitiva",
      desc: "Design limpo e pensado para a usabilidade diária.",
    },
    {
      icon: <Building2 className="w-5 h-5" />,
      title: "Foco no Setor",
      desc: "Funcionalidades específicas para engenheiros e arquitetos.",
    },
    {
      icon: <LineChart className="w-5 h-5" />,
      title: "Evolução Constante",
      desc: "Atualizações frequentes baseadas no feedback de clientes.",
    },
  ];

  return (
    <section id="sobre" className="py-24 bg-[#2E2E2E] relative overflow-hidden text-white scroll-mt-20">
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

      <div className="container mx-auto px-6 md:px-10 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="reveal-up">
            <h2 className="text-4xl md:text-5xl font-medium text-white mb-6 leading-tight">
              Construído para quem <br />
              <span className="text-accent-orange">constrói o futuro</span>
            </h2>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed font-light">
              Somos uma plataforma de gestão criada especificamente para empresas de Engenharia e Arquitetura. Nossa
              missão é simplificar a gestão financeira e operacional, permitindo que você foque no que realmente
              importa: seus projetos.
            </p>
          </div>

          <div className="grid gap-6 reveal-up" style={{ transitionDelay: "200ms" }}>
            {items.map((item, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 p-6 rounded-xl hover:bg-white/10 transition-all duration-300 group flex items-start gap-4 backdrop-blur-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0 group-hover:bg-accent-orange transition-colors duration-300">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-400 font-light">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
