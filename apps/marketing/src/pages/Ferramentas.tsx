import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Copy, Download } from "lucide-react";
import { trackCta } from "../analytics";
import { CTASection } from "../components/CTASection";
import { HeroBackdrop } from "../components/hero/HeroBackdrop";
import { LinkDemo } from "../components/LinkDemo";
import { Reveal } from "../components/Reveal";
import { SplitButton } from "../components/ui/SplitButton";
import {
  calcularHonorarios,
  FERRAMENTAS,
  FERRAMENTAS_POR_SLUG,
  MODELO_PROPOSTA,
  lerNumero,
  type EntradaHonorarios,
} from "../lib/ferramentas";
import { useJsonLd, usePageMeta } from "../lib/seo";

const BASE = "https://www.pilarsoft.com.br";
const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function Hero({ rotulo, h1, lede }: { rotulo: string; h1: ReactNode; lede: string }) {
  return (
    <section className="relative isolate overflow-hidden px-5 pb-12 pt-24 md:px-10 md:pb-16 md:pt-32">
      <HeroBackdrop />
      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal variant="up" className="max-w-3xl">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ink/50">{rotulo}</p>
          <h1 className="mb-5 text-[48px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[38px] max-[850px]:text-[29px] max-[420px]:text-[25px]">
            {h1}
          </h1>
          <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft md:text-[16px]">{lede}</p>
        </Reveal>
      </div>
    </section>
  );
}

