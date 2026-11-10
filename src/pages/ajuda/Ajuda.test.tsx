import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Ajuda from "./index";

vi.mock("@/components/FeedbackDialog", () => ({
  FeedbackDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="feedback-aberto" /> : null),
}));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({
    title,
    search,
    children,
  }: {
    title: string;
    search?: { value: string; onChange: (v: string) => void; placeholder?: string };
    children: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {search && (
        <input aria-label={search.placeholder} value={search.value} onChange={(e) => search.onChange(e.target.value)} />
      )}
      {children}
    </div>
  ),
}));

function abrir(rota = "/ajuda") {
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Ajuda />
    </MemoryRouter>
  );
  return userEvent.setup();
}

describe("Central de ajuda (SPEC 154)", () => {
  it("lista os artigos por grupo", () => {
    abrir();
    expect(screen.getByText("Leads, propostas e clientes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Criar um lead/ })).toHaveAttribute("href", "/ajuda/criar-lead");
  });

  it("busca sem acento acha a proposta", async () => {
    const user = abrir();
    await user.type(screen.getByLabelText("Buscar na ajuda"), "orcamento");
    expect(screen.getByRole("link", { name: /Criar e enviar uma proposta/ })).toBeInTheDocument();
    expect(screen.queryByText("Leads, propostas e clientes")).not.toBeInTheDocument();
  });

  it("busca sem resultado oferece feedback", async () => {
    const user = abrir();
    await user.type(screen.getByLabelText("Buscar na ajuda"), "zzzz");
    await user.click(screen.getByRole("button", { name: "Enviar feedback" }));
    expect(screen.getByTestId("feedback-aberto")).toBeInTheDocument();
  });

  it("vindo do ? de uma tela, mostra os artigos dela primeiro", () => {
    abrir("/ajuda?tela=%2Fgestao%2Fleads");
    expect(screen.getByText("Desta tela")).toBeInTheDocument();
  });
});
