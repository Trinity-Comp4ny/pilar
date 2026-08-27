import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { BrowserFrame } from "../components/BrowserFrame";
import { CTASection } from "../components/CTASection";
import { CampoScreen, ModuleScreen } from "../components/mock/ModuleScreens";
import { Reveal } from "../components/Reveal";
import { SplitButton } from "../components/ui/SplitButton";
import { MODULOS, MODULOS_POR_SLUG, type Modulo, type ModuloSlug } from "../lib/modules";

const WHATSAPP = "https://wa.me/5514998721100";

/**
 * Print real da tela, com rede de segurança: enquanto o PNG não existe em
 * public/screens, o onError derruba pro desenho vetorial do módulo, então a
 * página nunca mostra imagem quebrada. Solte o arquivo no caminho declarado
 * em `modules.ts` e o print assume sem mexer em código.
 */
function PrintReal({ img, alt, modulo }: { img: string; alt: string; modulo: Modulo }) {
  const [caiu, setCaiu] = useState(false);

  if (caiu) {
    if (modulo.slug === "campo") return <CampoScreen />;
    return (
      <BrowserFrame url={modulo.url}>
        <div className="p-5 md:p-6">
          <ModuleScreen slug={modulo.slug} />
        </div>
      </BrowserFrame>
    );
  }

  if (modulo.slug === "campo") {
    return (
      <div className="mx-auto w-[300px] rounded-[36px] border-[3px] border-ink bg-ink shadow-[0_28px_56px_-20px_rgba(0,0,0,0.45)]">
        <div className="overflow-hidden rounded-[32px]">
          <img src={img} alt={alt} className="block w-full" onError={() => setCaiu(true)} />
        </div>
      </div>
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
 * home redesenhada: headline com o fim em itálico apagado, a tela do módulo
 * grande logo abaixo, funcionalidades em grupos temáticos com o print ao lado
 * (não uma lista corrida), as outras frentes no fim e o mesmo fecho da home.
 *
 * Sem paisagem animada e sem breadcrumb: quem chega aqui veio do bento ou do
 * menu, e o logo do header já volta pra home.
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

  const outras = MODULOS.filter((m) => m.slug !== slug);

  return (
    <>
      <section className="bg-paper px-5 pb-14 pt-24 md:px-10 md:pb-20 md:pt-32">
        <div className="mx-auto max-w-6xl">
          <Reveal variant="up" className="max-w-3xl">
            <p className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink/50">
              <span className={`h-1.5 w-1.5 rounded-full ${modulo.cor.strong}`} />
              {modulo.nome}
            </p>

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

          {/* A tela do módulo, grande e central. Campo é um app de celular,
              então ganha o aparelho, não o browser. */}
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
              <div key={g.titulo} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
                <Reveal variant={gi % 2 === 0 ? "left" : "right"} className={gi % 2 === 0 ? "" : "lg:order-2"}>
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
                  className={gi % 2 === 0 ? "" : "lg:order-1"}
                >
                  <PrintReal img={g.img} alt={g.titulo} modulo={modulo} />
                </Reveal>
              </div>
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
