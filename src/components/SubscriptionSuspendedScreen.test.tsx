// Tela "Acesso suspenso": o admin vê assinatura e exportar; quem não é admin só é
// orientado. O export chama a edge exportar-dados-empresa e trata "reautenticar".
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { SubscriptionSuspendedScreen } from "./SubscriptionSuspendedScreen";

const openSettings = vi.fn();
const invoke = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ openSettings }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: vi.fn() }, functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException: vi.fn() } }));

const assign = vi.fn();

function montar(isAdmin: boolean) {
  return render(
    <MemoryRouter>
      <SubscriptionSuspendedScreen isAdmin={isAdmin} />
    </MemoryRouter>
  );
}

function erroHttp(corpo: unknown) {
  return new FunctionsHttpError(new Response(JSON.stringify(corpo), { status: 401 }));
}

describe("SubscriptionSuspendedScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", { value: { assign }, writable: true });
  });

  it("não admin só vê a orientação e o botão de sair, sem exportar nem assinar", () => {
    montar(false);
    expect(screen.getByText("Acesso suspenso")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Exportar meus dados/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver assinatura" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sair da conta" })).toBeInTheDocument();
  });

  it("admin abre o pagamento", async () => {
    montar(true);
    await userEvent.click(screen.getByRole("button", { name: "Ver assinatura" }));
    expect(openSettings).toHaveBeenCalledWith("pagamento");
  });

  it("admin exporta: chama a edge e inicia o download pelo link assinado", async () => {
    invoke.mockResolvedValue({ data: { url: "https://x/arquivo.zip", arquivo: "dados.zip" }, error: null });
    montar(true);
    await userEvent.click(screen.getByRole("button", { name: /Exportar meus dados/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://x/arquivo.zip"));
    expect(invoke).toHaveBeenCalledWith("exportar-dados-empresa", { body: {} });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("sessão antiga: pede para entrar de novo, sem toast de erro", async () => {
    invoke.mockResolvedValue({ data: null, error: erroHttp({ error: "Entre de novo.", codigo: "reautenticar" }) });
    montar(true);
    await userEvent.click(screen.getByRole("button", { name: /Exportar meus dados/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("login recente");
    expect(toastError).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("limite por hora ou falha do servidor mostra a mensagem do backend", async () => {
    invoke.mockResolvedValue({ data: null, error: erroHttp({ error: "Muitas tentativas. Aguarde." }) });
    montar(true);
    await userEvent.click(screen.getByRole("button", { name: /Exportar meus dados/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Muitas tentativas. Aguarde."));
    expect(assign).not.toHaveBeenCalled();
  });

  it("resposta sem link não inicia download e avisa", async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    montar(true);
    await userEvent.click(screen.getByRole("button", { name: /Exportar meus dados/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(assign).not.toHaveBeenCalled();
  });
});
