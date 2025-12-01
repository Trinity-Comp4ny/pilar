import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Landing() {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState(5);
  
  const features = [
    { id: 'financeiro', name: 'Financeiro Completo', price: 49 },
    { id: 'leads', name: 'Gestão de Leads', price: 29 },
    { id: 'projetos', name: 'Projetos Kanban', price: 39 },
    { id: 'clientes', name: 'Base de Clientes', price: 19 },
    { id: 'funcionarios', name: 'Gestão de Equipe', price: 29 },
    { id: 'relatorios', name: 'Relatórios Avançados', price: 35 },
  ];
  
  const userPricing = [
    { max: 5, price: 0 },
    { max: 10, price: 30 },
    { max: 25, price: 70 },
    { max: 50, price: 120 },
    { max: 999, price: 200 },
  ];
  
  const calculatePrice = () => {
    const featuresTotal = selectedFeatures.reduce((sum, featureId) => {
      const feature = features.find(f => f.id === featureId);
      return sum + (feature?.price || 0);
    }, 0);
    
    const userTier = userPricing.find(tier => selectedUsers <= tier.max);
    const usersTotal = userTier?.price || 0;
    
    return featuresTotal + usersTotal;
  };
  
  const toggleFeature = (featureId: string) => {
    setSelectedFeatures(prev => 
      prev.includes(featureId) 
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".reveal-up");
    if (!("IntersectionObserver" in window) || elements.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );

    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div className="min-h-screen bg-white text-black pt-16">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 h-16 flex items-center justify-between px-6 md:px-10 border-b border-black/5 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-40">
        <div className="flex items-center gap-3">
          <img src="/pilar-logo.svg" alt="Pilar" className="h-7 w-7 transition-opacity duration-200 hover:opacity-80" />
          <span className="text-base font-normal tracking-tight">Pilar</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <a href="#funcionalidades" className="hover:text-[hsl(var(--primary))] transition-colors link-underline focus-ring">Funcionalidades</a>
          <a href="#sobre" className="hover:text-[hsl(var(--primary))] transition-colors link-underline focus-ring">Sobre</a>
          <a href="#precos" className="hover:text-[hsl(var(--primary))] transition-colors link-underline focus-ring">Preços</a>
        </nav>
        <Link to="/login" className="text-sm px-4 py-2 border border-primary bg-primary text-primary-foreground rounded-full transition-colors focus-ring hover:bg-primary/90 hover:border-[hsl(var(--primary))] hover:text-primary-foreground">Entrar no Sistema</Link>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-10 py-20 md:py-28 border-b border-black/5">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-medium tracking-tight leading-[1.1] reveal-up">
            Gestão financeira e de projetos para Engenharia e Arquitetura.
          </h1>
          <p className="mt-2 text-sm md:text-base text-black/60 reveal-up" style={{ transitionDelay: "80ms" }}>O pilar da sua gestão.</p>
          <p className="mt-5 max-w-2xl text-sm md:text-base text-black/70 reveal-up" style={{ transitionDelay: "160ms" }}>
            Um sistema completo para controlar financeiro, projetos, obras, contratos e a operação da sua empresa, com foco absoluto em clareza e performance.
          </p>
          <div className="mt-8 flex items-center gap-3 reveal-up" style={{ transitionDelay: "240ms" }}>
            <Link
              to="/login"
              className="px-5 py-2.5 rounded-full bg-[hsl(var(--primary))] text-white text-sm hover:bg-[hsl(var(--primary))]/90 transition-colors focus-ring"
            >
              Começar agora
            </Link>
            <a
              href="#precos"
              className="px-5 py-2.5 rounded-full border border-black/10 text-sm transition-colors focus-ring hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
            >
              Calcular preço
            </a>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="px-6 md:px-10 py-16 md:py-20 border-b border-black/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight mb-10 reveal-up">Tudo que você precisa para gerenciar sua empresa</h2>
          <div className="grid md:grid-cols-3 gap-x-10 gap-y-12">
            {[
              {
                t: "Financeiro Completo",
                d: "Fluxo de caixa, receitas, despesas, resumos mensais e anuais, patrimônio e indicadores.",
              },
              {
                t: "Gestão de Leads",
                d: "Kanban para acompanhamento de leads, desde o primeiro contato até o fechamento.",
              },
              {
                t: "Gestão de Projetos",
                d: "Acompanhe projetos em formato visual, com detalhes completos e histórico.",
              },
              { t: "Base de Clientes", d: "Cadastro completo, busca avançada e ordenação personalizada." },
              { t: "Gestão de Equipe e Funcionários", d: "Funcionários, cargos, salários e busca por múltiplos critérios." },
              { t: "Dashboard", d: "Visão geral limpa e objetiva de todo o negócio." },
            ].map((f, i) => (
              <div
                key={f.t}
                className="group reveal-up"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <h3 className="text-base md:text-lg font-medium tracking-tight group-hover:text-[hsl(var(--primary))] transition-colors">
                  {f.t}
                </h3>
                <p className="mt-2 text-sm text-black/70 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre Nós */}
      <section id="sobre" className="px-6 md:px-10 py-16 md:py-20 border-b border-black/5 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight reveal-up">Sobre o Pilar</h2>
          <p className="mt-6 text-sm md:text-base text-black/70 leading-relaxed reveal-up" style={{ transitionDelay: "100ms" }}>
            Somos uma plataforma de gestão criada especificamente para empresas de Engenharia e Arquitetura. 
            Nossa missão é simplificar a gestão financeira e operacional, permitindo que você foque no que realmente importa: seus projetos.
          </p>
        </div>
      </section>

      {/* Preços Dinâmicos */}
      <section id="precos" className="px-6 md:px-10 py-20 md:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 text-center">
            <h2 className="text-2xl md:text-3xl font-medium tracking-tight reveal-up">Monte seu plano personalizado</h2>
            <p className="mt-2 text-sm text-black/70 reveal-up" style={{ transitionDelay: "100ms" }}>Escolha apenas as funcionalidades que você precisa</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Seleção de Funcionalidades */}
            <div className="reveal-up">
              <h3 className="text-lg font-medium mb-4">Funcionalidades</h3>
              <div className="space-y-3">
                {features.map((feature) => (
                  <label
                    key={feature.id}
                    className="flex items-center justify-between p-4 border border-black/10 rounded-lg cursor-pointer hover:border-[hsl(var(--primary))] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedFeatures.includes(feature.id)}
                        onChange={() => toggleFeature(feature.id)}
                        className="w-4 h-4 rounded border-black/20"
                      />
                      <span className="text-sm">{feature.name}</span>
                    </div>
                    <span className="text-sm font-medium">R$ {feature.price}</span>
                  </label>
                ))}
              </div>

              {/* Seleção de Usuários */}
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">Número de Usuários</h3>
                <div className="space-y-3">
                  {userPricing.slice(0, -1).map((tier, idx) => (
                    <label
                      key={idx}
                      className="flex items-center justify-between p-4 border border-black/10 rounded-lg cursor-pointer hover:border-[hsl(var(--primary))] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="users"
                          checked={selectedUsers === tier.max}
                          onChange={() => setSelectedUsers(tier.max)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">
                          {idx === 0 ? `Até ${tier.max} usuários` : `Até ${tier.max} usuários`}
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {tier.price === 0 ? 'Incluído' : `+R$ ${tier.price}`}
                      </span>
                    </label>
                  ))}
                  <label
                    className="flex items-center justify-between p-4 border border-black/10 rounded-lg cursor-pointer hover:border-[hsl(var(--primary))] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="users"
                        checked={selectedUsers === 999}
                        onChange={() => setSelectedUsers(999)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">50+ usuários</span>
                    </div>
                    <span className="text-sm font-medium">+R$ 200</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Resumo do Preço */}
            <div className="reveal-up" style={{ transitionDelay: "200ms" }}>
              <div className="sticky top-24">
                <div className="border border-black/10 rounded-2xl p-8 bg-gradient-to-br from-white to-gray-50">
                  <h3 className="text-lg font-medium mb-6">Resumo do Plano</h3>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-black/60">Funcionalidades selecionadas</span>
                      <span className="font-medium">{selectedFeatures.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/60">Usuários</span>
                      <span className="font-medium">Até {selectedUsers}</span>
                    </div>
                  </div>

                  <div className="h-px bg-black/10 my-6"></div>

                  <div className="flex justify-between items-end mb-6">
                    <span className="text-sm text-black/60">Total mensal</span>
                    <div className="text-right">
                      <span className="text-4xl font-bold">R$ {calculatePrice()}</span>
                      <span className="text-sm text-black/50">/mês</span>
                    </div>
                  </div>

                  <Link
                    to="/login"
                    className="w-full inline-flex items-center justify-center rounded-full px-5 py-3 text-sm bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors"
                  >
                    Começar agora
                  </Link>

                  <p className="mt-4 text-xs text-center text-black/50">
                    14 dias grátis • Sem cartão de crédito
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-10 py-10 border-t border-black/5 text-xs text-black/60">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Pilar - Sistema de Gestão. Todos os direitos reservados.</p>
          <div className="flex items-center gap-6">
            <a href="#funcionalidades" className="hover:text-[hsl(var(--primary))] transition-colors">Funcionalidades</a>
            <a href="#sobre" className="hover:text-[hsl(var(--primary))] transition-colors">Sobre</a>
            <a href="#precos" className="hover:text-[hsl(var(--primary))] transition-colors">Preços</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
