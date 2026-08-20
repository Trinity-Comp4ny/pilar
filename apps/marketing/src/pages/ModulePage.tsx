import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { BrowserFrame } from "../components/BrowserFrame";
import { ModuleScreen } from "../components/mock/ModuleScreens";
import { Reveal } from "../components/Reveal";
import { MODULOS_POR_SLUG, type ModuloSlug } from "../lib/modules";

const WHATSAPP = "https://wa.me/5514998721100";

/** Página de um módulo. O conteúdo todo vem de `lib/modules.ts`. */
export function ModulePage({ slug }: { slug: ModuloSlug }) {
  const modulo = MODULOS_POR_SLUG[slug];

  useEffect(() => {
    document.title = `${modulo.nome} | Pilar`;
  }, [modulo.nome]);

  const primario =
    modulo.ctaPrimario.tipo === "cadastro"
      ? { href: `${APP_URL}/cadastro`, externo: false }
      : { href: WHATSAPP, externo: true };

  return (
    <>
      <section className="pt-16 pb-16 md:pt-24 md:pb-20">
        <div className="container mx-auto px-6 md:px-10">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div>
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-[0.14em] mb-5 ${modulo.cor.fill} text-ink`}
              >
                <span className={`w-1.5 h-1.5 rounded-sm ${modulo.cor.strong}`} />
                {modulo.numero}
              </span>

              <h1 className="text-[clamp(30px,4.4vw,48px)] font-medium tracking-[-0.032em] text-ink leading-[1.06] mb-4">
                {modulo.headline}
              </h1>
              <p className="text-base md:text-lg text-ink-soft font-light leading-relaxed mb-7 max-w-lg">
                {modulo.lede}
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={primario.href}
                  {...(primario.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  onClick={() =>
                    trackCta(
                      modulo.ctaPrimario.tipo === "cadastro" ? "testar_gratis" : "falar_conosco",
                      `modulo_${slug}`
                    )
                  }
                  className="px-7 py-3.5 bg-ink-soft text-white rounded-full font-medium text-sm hover:bg-ink transition-colors inline-flex items-center justify-center gap-2 group"
                >
                  {modulo.ctaPrimario.label}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackCta("agende_demo", `modulo_${slug}`)}
                  className="px-7 py-3.5 rounded-full font-medium text-sm text-ink-soft border border-paper-border hover:bg-paper-alt transition-colors inline-flex items-center justify-center"
                >
                  Agende uma demo
                </a>
              </div>
            </div>

            <BrowserFrame url={modulo.url}>
              <div className="px-5 py-4 text-left min-h-[240px]">
                <ModuleScreen slug={slug} />
              </div>
            </BrowserFrame>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 bg-paper-alt border-t border-paper-border">
        <div className="container mx-auto px-6 md:px-10">
          <div className="max-w-5xl mx-auto">
            <Reveal className="mb-12">
              <p className={`text-[10px] uppercase tracking-[0.14em] font-medium mb-4 ${modulo.cor.text}`}>
                O que tem dentro
              </p>
              <h2 className="text-2xl md:text-4xl font-medium text-ink leading-[1.1] tracking-tight">
                Tudo isto já roda hoje.
              </h2>
            </Reveal>

            <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
              {modulo.features.map((f, i) => (
                <Reveal key={f.titulo} delay={(i % 2) * 0.06}>
                  <h3 className="flex items-center gap-2 text-[15px] font-medium text-ink mb-1.5">
                    <Check className={`w-4 h-4 shrink-0 ${modulo.cor.text}`} strokeWidth={2.2} />
                    {f.titulo}
                  </h3>
                  <p className="text-[13.5px] text-ink-muted font-light leading-relaxed pl-6">{f.texto}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 bg-paper">
        <div className="container mx-auto px-6 md:px-10">
          <div className="max-w-5xl mx-auto">
            <Reveal className="mb-8">
              <p className="text-[10px] uppercase tracking-[0.14em] font-medium text-ink-muted mb-4">Conecta com</p>
              <h2 className="text-2xl md:text-3xl font-medium text-ink leading-[1.1] tracking-tight">
                Nada disso termina aqui.
              </h2>
            </Reveal>

            <div className="grid md:grid-cols-2 gap-4">
              {modulo.conecta.map((c) => {
                const outro = MODULOS_POR_SLUG[c.slug];
                return (
                  <Reveal key={c.slug}>
                    <Link
                      to={`/${outro.slug}`}
                      className="flex gap-3 items-start p-5 rounded-xl border border-paper-border/60 bg-white hover:border-paper-border transition-colors group"
                    >
                      <span className={`w-8 h-8 rounded-lg shrink-0 ${outro.cor.fill}`} />
                      <span>
                        <span className="flex items-center gap-1.5 text-[14px] font-medium text-ink mb-1">
                          {outro.nome}
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                        <span className="block text-[12.5px] text-ink-muted font-light leading-relaxed">{c.texto}</span>
                      </span>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
