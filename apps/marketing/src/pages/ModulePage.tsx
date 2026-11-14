import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { trackCta } from "../analytics";
import { BrowserFrame } from "../components/BrowserFrame";
import { CTASection } from "../components/CTASection";
import { HeroBackdrop } from "../components/hero/HeroBackdrop";
import { Celular, GroupMock } from "../components/mock/ModuleScreens";
import { Reveal } from "../components/Reveal";
import { SplitButton } from "../components/ui/SplitButton";
import { MODULOS, MODULOS_POR_SLUG, type MockNome, type Modulo, type ModuloSlug } from "../lib/modules";
import { useJsonLd, usePageMeta } from "../lib/seo";

import { LinkDemo } from "../components/LinkDemo";

/**
 * Print real da tela, com rede de segurança: enquanto o PNG não existe em
 * public/screens, o onError derruba pro desenho vetorial DAQUELE grupo (não
 * uma tela genérica repetida), então a página nunca mostra imagem quebrada.
 * Solte o arquivo no caminho declarado em `modules.ts` e o print assume sem
 * mexer em código.
 */
function PrintReal({ img, alt, mock, modulo }: { img: string; alt: string; mock: MockNome; modulo: Modulo }) {
  const [caiu, setCaiu] = useState(false);
  const ehFone = mock.startsWith("campo");

  if (caiu) {
    if (ehFone) return <GroupMock mock={mock} />;
    return (
      <BrowserFrame url={modulo.url}>
        <div className="bg-app p-5 md:p-6">
          <GroupMock mock={mock} />
        </div>
      </BrowserFrame>
    );
  }

  if (ehFone) {
    return (
      <Celular>
        <img
          src={img}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover object-top"
          onError={() => setCaiu(true)}
        />
      </Celular>
    );
  }

  return (
    <BrowserFrame url={modulo.url}>
      <img src={img} alt={alt} className="block w-full" onError={() => setCaiu(true)} />
    </BrowserFrame>
  );
}

/**
 * Página de um módulo. O conteúdo vem de `lib/modules.ts`; o desenho segue a
 * home redesenhada: a paisagem de ondas verdes no hero, headline com o fim em
 * itálico apagado, funcionalidades em grupos temáticos com a tela daquele
 * grupo ao lado (não uma lista corrida), as outras frentes no fim e o mesmo
 * fecho da home.
 *
 * Sem breadcrumb: quem chega aqui veio do bento ou do menu, e o logo do
 * header já volta pra home.
 */
