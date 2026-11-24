import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { CTASection } from "../components/CTASection";
import { HeroBackdrop } from "../components/hero/HeroBackdrop";
import { Reveal } from "../components/Reveal";
import { COLUNAS_MENU } from "../lib/navegacao";
import { MidiaProduto } from "../components/MidiaProduto";
import { MIDIAS_PRODUTO } from "../lib/midiasProduto";
import { Link } from "react-router-dom";
import { GroupMock } from "../components/mock/ModuleScreens";
import { BotoesCta } from "../components/BotoesCta";
import { FluxoDemonstrativo } from "../components/FluxoDemonstrativo";
import { AREAS, PAGINAS_RECURSO, caminhoRecurso } from "../lib/catalogo";
import { usePageMeta } from "../lib/seo";

const h1Grande =
  "text-[58px] font-medium leading-[1.06] tracking-[-0.035em] text-ink max-[1100px]:text-[44px] max-[850px]:text-[32px] max-[420px]:text-[27px]";
const h2Grande =
  "text-[40px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[34px] max-[850px]:text-[27px] max-[420px]:text-[24px]";

const corDaArea = (id: string) => COLUNAS_MENU.find((c) => c.id === id)?.corStrong ?? "bg-brand";

/** Abertura das páginas do catálogo: a mesma paisagem das páginas de módulo. */
function Abertura({ children }: { children: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden px-5 pb-12 pt-24 md:px-10 md:pb-16 md:pt-32">
      <HeroBackdrop />
      <div className="relative z-10 mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function Catalogo() {
  usePageMeta({
    titulo: "Funcionalidades do software de gestão Pilar",
    descricao:
      "Explore propostas, financeiro, projetos por disciplina, diário de obra, Portal do Cliente, Pilar Campo e agentes de IA.",
    caminho: "/funcionalidades",
  });
  const areas = AREAS;
  const total = PAGINAS_RECURSO.length;
  return (
    <>
      <Abertura>
        <Reveal variant="up" className="max-w-3xl">
          <h1 className={`mb-5 ${h1Grande}`}>
            Funcionalidades <span className="italic text-ink/45">da Pilar.</span>
          </h1>
          <p className="mb-6 max-w-xl text-[15px] leading-relaxed text-ink-soft md:text-[16px]">
            Explore as ferramentas do escritório, do canteiro e do cliente. São {AREAS.length} áreas e {total} páginas
            de recurso, cada uma com passo a passo e captura da tela.
          </p>
          <BotoesCta local="catalogo" />
        </Reveal>
      </Abertura>

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => (
              <article key={area.id} className="flex flex-col rounded-[22px] border border-paper-border bg-white p-6">
                <Link to={area.href} className="group mb-1 flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${corDaArea(area.id)}`} />
                  <h2 className="text-[22px] font-medium tracking-[-0.02em] text-ink">{area.titulo}</h2>
                  <ArrowRight
                    className="h-4 w-4 text-ink opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                    strokeWidth={1.9}
                  />
                </Link>
                <p className="mb-5 text-[13.5px] leading-relaxed text-ink-muted">{area.resumo}</p>
                <ul className="mb-6 flex flex-col gap-2.5">
                  {area.recursos.map((r) => (
                    <li key={r} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-ink">
                      <span className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand">
                        <Check className="h-3 w-3 text-ink" strokeWidth={2.6} />
                      </span>
                      {r}
                    </li>
                  ))}
                </ul>
                <RecursosDaArea area={area.id} />
              </article>
            ))}
          </div>
        </div>
      </section>
      <CTASection />
    </>
  );
}

