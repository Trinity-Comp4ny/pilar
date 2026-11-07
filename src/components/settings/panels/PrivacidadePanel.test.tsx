import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrivacidadePanel } from "./PrivacidadePanel";

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  setAnalyticsConsent: vi.fn(),
  consent: { analytics: false } as { analytics: boolean } | null,
  user: { id: "u1" } as { id: string } | null,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: h.rpc } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock("@/lib/cookieConsent", () => ({
  getCookieConsent: () => h.consent,
  CONSENT_CHANGED_EVENT: "pilar-consent-changed",
}));
vi.mock("@/lib/cookieConsentSync", () => ({ setAnalyticsConsent: h.setAnalyticsConsent }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess, info: h.toastInfo } }));

beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: "u1" };
  h.consent = { analytics: false };
  h.rpc.mockResolvedValue({ data: {}, error: null });
  h.setAnalyticsConsent.mockResolvedValue(undefined);
});

describe("Configurações › Privacidade (LGPD)", () => {
  it("exportar dados registra o pedido e esconde o botão", async () => {
    render(<PrivacidadePanel />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Solicitar exportação de dados/ }));
    expect(await screen.findByText(/Pedido registrado. Confira seu e-mail/)).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith("request_data_export");
    expect(screen.queryByRole("button", { name: /Solicitar exportação/ })).not.toBeInTheDocument();
  });

  it("exportação já pendente avisa sem duplicar", async () => {
    h.rpc.mockResolvedValue({ data: { error: "already_pending" }, error: null });
    render(<PrivacidadePanel />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Solicitar exportação de dados/ }));
    await waitFor(() =>
      expect(h.toastInfo).toHaveBeenCalledWith("Já existe uma solicitação de exportação em andamento.")
    );
    expect(screen.getByRole("button", { name: /Solicitar exportação de dados/ })).toBeEnabled();
  });

  it("erro na exportação mostra mensagem segura", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "function request_data_export() does not exist" } });
    render(<PrivacidadePanel />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Solicitar exportação de dados/ }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível registrar a solicitação", {
        description: "Tente de novo em instantes.",
      })
    );
  });

  it("sem usuário não chama o servidor", async () => {
    h.user = null;
    render(<PrivacidadePanel />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Solicitar exportação de dados/ }));
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("exclusão exige confirmação; Cancelar não envia", async () => {
    render(<PrivacidadePanel />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Solicitar exclusão de dados/ }));
    expect(await screen.findByText("Confirmar solicitação de exclusão")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("exclusão envia o motivo aparado e fecha o diálogo", async () => {
    render(<PrivacidadePanel />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Solicitar exclusão de dados/ }));
    await user.type(await screen.findByLabelText("Motivo (opcional)"), "  Encerrando o escritório  ");
    await user.click(screen.getByRole("button", { name: "Confirmar solicitação" }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith("request_data_deletion", { p_motivo: "Encerrando o escritório" })
    );
    await waitFor(() => expect(screen.queryByText("Confirmar solicitação de exclusão")).not.toBeInTheDocument());
  });

  it("motivo vazio vai como null", async () => {
    render(<PrivacidadePanel />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Solicitar exclusão de dados/ }));
    await user.click(await screen.findByRole("button", { name: "Confirmar solicitação" }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("request_data_deletion", { p_motivo: null }));
  });

  it("erro na exclusão mantém o diálogo aberto com o motivo", async () => {
    h.rpc.mockResolvedValue({ error: { message: "permission denied for table data_deletion_requests" } });
    render(<PrivacidadePanel />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Solicitar exclusão de dados/ }));
    await user.type(await screen.findByLabelText("Motivo (opcional)"), "Teste");
    await user.click(screen.getByRole("button", { name: "Confirmar solicitação" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível registrar a solicitação", {
        description: "Você não tem permissão para realizar esta ação.",
      })
    );
    expect(screen.getByLabelText("Motivo (opcional)")).toHaveValue("Teste");
  });

  it("ligar cookies de análise grava a preferência na conta", async () => {
    render(<PrivacidadePanel />);
    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeChecked();
    await userEvent.setup().click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(h.setAnalyticsConsent).toHaveBeenCalledWith("u1", true);
  });

  it("falha ao gravar consentimento reverte o toggle", async () => {
    h.setAnalyticsConsent.mockRejectedValue(new Error("offline"));
    render(<PrivacidadePanel />);
    const toggle = screen.getByRole("switch");
    await userEvent.setup().click(toggle);
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível salvar a preferência", {
        description: "Tente de novo em instantes.",
      })
    );
    expect(toggle).not.toBeChecked();
  });
});