export function ModulePage({ slug }: { slug: ModuloSlug }) {
  const modulo = MODULOS_POR_SLUG[slug];

  usePageMeta({
    titulo: `${modulo.seo.titulo} | Pilar`,
    descricao: modulo.seo.descricao,
    caminho: `/${slug}`,
  });

  useJsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: modulo.faq.map((f) => ({
      "@type": "Question",
      name: f.pergunta,
      acceptedAnswer: { "@type": "Answer", text: f.resposta },
    })),
  });

  const outras = MODULOS.filter((m) => m.slug !== slug);

  return (
    <>
      <section className="relative isolate overflow-hidden px-5 pb-14 pt-24 md:px-10 md:pb-20 md:pt-32">
        <HeroBackdrop />
        <div className="relative z-10 mx-auto max-w-6xl">
          <Reveal variant="up" className="max-w-3xl">
            {/* A headline grande é frase de marca, num <p> com desenho de título. O H1
                (a frase com a palavra-chave que se busca no Google) abre o parágrafo
                de apoio, como na home. Antes ele era uma etiqueta em caixa-alta acima
                da headline, que repetia o título e empurrava tudo pra baixo. */}
            <p className="mb-5 text-[58px] font-medium leading-[1.06] tracking-[-0.035em] text-ink max-[1100px]:text-[44px] max-[850px]:text-[32px] max-[420px]:text-[27px]">
              {modulo.headline} <span className="italic text-ink/45">{modulo.headlineFim}</span>
            </p>
            <div className="mb-8 max-w-xl text-[15px] leading-relaxed text-ink-soft md:text-[16px]">
              <h1 className="inline font-normal">{modulo.seo.h1}.</h1> {modulo.lede}
            </div>

            <div className="flex flex-wrap gap-3">
              <SplitButton to="/planos" onClick={() => trackCta("ver_planos", `modulo_${slug}`)}>
                Ver planos
              </SplitButton>
            </div>
            <LinkDemo local={`modulo_${slug}`} className="mt-3" />
          </Reveal>
        </div>
      </section>

      {/* Funcionalidades em grupos temáticos, alternando texto e tela: o
          visitante entende o que cada pedaço faz olhando, não decifrando uma
          lista corrida de dezesseis linhas. */}
      <section className="bg-paper px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal variant="up" className="mb-14 max-w-2xl md:mb-20">
            <h2 className="text-[40px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[34px] max-[850px]:text-[27px] max-[420px]:text-[24px]">
              Tudo isto <span className="italic text-ink/45">já roda hoje.</span>
            </h2>
          </Reveal>

          <div className="flex flex-col gap-16 md:gap-24">
            {modulo.grupos.map((g, gi) => (
              // `grid-cols-1` + `min-w-0`: sem isso a coluna única do celular crescia até
              // a largura mínima da tela simulada (a fileira de abas do Obra) e a
              // página inteira passava de 390px, escondendo o botão de menu.
              <div key={g.titulo} className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14">
                <Reveal
                  variant={gi % 2 === 0 ? "left" : "right"}
                  className={`min-w-0 ${gi % 2 === 0 ? "" : "lg:order-2"}`}
                >
                  <h3 className="mb-2.5 text-[26px] font-medium leading-[1.15] tracking-[-0.03em] text-ink md:text-[30px]">
                    {g.titulo}
                  </h3>
                  <p className="mb-7 text-[14.5px] leading-relaxed text-ink-soft">{g.frase}</p>

                  <ul className="flex flex-col gap-5">
                    {g.features.map((f) => (
                      <li key={f.titulo} className="flex gap-3.5">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand">
                          <Check className="h-3.5 w-3.5 text-ink" strokeWidth={2.4} />
                        </span>
                        <span>
                          <span className="block text-[15px] font-medium text-ink">{f.titulo}</span>
                          <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-muted">{f.texto}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Reveal>

                <Reveal
                  variant={gi % 2 === 0 ? "right" : "left"}
                  delay={0.1}
                  className={`min-w-0 ${gi % 2 === 0 ? "" : "lg:order-1"}`}
                >
                  <PrintReal img={g.img} alt={g.titulo} mock={g.mock} modulo={modulo} />
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Objeções reais respondidas antes do CTA final: o padrão de toda
          página de conversão madura (e rende rich result de FAQ na busca). */}
      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <Reveal variant="up" className="mb-8 max-w-2xl">
            <h2 className="text-[40px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[34px] max-[850px]:text-[27px] max-[420px]:text-[24px]">
              Antes de assinar, <span className="italic text-ink/45">o que todo mundo pergunta.</span>
            </h2>
          </Reveal>

          <div className="grid gap-x-10 gap-y-7 sm:grid-cols-3">
            {modulo.faq.map((f, i) => (
              <Reveal key={f.pergunta} variant="up" delay={i * 0.06}>
                <h3 className="mb-1.5 text-[15px] font-medium text-ink">{f.pergunta}</h3>
                <p className="text-[13px] leading-relaxed text-ink-muted">{f.resposta}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* As outras frentes: o produto são cinco pedaços que se alimentam, e
          daqui dá pra ir a qualquer um sem voltar pra home. */}
      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <Reveal variant="up" className="mb-8 max-w-2xl">
            <h2 className="text-[40px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[34px] max-[850px]:text-[27px] max-[420px]:text-[24px]">
              Uma frente <span className="italic text-ink/45">puxa a outra.</span>
            </h2>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {outras.map((outro, i) => {
              const conexao = modulo.conecta.find((c) => c.slug === outro.slug);
              return (
                <Reveal key={outro.slug} variant="up" delay={i * 0.06} className="h-full">
                  <Link
                    to={`/${outro.slug}`}
                    className="group flex h-full items-start justify-between gap-4 rounded-[22px] bg-card-brand-soft p-6 transition-colors hover:bg-card-brand"
                  >
                    <span>
                      <span className="mb-1.5 block text-[17px] font-medium text-ink">{outro.nome}</span>
                      <span className="block text-[13px] leading-relaxed text-ink/65">
                        {conexao ? conexao.texto : outro.resumo}
                      </span>
                    </span>
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink transition-colors group-hover:bg-ink group-hover:text-white">
                      <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
