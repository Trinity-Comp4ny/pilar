import { CreditCard, FileText, Globe, Shield, Calculator, Layers } from "lucide-react";

const items = [
  {
    icon: CreditCard,
    label: "PIX + Boleto registrado",
    desc: "Cobranças nativas via Asaas. Sem plugin, sem integração manual.",
  },
  {
    icon: FileText,
    label: "Nota fiscal (NFS-e)",
    desc: "Emissão via parceiro, dentro do fluxo de cobrança do projeto.",
  },
  {
    icon: Globe,
    label: "Português-BR nativo",
    desc: "Interface, suporte e linguagem do setor. Sem tradução automática.",
  },
  {
    icon: Shield,
    label: "LGPD e dados no Brasil",
    desc: "Servidores em São Paulo. Backup diário. SSL ponta a ponta.",
  },
  {
    icon: Calculator,
    label: "Exportação pro contador",
    desc: "Relatórios prontos em formato que o seu contador reconhece.",
  },
  {
    icon: Layers,
    label: "Linguagem do setor",
    desc: "Disciplinas, fases, aditivos, fee — do jeito que o escritório trabalha.",
  },
];

export function BrazilSection() {
  return (
    <section className="py-28 md:py-36 bg-paper-alt border-t border-paper-border">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16 reveal-up">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium mb-6">Feito no Brasil</p>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight">
              Tudo que software gringo <span className="italic text-ink/55">não entrega.</span>
            </h2>
            <p className="mt-6 text-base text-slate-500 font-light leading-relaxed max-w-xl">
              PIX, boleto e nota fiscal não são adaptações — estão no núcleo do sistema.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="reveal-up" style={{ transitionDelay: `${i * 60}ms` }}>
                  <div className="flex items-center gap-4 mb-5">
                    <Icon strokeWidth={1.5} className="w-4 h-4 text-brand shrink-0" />
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <p className="text-sm font-medium text-ink-soft mb-2 tracking-tight">{item.label}</p>
                  <p className="text-sm text-slate-500 font-light leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
