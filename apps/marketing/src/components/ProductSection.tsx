import { ArrowRightLeft, LayoutDashboard, Sparkles, TrendingUp } from "lucide-react";
import { Reveal } from "./Reveal";

const pillars = [
  {
    icon: TrendingUp,
    label: "Rentabilidade",
    headline: "Descubra o prejuízo a tempo de corrigir",
    body: "Receita, custo e mão de obra comparados por projeto, em tempo real, não só no fechamento do mês.",
  },
  {
    icon: ArrowRightLeft,
    label: "Um fluxo só",
    headline: "Proposta aprovada vira projeto. Sem retrabalho.",
    body: "Cronograma, escopo e aditivos seguem no mesmo sistema, do orçamento à cobrança.",
  },
  {
    icon: Sparkles,
    label: "Agentes de IA",
    headline: "A IA prepara. Você aprova.",
    body: "Consulta o status, monta o rascunho de uma proposta ou orçamento. Nada sai do sistema sem sua revisão.",
  },
  {
    icon: LayoutDashboard,
    label: "Portal do cliente",
    headline: "Cliente acompanha. Seu WhatsApp descansa.",
    body: "Entregas, pagamentos e documentos num só lugar, sem você precisar estar online.",
  },
];

export function ProductSection() {
  return (
    <section id="produto" className="py-28 md:py-36 bg-paper scroll-mt-20">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <Reveal className="max-w-2xl mb-20">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-brand text-ink text-xs font-medium uppercase tracking-[0.2em] rounded-sm">
                Produto
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight">
              <em className="landing-highlight">Um sistema.</em>{" "}
              <span className="italic text-ink/55">Zero planilha.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-x-12 gap-y-16">
            {pillars.map((pillar, i) => (
              <Reveal key={pillar.label} delay={i * 0.08}>
                <pillar.icon className="w-6 h-6 text-ink-soft mb-5" strokeWidth={1.5} />
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium mb-3">{pillar.label}</p>
                <h3 className="text-xl md:text-2xl font-medium text-ink-soft tracking-tight leading-snug mb-3">
                  {pillar.headline}
                </h3>
                <p className="text-sm text-slate-500 font-light leading-relaxed max-w-sm">{pillar.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
