import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { Reveal } from "./Reveal";
import { RevealGroup } from "./motion";

/**
 * Preço na home, no formato da referência: três cartões, o do meio destacado
 * com contorno verde e selo, e a lista de itens abaixo do botão.
 *
 * Os valores são os mesmos da /planos, escritos à mão aqui de propósito: a
 * home não pode depender de uma leitura de rede para mostrar preço, e a página
 * cheia continua sendo a fonte com ciclo anual, Enterprise e detalhe de cada
 * item.
 */

const PLANOS = [
  {
    nome: "Essencial",
    resumo: "Pra escritório pequeno",
    preco: "R$ 490",
    limite: "Usuários ilimitados · até 15 projetos ativos",
    itens: ["Funil de leads e propostas", "Projetos por disciplina", "Financeiro e carteira", "Portal do cliente"],
    destaque: false,
  },
  {
    nome: "Profissional",
    resumo: "Centro do ICP, o mais escolhido",
    preco: "R$ 690",
    limite: "Usuários ilimitados · até 40 projetos ativos",
    itens: ["Tudo do Essencial", "Agentes de IA no limite mensal", "Cronograma da carteira inteira", "Relatórios com export"],
    destaque: true,
  },
  {
    nome: "Escala",
    resumo: "Pra operação maior ou multiequipe",
    preco: "R$ 1.290",
    limite: "Usuários e projetos ilimitados",
    itens: ["Tudo do Profissional", "Obras e diário de campo", "Prestação de contas por taxa", "Implantação assistida"],
    destaque: false,
  },
];

export function PricingSection() {
  return (
    <section id="planos" className="w-full bg-paper px-5 md:px-10 py-16 md:py-32 scroll-mt-28">
      <div className="max-w-6xl mx-auto">
        <Reveal variant="up" className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-[52px] max-[1100px]:text-[42px] max-[850px]:text-[29px] max-[420px]:text-[25px] font-medium tracking-[-0.035em] leading-[1.08] text-ink mb-4">
            Preço claro. <span className="italic text-ink/45">Ativa em minutos.</span>
          </h2>
          <p className="text-[15px] text-ink-soft leading-relaxed">
            Pague por cartão, PIX ou boleto. Sem fidelidade, e 14 dias grátis em qualquer plano.
          </p>
        </Reveal>

        <RevealGroup className="grid md:grid-cols-3 gap-4 items-start" stagger={0.1}>
          {PLANOS.map((p) => (
            <RevealGroup.Item key={p.nome} variant="scale">
              <div
                className={`relative h-full rounded-[26px] p-7 md:p-8 flex flex-col ${
                  p.destaque
                    ? "bg-frame border-2 border-brand shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)]"
                    : "bg-frame border border-paper-border"
                }`}
              >
                {p.destaque && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-on-brand">
                    Mais escolhido
                  </span>
                )}

                <p className="text-[17px] font-medium text-ink">{p.nome}</p>
                <p className="text-[12.5px] text-ink-muted mb-5">{p.resumo}</p>

                <p className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-[40px] font-medium tracking-[-0.04em] text-ink leading-none">{p.preco}</span>
                  <span className="text-[13px] text-ink-muted">/mês</span>
                </p>
                <p className="text-[12px] text-ink-muted mb-6">{p.limite}</p>

                <a
                  href={`${APP_URL}/cadastro`}
                  onClick={() => trackCta("testar_gratis", `pricing_${p.nome.toLowerCase()}`)}
                  className={`flex items-center justify-center h-11 rounded-full text-[14px] font-medium transition-colors ${
                    p.destaque
                      ? "bg-ink text-white hover:bg-ink/90"
                      : "bg-paper-alt text-ink hover:bg-paper-border/60"
                  }`}
                >
                  Testar grátis
                </a>

                <p className="text-[11.5px] uppercase tracking-[0.1em] text-ink-muted mt-7 mb-3">Inclui</p>
                <ul className="flex flex-col gap-2.5">
                  {p.itens.map((item) => (
                    <li key={item} className="flex gap-2.5 items-start">
                      <Check className="w-3.5 h-3.5 mt-[3px] shrink-0 text-ink" strokeWidth={2.6} />
                      <span className="text-[13px] text-ink-soft leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </RevealGroup.Item>
          ))}
        </RevealGroup>

        <Reveal variant="fade" delay={0.15} className="text-center mt-8">
          <Link
            to="/planos"
            onClick={() => trackCta("ver_planos", "pricing_home")}
            className="text-[13.5px] text-ink-soft underline decoration-brand underline-offset-4 hover:text-ink transition-colors"
          >
            Ver todos os planos, ciclo anual e Enterprise
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
