import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { matchPath } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { limparCookies, prepararAmbiente, renderNaRota } from "../test/ambiente";
import { APP_URL } from "../config";
import { DEMO_URL, WHATSAPP_COMERCIAL_URL } from "../lib/contato";
import { MODULOS } from "../lib/modules";
import { COMPARATIVOS } from "../lib/comparativos";
import { CONSENT_REVIEW_REQUESTED_EVENT } from "../cookieConsent";
import { tituloParaBusca } from "../lib/seo";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";
import { CTASection } from "./CTASection";
import { HeroSection } from "./HeroSection";
import { Home } from "../pages/Home";
import { ModulePage } from "../pages/ModulePage";
import { ComparativoPage } from "../pages/ComparativoPage";
import { Planos } from "../pages/Planos";
import { PublicoPage } from "../pages/PublicoPage";
import { NotFound } from "../pages/NotFound";

const trackCta = vi.hoisted(() => vi.fn());
vi.mock("../analytics", () => ({ trackCta, applyCookieConsent: vi.fn(), initAnalytics: vi.fn() }));

beforeAll(() => prepararAmbiente());
beforeEach(() => {
  limparCookies();
  trackCta.mockClear();
});
afterEach(limparCookies);

/** Rotas declaradas no roteador do App, lidas do código-fonte. */
const ROTAS = [
  ...readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../App.tsx"), "utf8").matchAll(
    /<Route\s+path="([^"]+)"/g
  ),
]
  .map((m) => m[1])
  .filter((p) => p !== "*");

const links = (raiz: HTMLElement) => [...raiz.querySelectorAll<HTMLAnchorElement>("a[href]")];

/** Link interno resolve para uma rota do App; externo só para destinos conhecidos. */
function confereDestinos(raiz: HTMLElement) {
  for (const a of links(raiz)) {
    const href = a.getAttribute("href")!;
    if (/^\/screens\/[a-z0-9-]+\.(png|jpg|mp4)$/.test(href)) {
      expect(existsSync(join(dirname(fileURLToPath(import.meta.url)), "../../public", href))).toBe(true);
      continue;
    }
    if (href.startsWith("/")) {
      const caminho = href.split("#")[0] || "/";
      expect(
        ROTAS.some((rota) => matchPath({ path: rota, end: true }, caminho)),
        `link "${a.textContent}" para ${href}`
      ).toBe(true);
      continue;
    }
    const conhecido = href === DEMO_URL || href.startsWith(`${APP_URL}/`) || href.startsWith("https://wa.me/");
    expect(conhecido, `link "${a.textContent}" para destino desconhecido ${href}`).toBe(true);
  }
}

/** Todo link para a demonstração sai em nova aba e sem dar `window.opener` ao Google Agenda. */
function confereDemos(raiz: HTMLElement, minimo = 1) {
  const demos = links(raiz).filter((a) => a.getAttribute("href") === DEMO_URL);
  expect(demos.length).toBeGreaterThanOrEqual(minimo);
  for (const a of demos) {
    expect(a, `"${a.textContent}"`).toHaveAttribute("target", "_blank");
    expect(a.getAttribute("rel") ?? "", `"${a.textContent}"`).toMatch(/\bnoopener\b/);
  }
}

describe("contato e config", () => {
  it("DEMO_URL é a página de agendamento em HTTPS", () => {
    expect(DEMO_URL).toMatch(/^https:\/\/calendar\.app\.google\/\w+$/);
  });

  it("APP_URL é o app em HTTPS, sem barra no fim (os links somam o caminho)", () => {
    expect(APP_URL).toBe("https://app.pilarsoft.com.br");
  });
});

