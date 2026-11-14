import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MarkdownResposta } from "./MarkdownResposta";

const montar = (texto: string) =>
  render(
    <MemoryRouter>
      <MarkdownResposta>{texto}</MarkdownResposta>
    </MemoryRouter>
  );

describe("MarkdownResposta", () => {
  it("link para registro da Pilar vira rota interna", () => {
    montar("Veja [Projeto Horizonte](/projetos/abc).");
    const link = screen.getByRole("link", { name: "Projeto Horizonte" });
    expect(link).toHaveAttribute("href", "/projetos/abc");
    expect(link).not.toHaveAttribute("target");
  });

  it("link externo abre em outra aba sem referrer", () => {
    montar("Fonte: [Caixa](https://www.caixa.gov.br).");
    const link = screen.getByRole("link", { name: "Caixa" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("endereço sem protocolo vindo do modelo (//host) não vira rota interna", () => {
    montar("[x](//evil.test/a)");
    expect(screen.getByRole("link", { name: "x" })).toHaveAttribute("target", "_blank");
  });

  it("javascript: não vira link", () => {
    montar("[x](javascript:alert(1))");
    expect(screen.queryByRole("link", { name: "x" })).toBeNull();
  });
});
