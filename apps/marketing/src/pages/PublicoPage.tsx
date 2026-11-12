import { Link } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";
import { trackCta } from "../analytics";
import { CTASection } from "../components/CTASection";
import { HeroBackdrop } from "../components/hero/HeroBackdrop";
import { LinkDemo } from "../components/LinkDemo";
import { Reveal } from "../components/Reveal";
import { SplitButton } from "../components/ui/SplitButton";
import { ARTIGOS_POR_SLUG } from "../lib/blog";
import { MODULOS_POR_SLUG } from "../lib/modules";
import { PUBLICOS_POR_SLUG, type PublicoSlug } from "../lib/publicos";
import { useJsonLd, usePageMeta } from "../lib/seo";

/**
 * Página por público (engenharia, arquitetura). Mesmo esqueleto das páginas de
 * módulo: hero com a paisagem, dores, como cada módulo resolve, para quem é e
 * para quem não é, artigos do blog, FAQ e o fecho da home.
 */
export function PublicoPage({ slug }: { slug: PublicoSlug }) {
  const p = PUBLICOS_POR_SLUG[slug];

  usePageMeta({ titulo: `${p.tituloSeo} | Pilar`, descricao: p.descricao, caminho: `/${slug}` });

  useJsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: p.faq.map((f) => ({
      "@type": "Question",
      name: f.pergunta,
      acceptedAnswer: { "@type": "Answer", text: f.resposta },
    })),
  });

  const artigos = p.artigos.map((s) => ARTIGOS_POR_SLUG[s]).filter(Boolean);

  return (
    <>
      <section className="relative isolate overflow-hidden px-5 pb-14 pt-24 md:px-10 md:pb-20 md:pt-32">
        <HeroBackdrop />
        <div className="relative z-10 mx-auto max-w-6xl">
          <Reveal variant="up" className="max-w-3xl">
            <h1 className="mb-5 text-[52px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[40px] max-[850px]:text-[30px] max-[420px]:text-[25px]">
              {p.headline} <span className="italic text-ink/45">{p.headlineFim}</span>
            </h1>
            <p className="mb-8 max-w-xl text-[15px] leading-relaxed text-ink-soft md:text-[16px]">{p.lede}</p>
            <div className="flex flex-wrap gap-3">
              <SplitButton to="/planos" onClick={() => trackCta("ver_planos", `publico_${slug}`)}>
                Ver planos
              </SplitButton>
            </div>
            <LinkDemo local={`publico_${slug}`} className="mt-3" />
          </Reveal>
        </div>
      </section>

      <section className="bg-paper px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-6xl">
          <Reveal variant="up" className="mb-8 max-w-2xl">
            <h2 className="text-[36px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[30px] max-[850px]:text-[25px]">
              O que trava <span className="italic text-ink/45">o escritório hoje</span>
            </h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {p.dores.map((d, i) => (
              <Reveal key={d.titulo} variant="up" delay={i * 0.06}>
                <div className="h-full rounded-[20px] border border-paper-border/80 p-6">
                  <h3 className="mb-2 text-[16px] font-medium text-ink">{d.titulo}</h3>
                  <p className="text-[13.5px] leading-relaxed text-ink-muted">{d.texto}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-20">
        <div className="mx-auto max-w-6xl">
          <Reveal variant="up" className="mb-8 max-w-2xl">
            <h2 className="text-[36px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[30px] max-[850px]:text-[25px]">
              Como a Pilar <span className="italic text-ink/45">organiza</span>
            </h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            {p.frentes.map((f, i) => {
              const m = MODULOS_POR_SLUG[f.slug];
              return (
                <Reveal key={f.titulo} variant="up" delay={i * 0.05}>
                  <Link
                    to={`/${f.slug}`}
                    className="group flex h-full flex-col rounded-[20px] bg-card-brand-soft p-7 transition-colors hover:bg-card-brand-soft/80"
                  >
                    <p className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">
                      <span className={`h-1.5 w-1.5 rounded-full ${m.cor.strong}`} />
                      {m.nome}
                    </p>
                    <h3 className="mb-2 text-[19px] font-medium leading-snug text-ink">{f.titulo}</h3>
                    <p className="mb-5 flex-1 text-[14px] leading-relaxed text-ink-soft">{f.texto}</p>
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
                      Ver o módulo{" "}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-20">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          <Reveal variant="up">
            <div className="h-full rounded-[20px] border border-paper-border/80 p-7">
              <h2 className="mb-4 text-[20px] font-medium text-ink">Para quem é</h2>
              <ul className="flex flex-col gap-3">
                {p.paraQuem.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-modulo-gestao-strong" strokeWidth={2.4} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal variant="up" delay={0.06}>
            <div className="h-full rounded-[20px] border border-paper-border/80 p-7">
              <h2 className="mb-4 text-[20px] font-medium text-ink">O que a Pilar não é</h2>
              <ul className="flex flex-col gap-3">
                {p.naoE.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-muted">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted/60" strokeWidth={2.2} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {artigos.length > 0 && (
        <section className="bg-paper px-5 pb-16 md:px-10 md:pb-20">
          <div className="mx-auto max-w-6xl">
            <Reveal variant="up" className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-[32px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[850px]:text-[25px]">
                Para ler <span className="italic text-ink/45">antes de decidir</span>
              </h2>
              <Link
                to="/blog"
                className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink hover:text-ink/70"
              >
                Todos os artigos <ArrowRight className="h-4 w-4" />
              </Link>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-3">
              {artigos.map((a) => (
                <Link
                  key={a.slug}
                  to={`/blog/${a.slug}`}
                  className="group flex h-full flex-col rounded-[20px] border border-paper-border/80 p-6 transition-colors hover:border-ink/25"
                >
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink/50">{a.categoria}</p>
                  <h3 className="mb-3 text-[16.5px] font-medium leading-snug text-ink">{a.titulo}</h3>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
                    Ler <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto max-w-5xl">
          <Reveal variant="up" className="mb-8 max-w-2xl">
            <h2 className="text-[32px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[850px]:text-[25px]">
              Perguntas frequentes
            </h2>
          </Reveal>
          <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {p.faq.map((f, i) => (
              <Reveal key={f.pergunta} variant="up" delay={i * 0.05}>
                <h3 className="mb-1.5 text-[14.5px] font-medium text-ink">{f.pergunta}</h3>
                <p className="text-[13px] leading-relaxed text-ink-muted">{f.resposta}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
