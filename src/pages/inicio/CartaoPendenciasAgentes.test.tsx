import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartaoPendenciasAgentes } from "./CartaoPendenciasAgentes";

const usePendencias = vi.fn();
vi.mock("@/hooks/useEscopos", () => ({ usePendenciasAgentes: () => usePendencias() }));

const montar = () =>
  render(
    <MemoryRouter>
      <CartaoPendenciasAgentes />
    </MemoryRouter>
  );

describe("CartaoPendenciasAgentes", () => {
  beforeEach(() => usePendencias.mockReset());

  it("não aparece sem pendência", () => {
    usePendencias.mockReturnValue({ data: [] });
    const { container } = montar();
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra a contagem e leva para /agentes", () => {
    usePendencias.mockReturnValue({ data: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    montar();
    const link = screen.getByRole("link", { name: /3 pendências dos agentes/ });
    expect(link).toHaveAttribute("href", "/agentes");
  });

  it("usa o singular com uma pendência", () => {
    usePendencias.mockReturnValue({ data: [{ id: "a" }] });
    montar();
    expect(screen.getByText("1 pendência dos agentes")).toBeInTheDocument();
  });
});
