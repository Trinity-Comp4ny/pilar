import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsDialog } from "./SettingsDialog";

const h = vi.hoisted(() => ({
  isOpen: true,
  section: "conta" as string,
  openSettings: vi.fn(),
  closeSettings: vi.fn(),
}));

vi.mock("@/contexts/SettingsModalContext", () => ({
  useSettingsModal: () => ({
    isOpen: h.isOpen,
    section: h.section,
    openSettings: h.openSettings,
    closeSettings: h.closeSettings,
  }),
}));
vi.mock("./panels/ContaPanel", () => ({ ContaPanel: () => <div>painel-conta</div> }));
vi.mock("./panels/SegurancaPanel", () => ({ SegurancaPanel: () => <div>painel-seguranca</div> }));
vi.mock("./panels/EmpresaPanel", () => ({ EmpresaPanel: () => <div>painel-empresa</div> }));
vi.mock("./panels/UsoPanel", () => ({ UsoPanel: () => <div>painel-uso</div> }));
vi.mock("./panels/PagamentoPanel", () => ({ PagamentoPanel: () => <div>painel-pagamento</div> }));
vi.mock("./panels/PrivacidadePanel", () => ({ PrivacidadePanel: () => <div>painel-privacidade</div> }));

beforeEach(() => {
  vi.clearAllMocks();
  h.isOpen = true;
  h.section = "conta";
});

describe("SettingsDialog", () => {
  it("fechado não renderiza painel", () => {
    h.isOpen = false;
    render(<SettingsDialog />);
    expect(screen.queryByText("painel-conta")).not.toBeInTheDocument();
  });

  it("mostra a seção ativa e troca pelo rail", async () => {
    h.section = "uso";
    render(<SettingsDialog />);
    expect(screen.getByText("painel-uso")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Uso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uso" })).toHaveAttribute("aria-current", "page");
    await userEvent.setup().click(screen.getByRole("button", { name: "Segurança" }));
    expect(h.openSettings).toHaveBeenCalledWith("seguranca");
  });

  it("seção desconhecida cai em Conta", () => {
    h.section = "inexistente";
    render(<SettingsDialog />);
    expect(screen.getByText("painel-conta")).toBeInTheDocument();
  });

  it("Esc fecha o modal", async () => {
    render(<SettingsDialog />);
    await userEvent.setup().keyboard("{Escape}");
    expect(h.closeSettings).toHaveBeenCalled();
  });
});
