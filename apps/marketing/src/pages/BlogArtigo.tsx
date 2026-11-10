import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { trackCta } from "../analytics";
import { CTASection } from "../components/CTASection";
import { LinkDemo } from "../components/LinkDemo";
import { Reveal } from "../components/Reveal";
import { SplitButton } from "../components/ui/SplitButton";
import { ARTIGOS_POR_SLUG, dataPorExtenso, relacionados, type Artigo } from "../lib/blog";
import { analisarMarkdown, perguntasFrequentes } from "../lib/markdown";
import { Markdown } from "../components/blog/CorpoDoArtigo";
import { MODULOS_POR_SLUG } from "../lib/modules";
import { useJsonLd, usePageMeta } from "../lib/seo";
import { NotFound } from "./NotFound";

const BASE = "https://www.pilarsoft.com.br";

export function BlogArtigo() {
  const { slug = "" } = useParams();
  const artigo = ARTIGOS_POR_SLUG[slug];
  if (!artigo) return <NotFound />;
  return <ArtigoAberto artigo={artigo} />;
}

/**
 * Página do artigo: coluna de leitura estreita (~70 caracteres por linha), sumário
 * fixo ao lado no desktop, CTA do módulo ligado ao assunto no fim e "Continue
 * lendo". JSON-LD de BlogPosting, BreadcrumbList e, quando o artigo fecha com
 * "Perguntas frequentes", FAQPage.
 */
function ArtigoAberto({ artigo }: { artigo: Artigo }) {
  const blocos = useMemo(() => analisarMarkdown(artigo.corpo), [artigo.corpo]);
  const secoes = blocos.filter((b) => b.tipo === "h2") as { texto: string; id: string }[];
  const faq = perguntasFrequentes(blocos);
  const modulo = MODULOS_POR_SLUG[artigo.modulo];
  const url = `${BASE}/blog/${artigo.slug}`;

  usePageMeta({
    titulo: `${artigo.tituloSeo} | Pilar`,
    descricao: artigo.descricao,
    caminho: `/blog/${artigo.slug}`,
  });

  useJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: artigo.titulo,
        description: artigo.descricao,
        keywords: artigo.palavraChave,
        articleSection: artigo.categoria,
        inLanguage: "pt-BR",
        datePublished: artigo.publicadoEm,
        dateModified: artigo.atualizadoEm,
        url,
        mainEntityOfPage: url,
        image: `${BASE}/og-image-v2.jpg`,
        author: { "@type": "Organization", name: artigo.autor, url: `${BASE}/` },
        publisher: {
          "@type": "Organization",
          name: "Pilar",
          url: `${BASE}/`,
          logo: { "@type": "ImageObject", url: `${BASE}/apple-touch-icon.png` },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Pilar", item: `${BASE}/` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE}/blog` },
          { "@type": "ListItem", position: 3, name: artigo.titulo, item: url },
        ],
      },
      ...(faq.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faq.map((f) => ({
                "@type": "Question",
                name: f.pergunta,
                acceptedAnswer: { "@type": "Answer", text: f.resposta },
              })),
            },
          ]
        : []),
    ],
  });

  const proximos = relacionados(artigo);

  return (
    <>
      <article className="bg-paper px-5 pb-16 pt-24 md:px-10 md:pb-24 md:pt-32">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Trilha" className="mb-6 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
            <Link to="/blog" className="hover:text-ink">
              Blog
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{artigo.categoria}</span>
          </nav>

          <Reveal variant="up" className="max-w-3xl">
            <h1 className="mb-5 text-[46px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[38px] max-[850px]:text-[29px] max-[420px]:text-[25px]">
              {artigo.titulo}
            </h1>
            <p className="mb-6 text-[17px] leading-relaxed text-ink-soft">{artigo.resumo}</p>
            <p className="text-[12.5px] text-ink-muted">
              {artigo.autor} · <time dateTime={artigo.publicadoEm}>{dataPorExtenso(artigo.publicadoEm)}</time>
              {artigo.atualizadoEm !== artigo.publicadoEm && (
                <>
                  {" "}
                  · atualizado em <time dateTime={artigo.atualizadoEm}>{dataPorExtenso(artigo.atualizadoEm)}</time>
                </>
              )}{" "}
              · {artigo.minutosLeitura} min de leitura
            </p>
          </Reveal>

          <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-12 border-t border-paper-border/80 pt-10 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="min-w-0 max-w-[70ch]">
              <Markdown blocos={blocos} />

              <aside className="mt-14 rounded-[24px] bg-card-brand-soft p-7 md:p-9">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink/55">
                  <span className={`h-1.5 w-1.5 rounded-full ${modulo.cor.strong}`} />
                  {modulo.nome}
                </p>
                <p className="mb-3 text-[24px] font-medium leading-[1.15] tracking-[-0.025em] text-ink">
                  {modulo.headline} <span className="italic text-ink/45">{modulo.headlineFim}</span>
                </p>
                <p className="mb-6 text-[14.5px] leading-relaxed text-ink-soft">{modulo.lede}</p>
                <div className="flex flex-wrap items-center gap-4">
                  <SplitButton to="/planos" onClick={() => trackCta("ver_planos", `blog_${artigo.slug}`)}>
                    Ver planos
                  </SplitButton>
                  <Link
                    to={`/${modulo.slug}`}
                    className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink hover:text-ink/70"
                  >
                    Conhecer o módulo {modulo.nome} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <LinkDemo local={`blog_${artigo.slug}`} className="mt-4" />
              </aside>
            </div>

            {secoes.length > 2 && (
              <aside className="hidden lg:block">
                <nav aria-label="Neste artigo" className="sticky top-28">
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink/50">Neste artigo</p>
                  <ol className="flex flex-col gap-2.5 border-l border-paper-border pl-4">
                    {secoes.map((s) => (
                      <li key={s.id}>
                        <a href={`#${s.id}`} className="block text-[13px] leading-snug text-ink-muted hover:text-ink">
                          {s.texto}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </aside>
            )}
          </div>
        </div>
      </article>

      {proximos.length > 0 && (
        <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-6 text-[28px] font-medium tracking-[-0.03em] text-ink max-[850px]:text-[23px]">
              Continue lendo
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {proximos.map((a) => (
                <Link
                  key={a.slug}
                  to={`/blog/${a.slug}`}
                  className="group flex h-full flex-col rounded-[20px] border border-paper-border/80 p-6 transition-colors hover:border-ink/25"
                >
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink/50">{a.categoria}</p>
                  <h3 className="mb-3 text-[17px] font-medium leading-snug text-ink">{a.titulo}</h3>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
                    Ler <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <CTASection />
    </>
  );
}
