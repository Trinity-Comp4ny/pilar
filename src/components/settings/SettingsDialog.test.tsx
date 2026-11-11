import { beforeEach, describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
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
vi.mock("./panels/IntegracoesPanel", () => ({ IntegracoesPanel: () => <div>painel-integracoes</div> }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const render = (ui: ReactElement) =>
  rtlRender(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

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

  it("volta do Google com o Drive conectado: avisa e tira o ?drive= da URL", () => {
    window.history.replaceState(null, "", "/projetos/p1?drive=conectado#arquivos");
    render(<SettingsDialog />);
    expect(toast.success).toHaveBeenCalledWith("Google Drive conectado", expect.anything());
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe("/projetos/p1#arquivos");
  });

  it("volta do Google com erro avisa o erro; sem ?drive= não avisa nada", () => {
    window.history.replaceState(null, "", "/?drive=erro");
    render(<SettingsDialog />);
    expect(toast.error).toHaveBeenCalled();
    vi.clearAllMocks();
    render(<SettingsDialog />);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("Esc fecha o modal", async () => {
    render(<SettingsDialog />);
    await userEvent.setup().keyboard("{Escape}");
    expect(h.closeSettings).toHaveBeenCalled();
  });
});
