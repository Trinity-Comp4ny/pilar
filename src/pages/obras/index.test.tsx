import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ObrasPage from "./index";

/**
 * Nova obra (SPEC 136, BEZ-24): com a estimativa ligada na empresa pergunta como começar; sem ela abre o formulário
 * da obra direto, como sempre.
 */

let podeEstimar = true;

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (f: string) => (f === "estimativa_obra" ? podeEstimar : true) }),
}));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/pages/obras/hooks/useObras", () => ({
  useObras: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock("./components/FilaCotacoesPendentes", () => ({ FilaCotacoesPendentes: () => null }));
vi.mock("./components/ObraFormDialog", () => ({
  ObraFormDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog">Formulário da obra</div> : null),
}));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({
    primaryAction,
    children,
  }: {
    primaryAction?: { label: string; onClick: () => void };
    children: ReactNode;
  }) => (
    <main>
      {primaryAction && <button onClick={primaryAction.onClick}>{primaryAction.label}</button>}
      {children}
    </main>
  ),
}));

const abrir = () =>
  render(
    <MemoryRouter>
      <ObrasPage />
    </MemoryRouter>
  );

beforeEach(() => {
  podeEstimar = true;
});

describe("ObrasPage: nova obra", () => {
  it("com a estimativa, pergunta como começar antes de abrir o formulário", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getAllByRole("button", { name: "Nova obra" })[0]);
    expect(await screen.findByRole("heading", { name: "Como quer começar a obra?" })).toBeInTheDocument();
    expect(screen.queryByText("Formulário da obra")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Começar em branco/ }));
    expect(await screen.findByText("Formulário da obra")).toBeInTheDocument();
  });

  it("sem a estimativa, abre o formulário da obra direto", async () => {
    podeEstimar = false;
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getAllByRole("button", { name: "Nova obra" })[0]);
    expect(await screen.findByText("Formulário da obra")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Como quer começar a obra?" })).not.toBeInTheDocument();
  });
});
