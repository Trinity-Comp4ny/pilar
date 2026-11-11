import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { limparCookies, prepararAmbiente } from "./test/ambiente";
import { MODULOS } from "./lib/modules";
import { COMPARATIVOS } from "./lib/comparativos";
import App from "./App";

vi.mock("./analytics", () => ({ trackCta: vi.fn(), applyCookieConsent: vi.fn(), initAnalytics: vi.fn() }));

beforeAll(() => prepararAmbiente());
beforeEach(() => {
  limparCookies();
  document.head.innerHTML = `<meta name="robots" content="index, follow" /><link rel="canonical" href="https://www.pilarsoft.com.br/" />`;
});

function abrir(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App />
    </MemoryRouter>
  );
}

/** O h1 da página (as lazy chegam depois do primeiro render). */
const tituloDaPagina = () => screen.findByRole("heading", { level: 1 }, { timeout: 5000 });

describe("roteamento da landing", () => {
  const rotas: [string, RegExp][] = [
    ["/", /Gestão com agentes de IA para escritórios de engenharia e arquitetura/],
    ...MODULOS.map((m): [string, RegExp] => [`/${m.slug}`, new RegExp(m.seo.h1)]),
    ...COMPARATIVOS.map((c): [string, RegExp] => [`/vs/${c.slug}`, new RegExp(c.seo.h1)]),
    ["/engenharia", /Software de gestão para escritório de engenharia/],
    ["/arquitetura", /Sistema de gestão para escritório de arquitetura/],
    ["/blog", /Blog de gestão para escritórios/],
    ["/blog/diario-de-obra-rdo", /Diário de obra/],
    ["/ferramentas", /Ferramentas para escritório/],
    ["/ferramentas/calculadora-de-honorarios", /Calculadora de honorários/],
    ["/ferramentas/modelo-de-proposta", /Modelo de proposta de projeto/],
    ["/faq", /Perguntas frequentes/],
    ["/planos", /Preço do software de gestão/],
    ["/termos", /Termos de Uso/],
    ["/privacidade", /Política de Privacidade/],
  ];

  it.each(rotas)("%s abre a própria página, com header, footer e banner de cookies", async (rota, titulo) => {
    abrir(rota);
    expect(await tituloDaPagina()).toHaveTextContent(titulo);
    expect(screen.queryByText("Página não encontrada")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pilar, página inicial" })).toBeInTheDocument();
    expect(screen.getByText(/Todos os direitos reservados/)).toBeInTheDocument();
    expect(screen.getByText(/Usamos cookies essenciais/)).toBeInTheDocument();
  });

  it.each(["/nao-existe", "/gestao/123", "/vs/excel", "/planos/anual", "/obras", "/blog/nao-existe"])(
    "%s cai no 404 em vez de um main vazio",
    async (rota) => {
      abrir(rota);
      expect(await tituloDaPagina()).toHaveTextContent("Página não encontrada");
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, follow");
    }
  );

  it("navegar pelo rodapé troca a página e volta o scroll ao topo", async () => {
    abrir("/faq");
    await tituloDaPagina();
    vi.mocked(window.scrollTo).mockClear();

    await userEvent.click(screen.getByRole("link", { name: "Termos de uso" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Termos de Uso" })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    expect(document.title).toMatch(/Termos/);
  });

  it("desliga a restauração automática de scroll do navegador", async () => {
    // O jsdom não implementa a propriedade; o navegador começa em "auto".
    Object.defineProperty(window.history, "scrollRestoration", { value: "auto", writable: true, configurable: true });
    abrir("/");
    await tituloDaPagina();
    expect(window.history.scrollRestoration).toBe("manual");
  });
});
