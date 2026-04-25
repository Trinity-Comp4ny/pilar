const faqs = [
  {
    q: "Preciso cadastrar cartão pra testar?",
    a: "Não. O trial de 14 dias é gratuito e não exige cartão ou qualquer dado de pagamento.",
  },
  {
    q: "Quanto custa depois do trial?",
    a: "A partir de R$297/mês por escritório. Veja os planos completos na página de preços.",
  },
  {
    q: "E se eu já uso Monday, Trello ou planilha?",
    a: "No kick-off gratuito, disponível nos planos pagos, importamos seus projetos e clientes. Você não recomeça do zero.",
  },
  {
    q: "Em quanto tempo meu escritório entra em operação?",
    a: "Cadastro em 5 minutos. Escritório completamente operando em até 1 semana, com ou sem kick-off assistido.",
  },
  {
    q: "O Pilar emite nota fiscal?",
    a: "Sim. NFS-e via parceiro, boleto registrado e PIX — tudo integrado ao fluxo de cobrança do projeto.",
  },
  {
    q: "Meus dados ficam seguros? E a LGPD?",
    a: "Dados armazenados no Brasil (AWS São Paulo), backup diário automático, conformidade LGPD e criptografia SSL ponta a ponta.",
  },
  {
    q: "Tem contrato de fidelidade?",
    a: "Não. Você cancela a qualquer momento, sem multa e sem burocracia.",
  },
];

export function FAQSection() {
  return (
    <section className="py-28 md:py-36 bg-paper-alt border-t border-paper-border">
      <div className="container mx-auto px-6 md:px-10">
        <div className="max-w-3xl mx-auto">
          <div className="mb-16 reveal-up">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium mb-6">FAQ</p>
            <h2 className="text-3xl md:text-5xl font-medium text-ink leading-[1.1] tracking-tight">
              Perguntas frequentes.
            </h2>
          </div>

          <div className="reveal-up">
            {faqs.map((faq, i) => (
              <details
                key={i}
                className="group border-b border-slate-200 py-6 first:border-t [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none gap-6">
                  <span className="text-base md:text-lg font-medium text-ink-soft tracking-tight">{faq.q}</span>
                  <span className="shrink-0 w-6 h-6 flex items-center justify-center text-slate-400 text-xl font-light group-open:rotate-45 transition-transform duration-200">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-slate-500 font-light leading-relaxed text-base pr-10">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
