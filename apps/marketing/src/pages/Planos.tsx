import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { trackCta } from "../analytics";
import { Reveal } from "../components/Reveal";
import { IncluidoEmTodos, PlanCards } from "../components/PlanCards";
import { HeroBackdrop } from "../components/hero/HeroBackdrop";

/**
 * Página de planos.
 *
 * Não lê mais o catálogo do Supabase. A leitura custava um estado de
 * carregamento visível em toda visita para buscar três linhas que mudam uma vez
 * por semestre, e travava a página inteira quando a rede ia mal. Os valores
 * vivem em `lib/planos.ts`, conferidos contra o banco (ver comentário lá).
 *
 * Enterprise saiu: a v3 tem três faixas, e "sob consulta" numa quarta coluna
 * sugeria que existe um degrau escondido de funcionalidade, o que contradiz o
 * ADR 0026. Ciclo anual também saiu, porque a v3 registra anual como N/A.
 */

const PERGUNTAS = [
  {
    q: "O que conta como projeto ativo?",
    a: "Projeto em andamento na sua carteira. Concluído ou cancelado não ocupa faixa, então o número que importa é quantos você toca ao mesmo tempo.",
  },
  {
    q: "E se eu passar da faixa?",
    a: "A gente avisa antes de virar problema e você sobe de plano quando fizer sentido. Não cortamos acesso nem cobramos excedente sem falar com você.",
  },
  {
    q: "Preciso pagar por usuário?",
    a: "Não. O preço é da empresa inteira. Coloque o escritório todo, estagiário e sócio, sem mudar a conta.",
  },
  {
    q: "O que é uma ação de IA?",
    a: "Uma tarefa concluída por um agente: ler um extrato, montar um lançamento, importar um orçamento. Consulta e conversa não descontam cota.",
  },
];

export function Planos() {
  useEffect(() => {
    document.title = "Planos | Pilar";
  }, []);

  return (
    <>
      <section className="relative isolate overflow-hidden px-5 py-16 md:px-10 md:py-24">
        <HeroBackdrop />

        <div className="relative z-10 mx-auto max-w-6xl">
          <Reveal variant="down" className="mb-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.9} />
              Voltar para a home
            </Link>
          </Reveal>

          <Reveal variant="up" className="mb-12 max-w-2xl">
            <h1 className="mb-4 text-[58px] font-medium leading-[1.06] tracking-[-0.035em] text-ink max-[1100px]:text-[44px] max-[850px]:text-[32px] max-[420px]:text-[27px]">
              Um preço por escritório.{" "}
              <span className="rounded-[0.28em] bg-brand px-[0.16em] italic">sem contar cabeças.</span>
            </h1>
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Todo plano tem a plataforma inteira. O que muda é quantos projetos você toca ao mesmo tempo e quanto de IA
              usa no mês. Cartão, PIX ou boleto, sem fidelidade.
            </p>
          </Reveal>

          <div className="mb-6">
            <PlanCards contexto="planos" />
          </div>

          <Reveal variant="up" delay={0.1}>
            <IncluidoEmTodos />
          </Reveal>
        </div>
      </section>

      <section className="bg-paper px-5 pb-20 md:px-10 md:pb-28">
        <div className="mx-auto max-w-3xl">
          <Reveal variant="up" className="mb-8">
            <h2 className="text-[32px] font-medium leading-[1.1] tracking-[-0.035em] text-ink max-[850px]:text-[25px]">
              Antes de assinar
            </h2>
          </Reveal>

          <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {PERGUNTAS.map((p, i) => (
              <Reveal key={p.q} variant="up" delay={i * 0.06}>
                <h3 className="mb-1.5 text-[14.5px] font-medium text-ink">{p.q}</h3>
                <p className="text-[13px] leading-relaxed text-ink-muted">{p.a}</p>
              </Reveal>
            ))}
          </div>

          <Reveal variant="fade" delay={0.2} className="mt-10">
            <a
              href="https://wa.me/5514998721100"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCta("agende_demo", "planos")}
              className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-6 text-[14px] font-medium text-white transition-colors hover:bg-ink/90"
            >
              Ainda com dúvida? Fale com a gente
            </a>
          </Reveal>
        </div>
      </section>
    </>
  );
}
