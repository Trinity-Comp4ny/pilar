import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { CTASection } from "../components/CTASection";
import { HeroBackdrop } from "../components/hero/HeroBackdrop";
import { Reveal } from "../components/Reveal";
import { ARTIGOS, dataPorExtenso, type CategoriaBlog } from "../lib/blog";
import { useJsonLd, usePageMeta } from "../lib/seo";

const BASE = "https://www.pilarsoft.com.br";
const FILTROS: ("Todos" | CategoriaBlog)[] = ["Todos", "Gestão", "Projetos", "Obra", "Financeiro"];

/**
 * Listagem do blog. O artigo mais recente abre em destaque; o resto em grade.
 * O filtro por categoria é só de tela (o HTML pré-renderizado traz todos os
 * artigos, que é o que o Google precisa para descobrir cada um).
 */
export function Blog() {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("Todos");

  usePageMeta({
    titulo: "Blog: gestão de escritório de engenharia e arquitetura | Pilar",
    descricao:
      "Guias práticos para sócios de escritórios de engenharia e arquitetura: proposta, preço de projeto, prazo, aditivo, diário de obra e financeiro.",
    caminho: "/blog",
  });

  useJsonLd({
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blog do Pilar",
    url: `${BASE}/blog`,
    inLanguage: "pt-BR",
    publisher: { "@type": "Organization", name: "Pilar", url: `${BASE}/` },
    blogPost: ARTIGOS.map((a) => ({
      "@type": "BlogPosting",
      headline: a.titulo,
      url: `${BASE}/blog/${a.slug}`,
      datePublished: a.publicadoEm,
      dateModified: a.atualizadoEm,
    })),
  });

  const categoriasComArtigo = FILTROS.filter((f) => f === "Todos" || ARTIGOS.some((a) => a.categoria === f));
  const lista = filtro === "Todos" ? ARTIGOS : ARTIGOS.filter((a) => a.categoria === filtro);
  const [destaque, ...demais] = lista;

  return (
    <>
      <section className="relative isolate overflow-hidden px-5 pb-12 pt-24 md:px-10 md:pb-16 md:pt-32">
        <HeroBackdrop />
        <div className="relative z-10 mx-auto max-w-6xl">
          <Reveal variant="up" className="max-w-3xl">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ink/50">Blog do Pilar</p>
            <h1 className="mb-5 text-[52px] font-medium leading-[1.08] tracking-[-0.035em] text-ink max-[1100px]:text-[40px] max-[850px]:text-[30px] max-[420px]:text-[25px]">
              Blog de gestão para escritórios de <span className="italic text-ink/45">engenharia e arquitetura.</span>
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft md:text-[16px]">
              Proposta, preço de projeto, prazo por disciplina, aditivo, diário de obra e financeiro. O que funciona no
              dia a dia de quem vende projeto técnico.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-paper px-5 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto max-w-6xl">
          {categoriasComArtigo.length > 2 && (
            <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
              {categoriasComArtigo.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltro(f)}
                  aria-pressed={filtro === f}
                  className={`rounded-full border px-4 py-1.5 text-[13px] transition-colors ${
                    filtro === f
                      ? "border-ink bg-ink text-paper"
                      : "border-paper-border text-ink-soft hover:border-ink/40 hover:text-ink"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {destaque && (
            <Link
              to={`/blog/${destaque.slug}`}
              className="group mb-6 grid gap-6 rounded-[24px] bg-card-brand-soft p-7 transition-colors hover:bg-card-brand-soft/80 md:grid-cols-[1.4fr_1fr] md:p-10"
            >
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">
                  {destaque.categoria} · {destaque.minutosLeitura} min de leitura
                </p>
                <h2 className="mb-4 text-[30px] font-medium leading-[1.12] tracking-[-0.03em] text-ink max-[850px]:text-[24px]">
                  {destaque.titulo}
                </h2>
                <p className="text-[15px] leading-relaxed text-ink-soft">{destaque.resumo}</p>
              </div>
              <div className="flex items-end justify-between gap-4 md:flex-col md:items-end">
                <p className="text-[12.5px] text-ink-muted">{dataPorExtenso(destaque.publicadoEm)}</p>
                <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                  Ler artigo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          )}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {demais.map((a) => (
              <Link
                key={a.slug}
                to={`/blog/${a.slug}`}
                className="group flex h-full flex-col rounded-[20px] border border-paper-border/80 bg-paper p-6 transition-colors hover:border-ink/25"
              >
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink/50">
                  {a.categoria} · {a.minutosLeitura} min
                </p>
                <h2 className="mb-3 text-[18px] font-medium leading-snug tracking-[-0.01em] text-ink">{a.titulo}</h2>
                <p className="mb-5 flex-1 text-[13.5px] leading-relaxed text-ink-muted">{a.resumo}</p>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
                  Ler <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>

          {lista.length === 0 && (
            <p className="text-[14px] text-ink-muted">Ainda não há artigo nesta categoria. Veja as outras acima.</p>
          )}
        </div>
      </section>

      <CTASection />
    </>
  );
}
