import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MfaChallengePage from "./MfaChallengePage";

const { mfa, signOut, refreshMfaLevel, toastError, toastSuccess } = vi.hoisted(() => ({
  mfa: {
    factors: [] as { id: string; status: string }[],
    verifyTotp: vi.fn(),
    unenrollPending: vi.fn(),
    recoverWithBackupCode: vi.fn(),
    loading: false,
  },
  signOut: vi.fn(),
  refreshMfaLevel: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/useMfa", () => ({ useMfa: () => mfa }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ signOut, refreshMfaLevel }) }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/components/AuthPromessa", () => ({ AuthPromessa: () => null }));
vi.mock("@/components/MfaHelpModal", () => ({ MfaHelpModal: () => null }));

// input-otp usa ResizeObserver e elementFromPoint; o jsdom não tem.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.elementFromPoint ??= () => null;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/mfa"]}>
      <Routes>
        <Route path="/mfa" element={<MfaChallengePage />} />
        <Route path="/mfa/setup" element={<div data-testid="setup">Setup</div>} />
        <Route path="/inicio" element={<div data-testid="inicio">Início</div>} />
        <Route path="/" element={<div data-testid="landing">Landing</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const otp = () => screen.getByRole("textbox");

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mfa.factors = [{ id: "f1", status: "verified" }];
  mfa.loading = false;
  mfa.verifyTotp.mockResolvedValue(undefined);
  mfa.unenrollPending.mockResolvedValue(undefined);
  mfa.recoverWithBackupCode.mockResolvedValue(true);
  signOut.mockResolvedValue(undefined);
  refreshMfaLevel.mockResolvedValue(undefined);
});

describe("MfaChallengePage", () => {
  it("botão Verificar fica desabilitado até 6 dígitos", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Verificar" })).toBeDisabled();
    fireEvent.change(otp(), { target: { value: "123" } });
    expect(screen.getByRole("button", { name: "Verificar" })).toBeDisabled();
    expect(mfa.verifyTotp).not.toHaveBeenCalled();
  });

  it("código correto verifica, marca pós-login e vai para /inicio", async () => {
    renderPage();
    fireEvent.change(otp(), { target: { value: "123456" } });
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(mfa.verifyTotp).toHaveBeenCalledWith("f1", "123456");
    expect(refreshMfaLevel).toHaveBeenCalled();
    expect(sessionStorage.getItem("pilar_post_login")).toBe("1");
  });

  it("código errado mostra erro traduzido, limpa o campo e continua na página", async () => {
    mfa.verifyTotp.mockRejectedValue(new Error("Invalid TOTP code entered"));
    renderPage();
    fireEvent.change(otp(), { target: { value: "000000" } });
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Código inválido", { description: "Código incorreto. Tente novamente." })
    );
    await waitFor(() => expect(otp()).toHaveValue(""));
    expect(screen.queryByTestId("inicio")).not.toBeInTheDocument();
    expect(refreshMfaLevel).not.toHaveBeenCalled();
  });

  it("desafio expirado vira mensagem amigável", async () => {
    mfa.verifyTotp.mockRejectedValue(new Error("MFA challenge not found"));
    renderPage();
    fireEvent.change(otp(), { target: { value: "111111" } });
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Código inválido", {
        description: "Desafio MFA expirado. Tente novamente.",
      })
    );
  });

  it("Sair encerra a sessão e volta para a landing", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sair" }));
    expect(await screen.findByTestId("landing")).toBeInTheDocument();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("código de recuperação vazio não é enviado", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Não tenho acesso ao autenticador/ }));
    expect(screen.getByRole("button", { name: "Usar código de recuperação" })).toBeDisabled();
    await user.type(screen.getByPlaceholderText("XXXX-XXXX"), "   {Enter}");
    expect(toastError).toHaveBeenCalledWith("Informe o código de recuperação");
    expect(mfa.recoverWithBackupCode).not.toHaveBeenCalled();
  });

  it("código de recuperação inválido/usado avisa e não libera", async () => {
    mfa.recoverWithBackupCode.mockResolvedValue(false);
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Não tenho acesso ao autenticador/ }));
    await user.type(screen.getByPlaceholderText("XXXX-XXXX"), "abcd efgh");
    await user.click(screen.getByRole("button", { name: "Usar código de recuperação" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Código inválido ou já utilizado"));
    expect(mfa.recoverWithBackupCode).toHaveBeenCalledWith("ABCDEFGH");
    expect(screen.queryByTestId("inicio")).not.toBeInTheDocument();
  });

  it("código de recuperação válido libera o acesso", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Não tenho acesso ao autenticador/ }));
    await user.type(screen.getByPlaceholderText("XXXX-XXXX"), "ABCD-EFGH");
    await user.click(screen.getByRole("button", { name: "Usar código de recuperação" }));
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
  });

  it("erro de servidor no código de recuperação mostra toast", async () => {
    mfa.recoverWithBackupCode.mockRejectedValue(new Error("AuthRetryableFetchError"));
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Não tenho acesso ao autenticador/ }));
    await user.type(screen.getByPlaceholderText("XXXX-XXXX"), "ABCD-EFGH");
    await user.click(screen.getByRole("button", { name: "Usar código de recuperação" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao validar código", {
        description: "Falha de conexão. Verifique sua internet.",
      })
    );
  });

  it("fator não confirmado oferece reiniciar a configuração", async () => {
    mfa.factors = [{ id: "f2", status: "unverified" }];
    renderPage();
    expect(screen.getByText("Configuração incompleta")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Reiniciar configuração/ }));
    expect(await screen.findByTestId("setup")).toBeInTheDocument();
    expect(mfa.unenrollPending).toHaveBeenCalled();
  });

  it("falha ao reiniciar mantém a tela e avisa", async () => {
    mfa.factors = [];
    mfa.unenrollPending.mockRejectedValue(new Error("boom"));
    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: /Configurar agora/ }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao reiniciar", { description: "Erro inesperado. Tente novamente." })
    );
    expect(screen.queryByTestId("setup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Configurar agora/ })).toBeEnabled();
  });
});