function RecursosDaArea({ area }: { area: string }) {
  const paginas = PAGINAS_RECURSO.filter((pagina) => pagina.area === area);
  if (!paginas.length) return null;
  return (
    <div className="mt-auto border-t border-paper-border pt-4">
      <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-muted">Páginas de recurso</p>
      <ul>
        {paginas.map((pagina) => (
          <li key={pagina.slug}>
            <Link
              className="group flex items-center justify-between gap-3 rounded-[10px] px-2 py-2 text-[13.5px] text-ink transition-colors hover:bg-card-brand-soft"
              to={caminhoRecurso(pagina.slug)}
            >
              {pagina.titulo}
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 text-ink/35 transition-all group-hover:translate-x-0.5 group-hover:text-ink"
                strokeWidth={1.9}
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecursoPage({ slug }: { slug: (typeof PAGINAS_RECURSO)[number]["slug"] }) {
  const pagina = PAGINAS_RECURSO.find((item) => item.slug === slug)!;
  const area = AREAS.find((item) => item.id === pagina.area)!;
  const midia = MIDIAS_PRODUTO[slug];
  const relacionado =
    "relacionado" in pagina ? PAGINAS_RECURSO.find((item) => item.slug === pagina.relacionado) : undefined;
  const irmas = PAGINAS_RECURSO.filter((p) => p.area === pagina.area && p.slug !== slug);
  usePageMeta({ titulo: pagina.titulo, descricao: pagina.descricao, caminho: caminhoRecurso(slug) });
  const temMidia = Boolean(midia) || "mock" in pagina;
  return (
    <article>
      <Abertura>
        <Reveal variant="up" className="mb-8">
          <nav aria-label="Localização" className="flex flex-wrap items-center gap-2 text-[13px]">
            <Link
              className="rounded-full border border-ink/15 bg-white/70 px-3.5 py-1.5 text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
              to="/funcionalidades"
            >
              Funcionalidades
            </Link>
            <span aria-hidden="true" className="text-ink/35">
              /
            </span>
            <Link
              className="flex items-center gap-2 rounded-full border border-ink/15 bg-white/70 px-3.5 py-1.5 text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
              to={area.href}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${corDaArea(area.id)}`} />
              {area.titulo}
            </Link>
          </nav>
        </Reveal>

        <div className={`grid items-center gap-10 ${temMidia ? "lg:grid-cols-[1fr_1.05fr] lg:gap-14" : ""}`}>
          <Reveal variant="up" className="min-w-0">
            <h1 className={`mb-5 ${h1Grande}`}>{pagina.titulo}</h1>
            <p className="mb-8 max-w-xl text-[15px] leading-relaxed text-ink-soft md:text-[16px]">{pagina.descricao}</p>
            <BotoesCta local={`recurso_${slug}`} />
          </Reveal>
          {temMidia ? (
            <Reveal variant="right" delay={0.1} className="min-w-0">
              {midia ? (
                <MidiaProduto midia={midia} />
              ) : (
                "mock" in pagina && (
                  <figure className="min-w-0 overflow-x-auto rounded-[22px] border border-paper-border bg-white p-4">
                    <GroupMock mock={pagina.mock} />
                    <figcaption className="mt-3 text-sm text-ink-muted">Ilustração com dados de exemplo.</figcaption>
                  </figure>
                )
              )}
            </Reveal>
          ) : null}
        </div>
      </Abertura>

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <Reveal variant="up" className="mb-8 max-w-2xl">
            <h2 className={h2Grande}>
              Como <span className="italic text-ink/45">funciona.</span>
            </h2>
          </Reveal>
          <ol className="grid gap-4 md:grid-cols-3">
            {pagina.passos.map((passo, i) => (
              <li key={passo} className="rounded-[22px] bg-card-brand-soft p-6">
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[14px] font-medium tabular-nums text-ink">
                  {i + 1}
                </span>
                <p className="text-[14.5px] leading-relaxed text-ink">{passo}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Atalho to={pagina.guia} rotulo="Leia o guia" />
            {"ferramenta" in pagina && <Atalho to={pagina.ferramenta} rotulo="Use o modelo de proposta" />}
            {relacionado && (
              <Atalho to={caminhoRecurso(relacionado.slug)} rotulo={relacionado.titulo} sub="Relacionado" />
            )}
          </div>
        </div>
      </section>

      {irmas.length > 0 && (
        <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
          <div className="mx-auto max-w-6xl">
            <Reveal variant="up" className="mb-8 max-w-2xl">
              <h2 className={h2Grande}>
                Mais em <span className="italic text-ink/45">{area.titulo}.</span>
              </h2>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {irmas.map((p) => (
                <Atalho key={p.slug} to={caminhoRecurso(p.slug)} rotulo={p.titulo} sub={p.descricao} />
              ))}
            </div>
          </div>
        </section>
      )}
      <CTASection />
    </article>
  );
}

function Atalho({ to, rotulo, sub }: { to: string; rotulo: string; sub?: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start justify-between gap-4 rounded-[20px] border border-paper-border bg-white p-5 transition-colors hover:border-ink/30"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-ink">{rotulo}</span>
        {sub ? <span className="mt-1 line-clamp-2 block text-[12.5px] leading-snug text-ink-muted">{sub}</span> : null}
      </span>
      <ArrowRight
        className="mt-0.5 h-4 w-4 shrink-0 text-ink/40 transition-all group-hover:translate-x-0.5 group-hover:text-ink"
        strokeWidth={1.9}
      />
    </Link>
  );
}

export function AgentesPage() {
  usePageMeta({
    titulo: "Agentes de IA para escritórios de engenharia",
    descricao: "Veja como preparar lançamentos em linguagem natural, conferir os dados e aprovar a ação na Pilar.",
    caminho: "/funcionalidades/agentes",
  });
  return (
    <article>
      <Abertura>
        <Reveal variant="up" className="max-w-3xl">
          <Link
            to="/funcionalidades"
            className="mb-6 inline-block rounded-full border border-ink/15 bg-white/70 px-3.5 py-1.5 text-[13px] text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
          >
            Todas as funcionalidades
          </Link>
          <h1 className={`mb-5 ${h1Grande}`}>
            Agentes de IA <span className="italic text-ink/45">para escritórios de engenharia.</span>
          </h1>
          <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft md:text-[16px]">
            Descreva o que aconteceu, confira o rascunho e confirme o lançamento quando estiver certo.
          </p>
        </Reveal>
      </Abertura>
      <div className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <FluxoDemonstrativo tipo="agente" />
          {MIDIAS_PRODUTO.agentes && <MidiaProduto midia={MIDIAS_PRODUTO.agentes} />}
          {MIDIAS_PRODUTO["agente-confirmacao"] && (
            <section className="mt-8">
              <h2 className="mb-4 text-2xl font-medium text-ink">Veja a revisão e confirmação de uma receita</h2>
              <MidiaProduto midia={MIDIAS_PRODUTO["agente-confirmacao"]} />
            </section>
          )}
          <BotoesCta local="pagina_agentes" className="mt-8" />
        </div>
      </div>
      <CTASection />
    </article>
  );
}