function Faq({ itens }: { itens: { pergunta: string; resposta: string }[] }) {
  useJsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: itens.map((f) => ({
      "@type": "Question",
      name: f.pergunta,
      acceptedAnswer: { "@type": "Answer", text: f.resposta },
    })),
  });
  return (
    <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-8 text-[30px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[850px]:text-[24px]">
          Perguntas frequentes
        </h2>
        <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {itens.map((f) => (
            <div key={f.pergunta}>
              <h3 className="mb-1.5 text-[14.5px] font-medium text-ink">{f.pergunta}</h3>
              <p className="text-[13px] leading-relaxed text-ink-muted">{f.resposta}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Fecho de cada ferramenta: o que o Pilar faz com isso, sem esconder a ferramenta atrás de cadastro. */
function NoPilar({
  titulo,
  texto,
  local,
  para,
  rotulo,
}: {
  titulo: string;
  texto: string;
  local: string;
  para: string;
  rotulo: string;
}) {
  return (
    <section className="bg-paper px-5 pb-16 md:px-10 md:pb-20">
      <div className="mx-auto max-w-6xl rounded-[24px] bg-card-brand-soft p-7 md:p-10">
        <p className="mb-3 text-[24px] font-medium leading-[1.15] tracking-[-0.025em] text-ink">{titulo}</p>
        <p className="mb-6 max-w-2xl text-[14.5px] leading-relaxed text-ink-soft">{texto}</p>
        <div className="flex flex-wrap items-center gap-4">
          <SplitButton to="/planos" onClick={() => trackCta("ver_planos", local)}>
            Ver planos
          </SplitButton>
          <Link
            to={para}
            className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink hover:text-ink/70"
          >
            {rotulo} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <LinkDemo local={local} className="mt-4" />
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ índice

export function Ferramentas() {
  usePageMeta({
    titulo: "Ferramentas para escritório de engenharia e arquitetura | Pilar",
    descricao:
      "Ferramentas abertas para escritório de engenharia e arquitetura: calculadora de honorários e da hora técnica e modelo de proposta de projeto por disciplina.",
    caminho: "/ferramentas",
  });

  return (
    <>
      <Hero
        rotulo="Ferramentas"
        h1={
          <>
            Ferramentas para escritório de <span className="italic text-ink/45">engenharia e arquitetura.</span>
          </>
        }
        lede="Abertas, sem cadastro. Use no próximo orçamento e na próxima proposta."
      />
      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
          {FERRAMENTAS.map((f) => (
            <Link
              key={f.slug}
              to={`/ferramentas/${f.slug}`}
              className="group flex h-full flex-col rounded-[22px] bg-card-brand-soft p-7 transition-colors hover:bg-card-brand-soft/80 md:p-9"
            >
              <h2 className="mb-3 text-[24px] font-medium leading-snug tracking-[-0.02em] text-ink">{f.nome}</h2>
              <p className="mb-6 flex-1 text-[14.5px] leading-relaxed text-ink-soft">{f.resumo}</p>
              <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                Abrir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <CTASection />
    </>
  );
}

// ------------------------------------------------------------------ calculadora

const CAMPOS: { chave: keyof EntradaHonorarios; rotulo: string; ajuda: string; sufixo?: string; prefixo?: string }[] = [
  {
    chave: "custosFixos",
    rotulo: "Custos fixos do mês",
    ajuda: "Aluguel, software, contador, internet, deslocamento.",
    prefixo: "R$",
  },
  { chave: "folha", rotulo: "Folha da equipe", ajuda: "Salários, encargos e benefícios de todos.", prefixo: "R$" },
  {
    chave: "proLabore",
    rotulo: "Pró-labore dos sócios",
    ajuda: "Sócio que não se paga esconde o custo real da hora.",
    prefixo: "R$",
  },
  { chave: "pessoasTecnicas", rotulo: "Pessoas que produzem projeto", ajuda: "Inclua os sócios que projetam." },
  { chave: "horasPorMes", rotulo: "Horas por pessoa no mês", ajuda: "Jornada contratada, ex.: 160.", sufixo: "h" },
  {
    chave: "produtividade",
    rotulo: "Horas que viram projeto",
    ajuda: "O resto é reunião, venda e administrativo.",
    sufixo: "%",
  },
  { chave: "margem", rotulo: "Lucro desejado sobre o custo", ajuda: "O que sobra depois de pagar tudo.", sufixo: "%" },
  {
    chave: "impostos",
    rotulo: "Impostos sobre o faturamento",
    ajuda: "Confirme a alíquota do seu regime com o contador.",
    sufixo: "%",
  },
  {
    chave: "horasProjeto",
    rotulo: "Horas estimadas do projeto",
    ajuda: "Soma das horas de todas as disciplinas.",
    sufixo: "h",
  },
];

/** Valores de exemplo, hipotéticos, para a conta abrir preenchida. */
const EXEMPLO: EntradaHonorarios = {
  custosFixos: 8000,
  folha: 30000,
  proLabore: 20000,
  pessoasTecnicas: 5,
  horasPorMes: 160,
  produtividade: 70,
  margem: 25,
  impostos: 15,
  horasProjeto: 120,
};

export function CalculadoraHonorarios() {
  const f = FERRAMENTAS_POR_SLUG["calculadora-de-honorarios"];
  usePageMeta({ titulo: `${f.tituloSeo} | Pilar`, descricao: f.descricao, caminho: `/ferramentas/${f.slug}` });
  useJsonLd({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: f.nome,
    url: `${BASE}/ferramentas/${f.slug}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    description: f.descricao,
  });

  const [textos, setTextos] = useState<Record<keyof EntradaHonorarios, string>>(
    () =>
      Object.fromEntries(Object.entries(EXEMPLO).map(([k, v]) => [k, String(v)])) as Record<
        keyof EntradaHonorarios,
        string
      >
  );
  const resultado = useMemo(
    () =>
      calcularHonorarios(
        Object.fromEntries(Object.entries(textos).map(([k, v]) => [k, lerNumero(v)])) as unknown as EntradaHonorarios
      ),
    [textos]
  );

  return (
    <>
      <Hero
        rotulo="Ferramenta aberta"
        h1={f.h1}
        lede="Quanto custa uma hora do seu escritório, por quanto ela precisa ser vendida e quanto vale o projeto pelas horas estimadas. Os números de exemplo são hipotéticos: troque pelos seus."
      />

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-20">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <form
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={(e) => e.preventDefault()}
            aria-label="Dados do escritório"
          >
            {CAMPOS.map((c) => (
              <label key={c.chave} className="flex flex-col gap-1.5">
                <span className="text-[13.5px] font-medium text-ink">{c.rotulo}</span>
                <span className="flex items-center rounded-[14px] border border-paper-border bg-paper px-3.5 focus-within:border-ink/50">
                  {c.prefixo && <span className="mr-2 text-[13px] text-ink-muted">{c.prefixo}</span>}
                  <input
                    inputMode="decimal"
                    value={textos[c.chave]}
                    onChange={(e) => setTextos((t) => ({ ...t, [c.chave]: e.target.value }))}
                    className="w-full bg-transparent py-2.5 text-[15px] text-ink outline-none"
                  />
                  {c.sufixo && <span className="ml-2 text-[13px] text-ink-muted">{c.sufixo}</span>}
                </span>
                <span className="text-[12px] leading-snug text-ink-muted">{c.ajuda}</span>
              </label>
            ))}
          </form>

          <aside className="h-fit rounded-[24px] bg-card-brand-soft p-7 lg:sticky lg:top-28" aria-live="polite">
            <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.16em] text-ink/55">Resultado</p>
            <dl className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[13.5px] text-ink-soft">Custo do escritório no mês</dt>
                <dd className="text-[15px] font-medium text-ink">{reais.format(resultado.custoMensal)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[13.5px] text-ink-soft">Horas que viram projeto</dt>
                <dd className="text-[15px] font-medium text-ink">{numero.format(resultado.horasProdutivas)} h</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-ink/10 pt-4">
                <dt className="text-[13.5px] text-ink-soft">Custo da hora técnica</dt>
                <dd className="text-[18px] font-medium text-ink">{reais.format(resultado.custoHora)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[13.5px] text-ink-soft">Preço mínimo da hora</dt>
                <dd className="text-[22px] font-medium text-ink">{reais.format(resultado.precoHora)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-ink/10 pt-4">
                <dt className="text-[13.5px] text-ink-soft">
                  Valor do projeto ({numero.format(lerNumero(textos.horasProjeto))} h)
                </dt>
                <dd className="text-[26px] font-medium tracking-[-0.02em] text-ink">
                  {reais.format(resultado.precoProjeto)}
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-[12px] leading-relaxed text-ink-muted">
              Preço da hora = custo da hora × (1 + lucro) ÷ (1 − impostos). O imposto incide sobre o preço, por isso
              divide.
            </p>
          </aside>
        </div>
      </section>

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-20">
        <div className="mx-auto max-w-[70ch]">
          <h2 className="mb-4 text-[26px] font-medium tracking-[-0.025em] text-ink">Como usar o resultado</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[15.5px] leading-[1.7] text-ink-soft marker:text-ink-muted">
            <li>
              O <strong className="font-medium text-ink">custo da hora</strong> é o piso: vender abaixo dele é pagar
              para trabalhar.
            </li>
            <li>
              Compare o valor pelas horas com outros métodos (por área, por percentual da obra, tabela de honorários do
              conselho) e fique com o que se defende melhor com o cliente.
            </li>
            <li>
              Some as horas por disciplina e por etapa, contando as rodadas de revisão. Hora esquecida no orçamento sai
              do lucro.
            </li>
            <li>
              Refaça a conta quando a equipe ou os custos fixos mudarem. Leia o passo a passo em{" "}
              <Link
                to="/blog/como-precificar-projeto-arquitetura-engenharia"
                className="text-ink underline underline-offset-[3px]"
              >
                como precificar projeto de arquitetura e engenharia
              </Link>
              .
            </li>
          </ul>
        </div>
      </section>

      <NoPilar
        titulo="Do preço à proposta, sem redigitar."
        texto="No Pilar, a proposta é montada por disciplina e sai em DOCX no template do escritório. Aprovada, vira projeto com as parcelas no financeiro."
        local={f.slug}
        para="/gestao"
        rotulo="Conhecer o módulo Gestão"
      />

      <Faq
        itens={[
          {
            pergunta: "O que entra no custo da hora técnica?",
            resposta:
              "Tudo o que o escritório paga no mês (custos fixos, folha com encargos e pró-labore) dividido pelas horas que de fato viram projeto, não pela jornada inteira.",
          },
          {
            pergunta: "Por que considerar só parte das horas?",
            resposta:
              "Porque reunião, venda, proposta e administrativo consomem horas que o cliente não paga diretamente. Usar a jornada inteira deixa o custo da hora artificialmente baixo.",
          },
          {
            pergunta: "Posso usar a calculadora para arquitetura e engenharia?",
            resposta:
              "Pode. A conta é a mesma para qualquer escritório que vende hora técnica. O que muda é a estimativa de horas por disciplina e etapa.",
          },
          {
            pergunta: "Qual alíquota de imposto usar?",
            resposta:
              "Depende do regime tributário e da faixa de faturamento do escritório. Confirme o percentual com o contador antes de fechar o preço.",
          },
        ]}
      />
      <CTASection />
    </>
  );
}

// ------------------------------------------------------------------ modelo de proposta

export function ModeloProposta() {
  const f = FERRAMENTAS_POR_SLUG["modelo-de-proposta"];
  const [copiado, setCopiado] = useState(false);
  usePageMeta({ titulo: `${f.tituloSeo} | Pilar`, descricao: f.descricao, caminho: `/ferramentas/${f.slug}` });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(MODELO_PROPOSTA);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2400);
    } catch {
      setCopiado(false);
    }
    trackCta("copiar_modelo_proposta", f.slug);
  };

  const baixar = () => {
    const url = URL.createObjectURL(new Blob([MODELO_PROPOSTA], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-de-proposta-de-projeto.txt";
    a.click();
    URL.revokeObjectURL(url);
    trackCta("baixar_modelo_proposta", f.slug);
  };

  return (
    <>
      <Hero
        rotulo="Ferramenta aberta"
        h1={f.h1}
        lede="A estrutura de uma proposta por disciplina que evita a briga mais comum: o que estava ou não estava incluído. Copie, baixe e adapte ao seu escritório."
      />

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-20">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copiar}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-medium text-paper hover:bg-ink/85"
              >
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiado ? "Copiado" : "Copiar modelo"}
              </button>
              <button
                type="button"
                onClick={baixar}
                className="inline-flex items-center gap-2 rounded-full border border-paper-border px-5 py-2.5 text-[13.5px] font-medium text-ink hover:border-ink/40"
              >
                <Download className="h-4 w-4" /> Baixar (.txt)
              </button>
            </div>
            <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded-[20px] border border-paper-border/80 bg-paper-alt/50 p-6 font-sans text-[13.5px] leading-[1.7] text-ink">
              {MODELO_PROPOSTA}
            </pre>
          </div>
          <aside className="h-fit lg:sticky lg:top-28">
            <h2 className="mb-3 text-[18px] font-medium text-ink">Como usar</h2>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-ink-soft marker:text-ink-muted">
              <li>Preencha o que está entre colchetes.</li>
              <li>Uma seção de escopo por disciplina contratada.</li>
              <li>Liste o que não está incluído. É o que evita aditivo não pago.</li>
              <li>Amarre cada parcela a uma entrega.</li>
              <li>Peça a um advogado para revisar o contrato.</li>
            </ol>
            <p className="mt-5 text-[13px] leading-relaxed text-ink-muted">
              Passo a passo completo em{" "}
              <Link to="/blog/proposta-projeto-engenharia" className="text-ink underline underline-offset-[3px]">
                como fazer uma proposta de projeto de engenharia
              </Link>
              .
            </p>
          </aside>
        </div>
      </section>

      <NoPilar
        titulo="A proposta sai do sistema, no seu template."
        texto="No Pilar, a proposta é montada por disciplina, sai em DOCX com a cara do escritório e vai por e-mail sem sair do sistema. Aprovada, vira projeto com as parcelas no financeiro."
        local={f.slug}
        para="/gestao"
        rotulo="Conhecer o módulo Gestão"
      />

      <Faq
        itens={[
          {
            pergunta: "O modelo serve como contrato?",
            resposta:
              "Ele organiza a proposta comercial e técnica. Para virar contrato, peça a revisão de um advogado, principalmente nas cláusulas de pagamento, atraso e rescisão.",
          },
          {
            pergunta: "Serve para arquitetura e engenharia?",
            resposta:
              "Sim. A estrutura é por disciplina e etapa: arquitetura, estrutural, instalações e climatização entram como seções próprias.",
          },
          {
            pergunta: "Quantas rodadas de revisão incluir?",
            resposta:
              "O número é decisão do escritório. O importante é escrever quantas estão incluídas e que mudança de premissa já aprovada entra por aditivo.",
          },
          {
            pergunta: "Por que amarrar parcela a entrega?",
            resposta:
              "Porque o cliente paga pelo que recebe, e o escritório não financia o projeto inteiro esperando o fim. Cada entrega aprovada libera a parcela seguinte.",
          },
        ]}
      />
      <CTASection />
    </>
  );
}
