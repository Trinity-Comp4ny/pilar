import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { EscolherInicioObraDialog } from "./EscolherInicioObraDialog";

/** Nova obra com a estimativa ligada (SPEC 136, BEZ-24): começar pela estimativa ou em branco. */

const { navegar } = vi.hoisted(() => ({ navegar: vi.fn() }));
vi.mock("react-router-dom", async (original) => ({
  ...(await original<typeof import("react-router-dom")>()),
  useNavigate: () => navegar,
}));

const onOpenChange = vi.fn();
const onEmBranco = vi.fn();

const abrir = () =>
  render(
    <MemoryRouter>
      <EscolherInicioObraDialog open onOpenChange={onOpenChange} onEmBranco={onEmBranco} />
    </MemoryRouter>
  );

beforeEach(() => {
  navegar.mockClear();
  onOpenChange.mockClear();
  onEmBranco.mockClear();
});

describe("EscolherInicioObraDialog", () => {
  it("oferece as duas formas, com a estimativa como recomendada", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Como quer começar a obra?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Começar com estimativa/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Começar em branco/ })).toBeInTheDocument();
    expect(screen.getByText("Recomendado")).toBeInTheDocument();
  });

  it("começar com estimativa fecha e abre o assistente", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: /Começar com estimativa/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navegar).toHaveBeenCalledWith("/obras/estimativas/nova");
    expect(onEmBranco).not.toHaveBeenCalled();
  });

  it("começar em branco fecha e abre o formulário da obra", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: /Começar em branco/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onEmBranco).toHaveBeenCalledTimes(1);
    expect(navegar).not.toHaveBeenCalled();
  });
});
