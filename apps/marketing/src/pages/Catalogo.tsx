import { MidiaProduto } from "../components/MidiaProduto";
import { MIDIAS_PRODUTO } from "../lib/midiasProduto";
import { Link } from "react-router-dom";
import { GroupMock } from "../components/mock/ModuleScreens";
import { LinkDemo } from "../components/LinkDemo";
import { FluxoDemonstrativo } from "../components/FluxoDemonstrativo";
import { AREAS, PAGINAS_RECURSO, caminhoRecurso } from "../lib/catalogo";
import { usePageMeta } from "../lib/seo";

const largura = "mx-auto max-w-6xl px-5 py-16 md:px-10 md:py-24";
const link = "font-medium text-ink underline underline-offset-4";

export function Catalogo() {
  usePageMeta({
    titulo: "Funcionalidades do software de gestão Pilar",
    descricao:
      "Explore propostas, financeiro, projetos por disciplina, diário de obra, Portal do Cliente, Pilar Campo e agentes de IA.",
    caminho: "/funcionalidades",
  });
  return (
    <div className={largura}>
      <h1 className="text-4xl font-medium text-ink md:text-6xl">Funcionalidades da Pilar</h1>
      <p className="mt-4 max-w-2xl text-lg">Explore as ferramentas do escritório, do canteiro e do cliente.</p>
      {["Módulos", "Experiências conectadas"].map((grupo, i) => (
        <section key={grupo} className="mt-12">
          <h2 className="text-2xl font-medium text-ink">{grupo}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {AREAS.slice(i * 3, i * 3 + 3).map((area) => (
              <article key={area.id} className="rounded-2xl border border-paper-border bg-frame p-5">
                <h3 className="text-xl">
                  <Link className={link} to={area.href}>
                    {area.titulo}
                  </Link>
                </h3>
                <p className="mt-2">{area.resumo}</p>
                <ul className="mt-4 list-disc space-y-2 ps-5">
                  {area.recursos.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <RecursosDaArea area={area.id} />
              </article>
            ))}
          </div>
        </section>
      ))}
      <LinkDemo local="catalogo" className="mt-10" />
    </div>
  );
}

function RecursosDaArea({ area }: { area: string }) {
  const paginas = PAGINAS_RECURSO.filter((pagina) => pagina.area === area);
  if (!paginas.length) return null;
  return (
    <ul className="mt-5 space-y-2">
      {paginas.map((pagina) => (
        <li key={pagina.slug}>
          <Link className={link} to={caminhoRecurso(pagina.slug)}>
            {pagina.titulo}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RecursoPage({ slug }: { slug: (typeof PAGINAS_RECURSO)[number]["slug"] }) {
  const pagina = PAGINAS_RECURSO.find((item) => item.slug === slug)!;
  const area = AREAS.find((item) => item.id === pagina.area)!;
  const midia = MIDIAS_PRODUTO[slug];
  const relacionado =
    "relacionado" in pagina ? PAGINAS_RECURSO.find((item) => item.slug === pagina.relacionado) : undefined;
  usePageMeta({ titulo: pagina.titulo, descricao: pagina.descricao, caminho: caminhoRecurso(slug) });
  return (
    <article className={largura}>
      <nav aria-label="Localização" className="mb-6 flex flex-wrap gap-3">
        <Link className={link} to="/funcionalidades">
          Funcionalidades
        </Link>
        <span aria-hidden="true">/</span>
        <Link className={link} to={area.href}>
          {area.titulo}
        </Link>
      </nav>
      <h1 className="max-w-3xl text-4xl font-medium text-ink md:text-6xl">{pagina.titulo}</h1>
      <p className="mt-4 max-w-2xl text-lg">{pagina.descricao}</p>
      <div className={`mt-9 grid items-start gap-7 ${midia || "mock" in pagina ? "lg:grid-cols-2" : "max-w-3xl"}`}>
        <section>
          <h2 className="text-2xl font-medium text-ink">Como funciona</h2>
          <ol className="mt-4 list-decimal space-y-4 ps-6">
            {pagina.passos.map((passo) => (
              <li key={passo}>{passo}</li>
            ))}
          </ol>
          <p className="mt-6">
            <Link className={link} to={pagina.guia}>
              Leia o guia
            </Link>
          </p>
          {"ferramenta" in pagina && (
            <p className="mt-3">
              <Link className={link} to={pagina.ferramenta}>
                Use o modelo de proposta
              </Link>
            </p>
          )}
          {relacionado && (
            <p className="mt-3">
              <Link className={link} to={caminhoRecurso(relacionado.slug)}>
                {relacionado.titulo}
              </Link>
            </p>
          )}
          <LinkDemo local={`recurso_${slug}`} className="mt-6" />
        </section>
        {midia ? (
          <MidiaProduto midia={midia} />
        ) : (
          "mock" in pagina && (
            <figure className="min-w-0 overflow-x-auto rounded-2xl border border-paper-border bg-frame p-4">
              <GroupMock mock={pagina.mock} />
              <figcaption className="mt-3 text-sm text-ink-muted">Ilustração com dados de exemplo.</figcaption>
            </figure>
          )
        )}
      </div>
    </article>
  );
}

export function AgentesPage() {
  usePageMeta({
    titulo: "Agentes de IA para escritórios de engenharia",
    descricao: "Veja como preparar lançamentos em linguagem natural, conferir os dados e aprovar a ação na Pilar.",
    caminho: "/funcionalidades/agentes",
  });
  return (
    <article className={largura}>
      <Link className={link} to="/funcionalidades">
        Todas as funcionalidades
      </Link>
      <h1 className="mt-6 max-w-3xl text-4xl font-medium text-ink md:text-6xl">
        Agentes de IA para escritórios de engenharia
      </h1>
      <p className="mt-4 max-w-2xl text-lg">
        Descreva o que aconteceu, confira o rascunho e confirme o lançamento quando estiver certo.
      </p>
      <FluxoDemonstrativo tipo="agente" />
      {MIDIAS_PRODUTO.agentes && <MidiaProduto midia={MIDIAS_PRODUTO.agentes} />}
      <LinkDemo local="pagina_agentes" className="mt-8" />
    </article>
  );
}
