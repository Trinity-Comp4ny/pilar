import { Check, X } from "lucide-react";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { COMPARATIVOS_POR_SLUG, type ComparativoSlug } from "../lib/comparativos";
import { useJsonLd, usePageMeta } from "../lib/seo";
import { CTASection } from "../components/CTASection";
import { HeroBackdrop } from "../components/hero/HeroBackdrop";
import { Reveal } from "../components/Reveal";
import { SplitButton } from "../components/ui/SplitButton";

const WHATSAPP = "https://wa.me/5514998721100";

/**
 * Página "Pilar vs X". Mesmo esqueleto das páginas de módulo (hero com a
 * paisagem, FAQ antes do fecho, mesma CTASection final), com uma tabela de
 * comparação no lugar dos grupos de funcionalidade: aqui o visitante já sabe
 * o que usa hoje, quer ver a diferença lado a lado.
 */
export function ComparativoPage({ slug }: { slug: ComparativoSlug }) {
  const c = COMPARATIVOS_POR_SLUG[slug];

  usePageMeta({
    titulo: `Pilar vs ${c.adversario} | Pilar`,
    descricao: c.lede,
    caminho: `/vs/${slug}`,
  });

  useJsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.map((f) => ({
      "@type": "Question",
      name: f.pergunta,
      acceptedAnswer: { "@type": "Answer", text: f.resposta },
    })),
  });

  return (
    <>
      <section className="relative isolate overflow-hidden px-5 pb-14 pt-24 md:px-10 md:pb-20 md:pt-32">
        <HeroBackdrop />
        <div className="relative z-10 mx-auto max-w-6xl">
          <Reveal variant="up" className="max-w-3xl">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ink/50">
              Pilar vs {c.adversario}
            </p>
            <h1 className="mb-5 text-[52px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[40px] max-[850px]:text-[30px] max-[420px]:text-[25px]">
              {c.headline} <span className="italic text-ink/45">{c.headlineFim}</span>
            </h1>
            <p className="mb-8 max-w-xl text-[15px] leading-relaxed text-ink-soft md:text-[16px]">{c.lede}</p>

            <div className="flex flex-wrap gap-3">
              <SplitButton href={`${APP_URL}/cadastro`} onClick={() => trackCta("testar_gratis", `vs_${slug}`)}>
                Testar grátis
              </SplitButton>
              <SplitButton fantasma href={WHATSAPP} onClick={() => trackCta("agende_demo", `vs_${slug}`)}>
                Agende uma demo
              </SplitButton>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-paper px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal variant="up" className="mb-10 max-w-2xl">
            <h2 className="text-[36px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[30px] max-[850px]:text-[25px]">
              Lado a lado
            </h2>
          </Reveal>

          <Reveal variant="up" delay={0.08}>
            <div className="overflow-hidden rounded-[22px] border border-paper-border/80">
              <div className="grid grid-cols-[1.3fr_1fr_1fr] bg-paper-alt text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted">
                <div className="px-4 py-3 md:px-6">Critério</div>
                <div className="px-4 py-3 md:px-6">{c.adversario}</div>
                <div className="bg-card-brand-soft px-4 py-3 text-ink md:px-6">Pilar</div>
              </div>

              {c.linhas.map((l, i) => (
                <div
                  key={l.criterio}
                  className={`grid grid-cols-[1.3fr_1fr_1fr] ${i % 2 === 1 ? "bg-paper-alt/40" : ""}`}
                >
                  <div className="px-4 py-4 text-[13.5px] font-medium text-ink md:px-6">{l.criterio}</div>
                  <div className="flex items-start gap-2 px-4 py-4 text-[12.5px] leading-snug text-ink-muted md:px-6">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted/60" strokeWidth={2.2} />
                    <span>{l.alternativa || "Não tem."}</span>
                  </div>
                  <div className="flex items-start gap-2 bg-card-brand-soft/50 px-4 py-4 text-[12.5px] leading-snug text-ink md:px-6">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-modulo-gestao-strong" strokeWidth={2.4} />
                    <span>{l.pilar}</span>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto max-w-5xl">
          <Reveal variant="up" className="mb-8 max-w-2xl">
            <h2 className="text-[32px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[850px]:text-[25px]">
              Quando vale <span className="italic text-ink/45">a pena migrar</span>
            </h2>
          </Reveal>

          <div className="grid gap-4 md:grid-cols-3">
            {c.quandoMigrar.map((texto, i) => (
              <Reveal key={texto} variant="up" delay={i * 0.06}>
                <div className="h-full rounded-[20px] bg-card-brand-soft p-6">
                  <p className="text-[13.5px] leading-relaxed text-ink">{texto}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto max-w-5xl">
          <Reveal variant="up" className="mb-8 max-w-2xl">
            <h2 className="text-[32px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[850px]:text-[25px]">
              Antes de migrar
            </h2>
          </Reveal>

          <div className="grid gap-x-10 gap-y-7 sm:grid-cols-3">
            {c.faq.map((f, i) => (
              <Reveal key={f.pergunta} variant="up" delay={i * 0.06}>
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
