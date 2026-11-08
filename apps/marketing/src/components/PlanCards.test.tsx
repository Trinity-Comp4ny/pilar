import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepararAmbiente, renderNaRota } from "../test/ambiente";
import { DEMO_URL } from "../lib/contato";
import { APP_URL } from "../config";
import { INCLUSO_EM_TODOS, PLANOS } from "../lib/planos";
import { IncluidoEmTodos, PlanCards } from "./PlanCards";
import { PricingSection } from "./PricingSection";
import { Planos } from "../pages/Planos";

const trackCta = vi.hoisted(() => vi.fn());
vi.mock("../analytics", () => ({ trackCta, applyCookieConsent: vi.fn(), initAnalytics: vi.fn() }));

beforeAll(() => prepararAmbiente());
beforeEach(() => trackCta.mockClear());

/** O cartão de um plano, achado pelo botão de assinar dele. */
function cartaoDo(nome: string) {
  const botao = screen.getByRole("link", { name: `Assinar o plano ${nome}` });
  return botao.closest("div.relative") as HTMLElement;
}

function confereCartoes() {
  for (const p of PLANOS) {
    const cartao = within(cartaoDo(p.nome));
    expect(cartao.getByText(p.nome)).toBeInTheDocument();
    expect(cartao.getByText(`R$ ${p.preco}`)).toBeInTheDocument();
    for (const regua of [p.projetos, p.obras, p.leads, p.creditosMes, p.atendimento]) {
      expect(cartao.getByText(regua)).toBeInTheDocument();
    }
  }
}

describe("PlanCards", () => {
  it("mostra preço, capacidade por módulo, créditos e atendimento de cada plano", () => {
    renderNaRota(<PlanCards contexto="home" />);
    confereCartoes();
    expect(screen.getAllByText("/mês")).toHaveLength(3);
  });

  it("exibe os valores decididos: R$ 299, R$ 499 e R$ 899", () => {
    renderNaRota(<PlanCards contexto="home" />);
    for (const preco of ["R$ 299", "R$ 499", "R$ 899"]) expect(screen.getByText(preco)).toBeInTheDocument();
  });

  it("marca só o Profissional como 'Mais escolhido'", () => {
    renderNaRota(<PlanCards contexto="home" />);
    expect(screen.getAllByText("Mais escolhido")).toHaveLength(1);
    expect(within(cartaoDo("Profissional")).getByText("Mais escolhido")).toBeInTheDocument();
  });

  it("o botão de cada plano leva ao checkout daquele plano, na mesma aba", () => {
    renderNaRota(<PlanCards contexto="home" />);
    for (const p of PLANOS) {
      const b = screen.getByRole("link", { name: `Assinar o plano ${p.nome}` });
      expect(b).toHaveAttribute("href", `${APP_URL}/checkout?plano=${p.slug}`);
      expect(b).not.toHaveAttribute("target");
    }
  });

  it("cada plano oferece a demonstração como caminho secundário, em nova aba com noopener", () => {
    renderNaRota(<PlanCards contexto="home" />);
    const demos = screen.getAllByRole("link", { name: "ou agende uma demonstração" });
    expect(demos).toHaveLength(3);
    for (const d of demos) {
      expect(d).toHaveAttribute("href", DEMO_URL);
      expect(d).toHaveAttribute("target", "_blank");
      expect(d.getAttribute("rel")).toMatch(/noopener/);
    }
  });

  it("o clique registra o CTA com o contexto e o plano", async () => {
    renderNaRota(<PlanCards contexto="planos" />);
    const botao = screen.getByRole("link", { name: "Assinar o plano Profissional" });
    botao.addEventListener("click", (e) => e.preventDefault());
    await userEvent.click(botao);
    expect(trackCta).toHaveBeenCalledWith("assinar", "planos_pro");
  });
});

describe("IncluidoEmTodos", () => {
  it("lista tudo o que vem em qualquer plano", () => {
    renderNaRota(<IncluidoEmTodos />);
    for (const item of INCLUSO_EM_TODOS) expect(screen.getByText(item)).toBeInTheDocument();
  });
});

describe("PricingSection (home)", () => {
  it("usa os mesmos cartões e leva para a página de planos", async () => {
    renderNaRota(<PricingSection />);
    confereCartoes();
    for (const item of INCLUSO_EM_TODOS) expect(screen.getByText(item)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Ver a página de planos" });
    expect(link).toHaveAttribute("href", "/planos");
    await userEvent.click(link);
    expect(trackCta).toHaveBeenCalledWith("ver_planos", "pricing_home");
  });

  it("tem a âncora #planos usada pela navegação", () => {
    const { container } = renderNaRota(<PricingSection />);
    expect(container.querySelector("section#planos")).not.toBeNull();
  });
});

describe("página /planos", () => {
  it("mostra os três planos, o incluso e as perguntas antes de assinar", () => {
    renderNaRota(<Planos />, "/planos");
    confereCartoes();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Um preço por escritório.");
    expect(screen.getByText("O que conta como ativo?")).toBeInTheDocument();
    expect(screen.getByText("O que é um crédito de IA?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar para a home/ })).toHaveAttribute("href", "/");
  });

  it("o contato por WhatsApp abre em nova aba, com noopener", () => {
    renderNaRota(<Planos />, "/planos");
    const zap = screen.getByRole("link", { name: "Ainda com dúvida? Fale com a gente" });
    expect(zap.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\d+$/);
    expect(zap).toHaveAttribute("target", "_blank");
    expect(zap.getAttribute("rel")).toMatch(/noopener/);
  });

  it("grava title, description e canonical de /planos", () => {
    renderNaRota(<Planos />, "/planos");
    expect(document.title).toBe("Planos e preços | Pilar");
  });
});
