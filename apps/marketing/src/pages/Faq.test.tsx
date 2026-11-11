import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { prepararAmbiente, renderNaRota } from "../test/ambiente";
import { Faq } from "./Faq";

beforeAll(() => prepararAmbiente());

const perguntas = () => screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"));

describe("página /faq", () => {
  it("abre com a primeira pergunta expandida e as demais fechadas", () => {
    renderNaRota(<Faq />, "/faq");
    const botoes = perguntas();
    expect(botoes.length).toBeGreaterThanOrEqual(6);
    expect(botoes[0]).toHaveAttribute("aria-expanded", "true");
    for (const b of botoes.slice(1)) expect(b).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/Um só\. Os módulos existem/)).toBeInTheDocument();
  });

  it("abrir outra pergunta fecha a anterior (uma por vez)", async () => {
    renderNaRota(<Faq />, "/faq");
    const [primeira, , terceira] = perguntas();

    await userEvent.click(terceira);

    expect(terceira).toHaveAttribute("aria-expanded", "true");
    expect(primeira).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Um só\. Os módulos existem/)).not.toBeInTheDocument();
    expect(screen.getByText(/A IA monta o rascunho/)).toBeInTheDocument();
  });

  it("clicar na pergunta aberta fecha todas", async () => {
    renderNaRota(<Faq />, "/faq");
    const [primeira] = perguntas();
    await userEvent.click(primeira);
    for (const b of perguntas()) expect(b).toHaveAttribute("aria-expanded", "false");
  });

  it("qualifica o público: arquitetura e engenharia sim, construtora de grande porte não", () => {
    renderNaRota(<Faq />, "/faq");
    expect(screen.getByText(/ou arquitetura\./)).toBeInTheDocument();
    expect(screen.getByText("Construtora ou incorporadora de grande porte.")).toBeInTheDocument();
  });

  it("grava as metas e publica o FAQPage com todas as perguntas", () => {
    renderNaRota(<Faq />, "/faq");
    expect(document.title).toBe("Perguntas frequentes sobre o Pilar, software de gestão | Pilar");
    const jsonLd = JSON.parse(
      document.head.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}"
    ) as { "@type": string; mainEntity: { name: string }[] };
    expect(jsonLd["@type"]).toBe("FAQPage");
    expect(jsonLd.mainEntity.map((q) => q.name)).toEqual(perguntas().map((b) => b.textContent));
  });
});