describe("LandingHeader", () => {
  it("todo link resolve para uma rota da landing ou para o app/demo", () => {
    const { container } = renderNaRota(<LandingHeader />);
    confereDestinos(container);
  });

  it("lista os cinco módulos (desktop e celular) e Planos", () => {
    const { container } = renderNaRota(<LandingHeader />);
    for (const m of MODULOS) {
      // Título da coluna no desktop e linha no celular (Campo tem ainda o link do recurso).
      expect(container.querySelectorAll(`a[href="/${m.slug}"]`).length).toBeGreaterThanOrEqual(2);
    }
    // Link "Planos" e botão "Ver planos", no desktop e no celular.
    expect(container.querySelectorAll('a[href="/planos"]')).toHaveLength(4);
  });

  it("deslogado: Entrar vai para o login e o botão principal para os planos", () => {
    const { container } = renderNaRota(<LandingHeader />);
    for (const a of screen.getAllByRole("link", { name: "Entrar" })) {
      expect(a).toHaveAttribute("href", `${APP_URL}/login`);
    }
    const verPlanos = screen.getAllByRole("link", { name: /Ver planos/ });
    expect(verPlanos).toHaveLength(2);
    for (const a of verPlanos) expect(a).toHaveAttribute("href", "/planos");
    // A demonstração saiu do topo (2026-11-08): fica na hero, nos planos, no fecho e no rodapé.
    expect(links(container).filter((a) => a.getAttribute("href") === DEMO_URL)).toHaveLength(0);
  });

  it("com o hint de login, troca o Entrar por 'Abrir Pilar' e mantém o Ver planos", () => {
    document.cookie = "pilar_logged_hint=1; path=/";
    renderNaRota(<LandingHeader />);
    expect(screen.queryByRole("link", { name: /Entrar/ })).not.toBeInTheDocument();
    const abrir = screen.getAllByRole("link", { name: /Abrir Pilar/ });
    expect(abrir).toHaveLength(2);
    for (const a of abrir) expect(a).toHaveAttribute("href", `${APP_URL}/inicio`);
    expect(screen.getAllByRole("link", { name: /Ver planos/ })).toHaveLength(2);
  });

  it("hero e fecho usam o mesmo botão de acesso do header", () => {
    renderNaRota(<HeroSection />);
    expect(screen.getByRole("link", { name: /Entrar/ })).toHaveAttribute("href", `${APP_URL}/login`);
    cleanup();

    document.cookie = "pilar_logged_hint=1; path=/";
    renderNaRota(<HeroSection />);
    expect(screen.queryByRole("link", { name: /Entrar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir Pilar/ })).toHaveAttribute("href", `${APP_URL}/inicio`);
    cleanup();

    renderNaRota(<CTASection />);
    expect(screen.queryByRole("link", { name: /Entrar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir Pilar/ })).toHaveAttribute("href", `${APP_URL}/inicio`);
    expect(screen.getByRole("link", { name: /Ver planos/ })).toHaveAttribute("href", "/planos");
  });

  it("o menu Produto abre pelo teclado e fecha com Esc", async () => {
    renderNaRota(<LandingHeader />);
    const produto = screen.getByRole("button", { name: /Funcionalidades/ });
    expect(produto).toHaveAttribute("aria-expanded", "false");

    produto.focus();
    await userEvent.keyboard("{Enter}");
    expect(produto).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("{Escape}");
    expect(produto).toHaveAttribute("aria-expanded", "false");
  });

  it("o menu Produto abre no hover e fecha depois do atraso ao sair", async () => {
    vi.useFakeTimers();
    try {
      renderNaRota(<LandingHeader />);
      const produto = screen.getByRole("button", { name: /Funcionalidades/ });
      const area = produto;

      act(() => {
        area.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
      });
      expect(produto).toHaveAttribute("aria-expanded", "true");

      act(() => {
        area.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
      });
      // O painel espera o mouse atravessar o vão antes de fechar.
      expect(produto).toHaveAttribute("aria-expanded", "true");
      act(() => void vi.advanceTimersByTime(200));
      expect(produto).toHaveAttribute("aria-expanded", "false");
    } finally {
      vi.useRealTimers();
    }
  });

  it("o menu do celular abre e fecha pelo botão", async () => {
    renderNaRota(<LandingHeader />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const fechar = screen.getByRole("button", { name: "Fechar menu" });
    expect(fechar).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(fechar);
    expect(screen.getByRole("button", { name: "Abrir menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("o logo volta para a home", () => {
    renderNaRota(<LandingHeader />);
    expect(screen.getByRole("link", { name: "Pilar, página inicial" })).toHaveAttribute("href", "/");
  });
});

describe("LandingFooter", () => {
  it("todo link resolve para uma rota da landing ou para o app/demo", () => {
    const { container } = renderNaRota(<LandingFooter />);
    confereDestinos(container);
    confereDemos(container, 1);
  });

  it("tem módulos, comparações e as páginas da empresa", () => {
    const { container } = renderNaRota(<LandingFooter />);
    for (const m of MODULOS) expect(container.querySelector(`a[href="/${m.slug}"]`)).not.toBeNull();
    for (const c of COMPARATIVOS) {
      expect(screen.getByRole("link", { name: `Pilar vs ${c.adversario}` })).toHaveAttribute("href", `/vs/${c.slug}`);
    }
    for (const rota of ["/planos", "/faq", "/termos", "/privacidade"]) {
      expect(container.querySelector(`a[href="${rota}"]`)).not.toBeNull();
    }
  });

  it("'Preferências de cookies' pede para reabrir o banner", async () => {
    const ouvinte = vi.fn();
    window.addEventListener(CONSENT_REVIEW_REQUESTED_EVENT, ouvinte);
    renderNaRota(<LandingFooter />);
    await userEvent.click(screen.getByRole("button", { name: "Preferências de cookies" }));
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener(CONSENT_REVIEW_REQUESTED_EVENT, ouvinte);
  });

  it("assina com a tagline da marca", () => {
    renderNaRota(<LandingFooter />);
    expect(
      screen.getByText(/Gestão com agentes de IA para escritórios de engenharia e arquitetura\./)
    ).toBeInTheDocument();
  });
});

describe("CTAs para a demonstração em toda página", () => {
  const paginas: [string, ReactElement, string][] = [
    ["hero", <HeroSection />, "/"],
    ["fecho (CTASection)", <CTASection />, "/"],
    ["home inteira", <Home />, "/"],
    ["/planos", <Planos />, "/planos"],
    ["/engenharia", <PublicoPage slug="engenharia" />, "/engenharia"],
    ["/arquitetura", <PublicoPage slug="arquitetura" />, "/arquitetura"],
    ...MODULOS.map((m): [string, ReactElement, string] => [`/${m.slug}`, <ModulePage slug={m.slug} />, `/${m.slug}`]),
    ...COMPARATIVOS.map((c): [string, ReactElement, string] => [
      `/vs/${c.slug}`,
      <ComparativoPage slug={c.slug} />,
      `/vs/${c.slug}`,
    ]),
  ];

  it.each(paginas)("%s: links válidos e demonstração em nova aba com noopener", (_nome, ui, rota) => {
    const { container } = renderNaRota(ui, rota);
    confereDestinos(container);
    confereDemos(container, 1);
  });

  it("na hero, o botão principal leva aos planos e a demonstração fica como link secundário", async () => {
    renderNaRota(<HeroSection />);
    const verPlanos = screen.getByRole("link", { name: /Ver planos/ });
    expect(verPlanos).toHaveAttribute("href", "/planos");
    verPlanos.addEventListener("click", (e) => e.preventDefault());
    await userEvent.click(verPlanos);
    expect(trackCta).toHaveBeenCalledWith("ver_planos", "hero");

    const demo = screen.getByRole("link", { name: "Agende uma demonstração" });
    demo.addEventListener("click", (e) => e.preventDefault());
    await userEvent.click(demo);
    expect(trackCta).toHaveBeenCalledWith("agende_demo", "hero");
  });

  it("os links para o app (Entrar, Abrir Pilar) continuam na mesma aba", () => {
    document.cookie = "pilar_logged_hint=1; path=/";
    const { container } = renderNaRota(<CTASection />);
    const doApp = links(container).filter((a) => a.getAttribute("href")!.startsWith(APP_URL));
    expect(doApp.length).toBeGreaterThan(0);
    for (const a of doApp) expect(a).not.toHaveAttribute("target");
  });

  it.each(["engenharia", "arquitetura"] as const)(
    "/%s oferece demonstração, preserva o acesso aos preços e distingue o pedido de implantação",
    async (slug) => {
      renderNaRota(<PublicoPage slug={slug} />, `/${slug}`);
      // Dois pedidos de demonstração: o da hero e o ao lado da comparação com planilha e ERP.
      const demonstracoes = screen.getAllByRole("link", { name: "Agendar demonstração" });
      expect(demonstracoes).toHaveLength(2);
      for (const demonstracao of demonstracoes) {
        expect(demonstracao).toHaveAttribute("href", DEMO_URL);
        demonstracao.addEventListener("click", (e) => e.preventDefault());
        await userEvent.click(demonstracao);
      }
      expect(trackCta).toHaveBeenCalledWith("agende_demo", `publico_${slug}`);
      expect(trackCta).toHaveBeenCalledWith("agende_demo", `publico_${slug}_comparacao`);

      for (const comparativo of ["planilha", "erp-construtora", "whatsapp"]) {
        const link = document.querySelector(`a[href="/vs/${comparativo}"]`);
        expect(link, `/vs/${comparativo}`).not.toBeNull();
      }

      for (const planos of screen.getAllByRole("link", { name: "Ver planos" })) {
        expect(planos).toHaveAttribute("href", "/planos");
      }

      trackCta.mockClear();
      const implantacao = screen.getByRole("link", { name: "Conversar sobre implantação" });
      expect(implantacao).toHaveAttribute("href", WHATSAPP_COMERCIAL_URL);
      implantacao.addEventListener("click", (e) => e.preventDefault());
      await userEvent.click(implantacao);
      expect(trackCta).toHaveBeenCalledWith("consultar_implantacao", `implantacao_${slug}`);
      expect(trackCta).not.toHaveBeenCalledWith("agende_demo", expect.anything());
    }
  );
});

describe("páginas de módulo e comparação", () => {
  it.each(MODULOS.map((m) => [m.slug, m] as const))("/%s mostra headline, FAQ e as outras quatro frentes", (_s, m) => {
    renderNaRota(<ModulePage slug={m.slug} />, `/${m.slug}`);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(m.seo.h1);
    for (const f of m.faq) expect(screen.getByText(f.pergunta)).toBeInTheDocument();
    for (const outro of MODULOS.filter((o) => o.slug !== m.slug)) {
      expect(screen.getByText(outro.nome, { selector: "a span span" }).closest("a")).toHaveAttribute(
        "href",
        `/${outro.slug}`
      );
    }
    expect(document.title).toBe(tituloParaBusca(`${m.seo.titulo} | Pilar`));
    const jsonLd = document.head.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(jsonLd?.textContent ?? "{}").mainEntity).toHaveLength(m.faq.length);
  });

  it("print que não existe cai no desenho vetorial do grupo, sem imagem quebrada", () => {
    const m = MODULOS[0];
    const { container } = renderNaRota(<ModulePage slug={m.slug} />, `/${m.slug}`);
    const imagensDoGrupo = () =>
      [...container.querySelectorAll("img")].filter((i) => m.grupos.some((g) => g.img === i.getAttribute("src")));
    const imagens = imagensDoGrupo();
    expect(imagens.length).toBe(m.grupos.length);
    act(() => {
      for (const img of imagens) img.dispatchEvent(new Event("error"));
    });
    expect(imagensDoGrupo()).toEqual([]);
  });

  it.each(COMPARATIVOS.map((c) => [c.slug, c] as const))("/vs/%s mostra a tabela e o FAQ", (_s, c) => {
    const { container } = renderNaRota(<ComparativoPage slug={c.slug} />, `/vs/${c.slug}`);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(c.seo.h1);
    for (const l of c.linhas) expect(within(container).getAllByText(l.criterio).length).toBeGreaterThan(0);
    for (const f of c.faq) expect(screen.getByText(f.pergunta)).toBeInTheDocument();
    expect(document.title).toBe(tituloParaBusca(`${c.seo.titulo} | Pilar`));
  });
});

describe("NotFound", () => {
  it("mostra 404, volta para a home e não se declara canônica", () => {
    document.head.innerHTML = `<meta name="robots" content="index, follow" /><link rel="canonical" href="https://www.pilarsoft.com.br/" />`;
    const { container } = renderNaRota(<NotFound />, "/nao-existe");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Página não encontrada");
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para a página inicial" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Ir para o login da Pilar" })).toHaveAttribute("href", `${APP_URL}/login`);
    confereDestinos(container);

    expect(document.title).toBe("Página não encontrada | Pilar");
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, follow");
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://www.pilarsoft.com.br/"
    );
  });
});
