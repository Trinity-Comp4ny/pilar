import { MidiaProduto } from "../components/MidiaProduto";
import { MIDIAS_PRODUTO } from "../lib/midiasProduto";
import { PAGINAS_RECURSO, caminhoRecurso } from "../lib/catalogo";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { BrowserFrame } from "../components/BrowserFrame";
import { CTASection } from "../components/CTASection";
import { HeroBackdrop } from "../components/hero/HeroBackdrop";
import { Celular, GroupMock } from "../components/mock/ModuleScreens";
import { Reveal } from "../components/Reveal";
import { MODULOS, MODULOS_POR_SLUG, type MockNome, type Modulo, type ModuloSlug } from "../lib/modules";
import { useJsonLd, usePageMeta } from "../lib/seo";

import { BotoesCta } from "../components/BotoesCta";

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
const h2 =
  "text-[40px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[34px] max-[850px]:text-[27px] max-[420px]:text-[24px]";

export function ModulePage({ slug }: { slug: ModuloSlug }) {
  const modulo = MODULOS_POR_SLUG[slug];
  const midia = MIDIAS_PRODUTO[slug];

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
  const primeiro = modulo.grupos[0];
  const recursos = PAGINAS_RECURSO.filter((pagina) => pagina.area === slug);

  return (
    <>
      <section className="relative isolate overflow-hidden px-5 pb-14 pt-24 md:px-10 md:pb-20 md:pt-32">
        <HeroBackdrop />
        <div className="relative z-10 mx-auto max-w-6xl">
          {/* Troca de módulo sem voltar ao menu: o produto são cinco frentes ligadas, e
              quem está numa quer ver a do lado. */}
          <Reveal variant="up" className="mb-8 md:mb-10">
            <nav aria-label="Módulos" className="flex flex-wrap items-center gap-2">
              {MODULOS.map((m) => {
                const atual = m.slug === slug;
                return (
                  <Link
                    key={m.slug}
                    to={`/${m.slug}`}
                    aria-current={atual ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
                      atual
                        ? "border-ink bg-ink text-white"
                        : "border-ink/15 bg-white/70 text-ink-soft hover:border-ink/40 hover:text-ink"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${m.cor.strong}`} />
                    {m.nome}
                  </Link>
                );
              })}
              <Link
                to="/funcionalidades"
                className="ml-1 flex items-center gap-1 text-[13px] text-ink-soft underline-offset-2 hover:text-ink hover:underline"
              >
                Todas as funcionalidades
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
              </Link>
            </nav>
          </Reveal>

          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
            <Reveal variant="up" className="min-w-0">
              {/* A headline grande é frase de marca, num <p> com desenho de título. O H1
                  (a frase com a palavra-chave que se busca no Google) abre o parágrafo
                  de apoio, como na home. */}
              <p className="mb-5 text-[58px] font-medium leading-[1.06] tracking-[-0.035em] text-ink max-[1100px]:text-[44px] max-[850px]:text-[32px] max-[420px]:text-[27px]">
                {modulo.headline} <span className="italic text-ink/45">{modulo.headlineFim}</span>
              </p>
              <div className="mb-8 max-w-xl text-[15px] leading-relaxed text-ink-soft md:text-[16px]">
                <h1 className="inline font-normal">{modulo.seo.h1}.</h1> {modulo.lede}
              </div>

              <BotoesCta local={`modulo_${slug}`} />
            </Reveal>

            {/* Abertura visual: o print real do módulo quando existe; senão a tela do primeiro grupo. */}
            <Reveal variant="right" delay={0.1} className="min-w-0">
              {midia?.print ? (
                <BrowserFrame url={modulo.url}>
                  <img
                    src={`/screens/${midia.print.arquivo}.${midia.print.formato ?? "png"}`}
                    alt={midia.print.descricao}
                    width={midia.print.largura ?? 1440}
                    height={midia.print.altura ?? 900}
                    className="block w-full"
                  />
                </BrowserFrame>
              ) : (
                <PrintReal img={primeiro.img} alt={primeiro.titulo} mock={primeiro.mock} modulo={modulo} />
              )}
            </Reveal>
          </div>

          {/* Índice do módulo: cada grupo vira um atalho para a seção abaixo. */}
          <Reveal variant="up" delay={0.15} className="mt-10 md:mt-14">
            <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-muted">Neste módulo</p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {modulo.grupos.map((g, gi) => (
                <li key={g.id}>
                  <a
                    href={`#${g.id}`}
                    className="group flex h-full items-center gap-3 rounded-[16px] border border-ink/10 bg-white/70 px-4 py-3 transition-colors hover:border-ink/30 hover:bg-white"
                  >
                    <span className="text-[12px] font-medium tabular-nums text-ink/50">
                      {String(gi + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-[14px] leading-snug text-ink">{g.titulo}</span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 rotate-90 text-ink/40 transition-colors group-hover:text-ink"
                      strokeWidth={1.9}
                    />
                  </a>
                </li>
              ))}
            </ul>
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
              <div
                key={g.id}
                id={g.id}
                className="grid scroll-mt-28 grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14"
              >
                <Reveal
                  variant={gi % 2 === 0 ? "left" : "right"}
                  className={`min-w-0 ${gi % 2 === 0 ? "" : "lg:order-2"}`}
                >
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                    {String(gi + 1).padStart(2, "0")} / {String(modulo.grupos.length).padStart(2, "0")}
                  </p>
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

      {slug === "portal" && (
        <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
          <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-14">
            <Reveal variant="up" className="min-w-0">
              <h2 className={h2}>
                Financeiro <span className="italic text-ink/45">do cliente.</span>
              </h2>
              <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
                Consulte as parcelas do projeto. Na visão de obra, acompanhe a prestação de contas disponibilizada pelo
                escritório.
              </p>
            </Reveal>
            <Reveal variant="up" delay={0.1} className="min-w-0">
              <figure className="min-w-0 overflow-x-auto rounded-[22px] border border-paper-border bg-white p-4">
                <GroupMock mock="parcelas" />
                <figcaption className="mt-3 text-sm text-ink-muted">
                  Ilustração de parcelas com dados de exemplo.
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </section>
      )}

      {/* O print já abre a página; aqui entra só o vídeo, em loop. */}
      {midia?.video && (
        <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
          <div className="mx-auto max-w-4xl">
            <Reveal variant="up" className="mb-8 max-w-2xl">
              <h2 className={h2}>
                Veja {modulo.nome} <span className="italic text-ink/45">na Pilar.</span>
              </h2>
            </Reveal>
            <MidiaProduto midia={midia} />
          </div>
        </section>
      )}

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <Reveal variant="up" className="mb-8 max-w-2xl">
            <h2 className={h2}>
              Explore <span className="italic text-ink/45">os recursos.</span>
            </h2>
          </Reveal>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recursos.map((pagina) => (
              <Link
                key={pagina.slug}
                to={caminhoRecurso(pagina.slug)}
                className="group flex items-start justify-between gap-4 rounded-[20px] border border-paper-border bg-white p-5 transition-colors hover:border-ink/30"
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-ink">{pagina.titulo}</span>
                  <span className="mt-1 line-clamp-2 block text-[12.5px] leading-snug text-ink-muted">
                    {pagina.descricao}
                  </span>
                </span>
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-ink/40 transition-all group-hover:translate-x-0.5 group-hover:text-ink"
                  strokeWidth={1.9}
                />
              </Link>
            ))}
            <Link
              to="/funcionalidades"
              className="group flex items-center justify-between gap-4 rounded-[20px] bg-ink p-5 text-[15px] font-medium text-white"
            >
              Ver catálogo completo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.9} />
            </Link>
          </div>
        </div>
      </section>
      <CTASection />
    </>
  );
}
