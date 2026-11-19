import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  data: undefined as unknown,
  mutate: vi.fn(),
}));
vi.mock("../hooks/useModulosOcultos", () => ({
  useModulosOcultos: () => ({ data: h.data, isLoading: false, error: null }),
  useSetModulosOcultos: () => ({ mutate: h.mutate, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: vi.fn() }));

import { CompanyModulosTab } from "./CompanyModulosTab";

beforeEach(() => {
  h.mutate.mockReset();
  h.data = {
    empresa: ["obras"],
    pessoas: [
      { id: "u1", nome: "João", email: "j@x.com", role: "user", ocultos: ["gestao"] },
      { id: "a1", nome: "Admin", email: "a@x.com", role: "admin", ocultos: [] },
    ],
  };
});

describe("CompanyModulosTab", () => {
  it("lista só quem não é admin e reflete o estado atual", () => {
    render(<CompanyModulosTab empresaId="e1" />);
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.getByRole("switch", { name: "Gestão para João" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Projetos para João" })).toBeChecked();
    // Oculto na empresa: fica desabilitado para a pessoa.
    expect(screen.getByRole("switch", { name: "Obras para João" })).toBeDisabled();
  });

  it("ocultar módulo da empresa grava a lista nova", async () => {
    render(<CompanyModulosTab empresaId="e1" />);
    await userEvent.setup().click(screen.getByRole("switch", { name: "Projetos visível para o escritório" }));
    expect(h.mutate).toHaveBeenCalledWith(
      { alvo: { alvo: "empresa" }, modulos: ["obras", "projetos"] },
      expect.any(Object)
    );
  });

  it("reativar módulo de uma pessoa tira da lista dela", async () => {
    render(<CompanyModulosTab empresaId="e1" />);
    await userEvent.setup().click(screen.getByRole("switch", { name: "Gestão para João" }));
    expect(h.mutate).toHaveBeenCalledWith(
      { alvo: { alvo: "usuario", usuarioId: "u1" }, modulos: [] },
      expect.any(Object)
    );
  });
});
