import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { BrowserFrame } from "../components/BrowserFrame";
import { CTASection } from "../components/CTASection";
import { HeroBackdrop } from "../components/hero/HeroBackdrop";
import { CampoScreen, ModuleScreen } from "../components/mock/ModuleScreens";
import { Reveal } from "../components/Reveal";
import { SplitButton } from "../components/ui/SplitButton";
import { MODULOS_POR_SLUG, type ModuloSlug } from "../lib/modules";

const WHATSAPP = "https://wa.me/5514998721100";

/**
 * Página de um módulo. O conteúdo vem de `lib/modules.ts`; o desenho segue a
 * home redesenhada: paisagem no hero, headline com o fim em itálico apagado,
 * tela de produto grande logo abaixo (browser nos módulos de escritório,
 * celular no Campo), features em cartões e o mesmo fecho da home.
 */
export function ModulePage({ slug }: { slug: ModuloSlug }) {
  const modulo = MODULOS_POR_SLUG[slug];

  useEffect(() => {
    document.title = `${modulo.nome} | Pilar`;
  }, [modulo.nome]);

  const primario =
    modulo.ctaPrimario.tipo === "cadastro"
      ? { href: `${APP_URL}/cadastro`, evento: "testar_gratis" }
      : { href: WHATSAPP, evento: "falar_conosco" };

  return (
    <>
      <section className="relative isolate overflow-hidden px-5 pb-14 pt-24 md:px-10 md:pb-20 md:pt-28">
        <HeroBackdrop />

        <div className="relative z-10 mx-auto max-w-6xl">
          <Reveal variant="down" className="mb-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.9} />
              Voltar para a home
            </Link>
          </Reveal>

          <Reveal variant="up" className="max-w-3xl">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-frame/80 px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink/70 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <span className={`h-1.5 w-1.5 rounded-full ${modulo.cor.strong}`} />
              {modulo.numero}
            </span>

            <h1 className="mb-5 text-[58px] font-medium leading-[1.06] tracking-[-0.035em] text-ink max-[1100px]:text-[44px] max-[850px]:text-[32px] max-[420px]:text-[27px]">
              {modulo.headline} <span className="italic text-ink/45">{modulo.headlineFim}</span>
            </h1>
            <p className="mb-8 max-w-xl text-[15px] leading-relaxed text-ink-soft md:text-[16px]">{modulo.lede}</p>

            <div className="flex flex-wrap gap-3">
              <SplitButton href={primario.href} onClick={() => trackCta(primario.evento, `modulo_${slug}`)}>
                {modulo.ctaPrimario.label}
              </SplitButton>
              <SplitButton fantasma href={WHATSAPP} onClick={() => trackCta("agende_demo", `modulo_${slug}`)}>
                Agende uma demo
              </SplitButton>
            </div>
          </Reveal>

          {/* A tela de produto, grande e central: é o "print" da página.
              Campo é um app de celular, então ganha o aparelho, não o browser. */}
          <Reveal variant="scale" delay={0.15} loose className="mt-12 md:mt-16">
            {slug === "campo" ? (
              <CampoScreen />
            ) : (
              <BrowserFrame url={modulo.url} className="mx-auto max-w-4xl">
                <div className="p-5 md:p-7">
                  <ModuleScreen slug={slug} />
                </div>
              </BrowserFrame>
            )}
          </Reveal>
        </div>
      </section>

      <section className="bg-paper px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal variant="up" className="mb-10 max-w-2xl">
            <h2 className="text-[40px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[34px] max-[850px]:text-[27px] max-[420px]:text-[24px]">
              Tudo isto <span className="italic text-ink/45">já roda hoje.</span>
            </h2>
          </Reveal>

          {/* As duas primeiras features de cada módulo são as que vendem; a
              lavagem verde faz esse ranking sem precisar dizer "principal". */}
          <div className="grid gap-4 md:grid-cols-2">
            {modulo.features.map((f, i) => (
              <Reveal key={f.titulo} variant="up" delay={(i % 2) * 0.06} className="h-full">
                <div
                  className={`h-full rounded-[22px] p-6 ${
                    i < 2 ? "bg-card-brand-soft" : "border border-paper-border/80 bg-frame"
                  }`}
                >
                  <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-brand">
                    <Check className="h-4 w-4 text-ink" strokeWidth={2.2} />
                  </span>
                  <h3 className="mb-1.5 text-[16px] font-medium text-ink">{f.titulo}</h3>
                  <p className="text-[13px] leading-relaxed text-ink-muted">{f.texto}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <Reveal variant="up" className="mb-8 max-w-2xl">
            <h2 className="text-[40px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[34px] max-[850px]:text-[27px] max-[420px]:text-[24px]">
              Nada disso <span className="italic text-ink/45">termina aqui.</span>
            </h2>
          </Reveal>

          <div className="grid gap-4 md:grid-cols-2">
            {modulo.conecta.map((c) => {
              const outro = MODULOS_POR_SLUG[c.slug];
              return (
                <Reveal key={c.slug} variant="up" className="h-full">
                  <Link
                    to={`/${outro.slug}`}
                    className="group flex h-full items-start justify-between gap-4 rounded-[22px] bg-card-brand-soft p-6 transition-colors hover:bg-card-brand"
                  >
                    <span>
                      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-ink/50">
                        {outro.numero}
                      </span>
                      <span className="mb-1.5 block text-[17px] font-medium text-ink">{outro.nome}</span>
                      <span className="block text-[13px] leading-relaxed text-ink/65">{c.texto}</span>
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
