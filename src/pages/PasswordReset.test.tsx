import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PasswordReset from "./PasswordReset";

const { auth, recoverWithBackupCode, toastError, toastSuccess } = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    mfa: { listFactors: vi.fn(), challenge: vi.fn(), verify: vi.fn() },
  },
  recoverWithBackupCode: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
vi.mock("@/hooks/useMfa", () => ({ useMfa: () => ({ recoverWithBackupCode }) }));
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

const SENHA_FORTE = "Nova#Senha2026";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<PasswordReset />} />
        <Route path="/login" element={<div data-testid="login">Login</div>} />
        <Route path="/forgot-password" element={<div data-testid="forgot">Forgot</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const unsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: "u" } } } });
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
  auth.mfa.listFactors.mockResolvedValue({ data: { totp: [] } });
  auth.updateUser.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
  auth.mfa.challenge.mockResolvedValue({ data: { id: "ch1" }, error: null });
  auth.mfa.verify.mockResolvedValue({ error: null });
  recoverWithBackupCode.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

async function irParaSenha() {
  renderPage();
  expect(await screen.findByText("Nova senha", { selector: "h1" })).toBeInTheDocument();
  const [senha, confirmar] = screen.getAllByPlaceholderText("••••••••••••");
  return { senha, confirmar, user: userEvent.setup() };
}

describe("PasswordReset", () => {
  it("mostra validação do link enquanto carrega", () => {
    auth.getSession.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Validando link de recuperação...")).toBeInTheDocument();
  });

  it("link expirado/inválido: sem sessão após a espera mostra 'Link expirado' e oferece novo link", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    auth.getSession.mockResolvedValue({ data: { session: null } });
    renderPage();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(await screen.findByText("Link expirado")).toBeInTheDocument();
    expect(auth.updateUser).not.toHaveBeenCalled();
    vi.useRealTimers();
    await userEvent.setup().click(screen.getByRole("button", { name: "Solicitar novo link" }));
    expect(await screen.findByTestId("forgot")).toBeInTheDocument();
  });

  it("não marca expirado antes de 8s (hidratação lenta)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    auth.getSession.mockResolvedValue({ data: { session: null } });
    renderPage();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.queryByText("Link expirado")).not.toBeInTheDocument();
    expect(screen.getByText("Validando link de recuperação...")).toBeInTheDocument();
  });

  it("evento PASSWORD_RECOVERY tardio recupera a sessão", async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    renderPage();
    const cb = auth.onAuthStateChange.mock.calls[0][0] as (e: string) => void;
    await act(async () => cb("PASSWORD_RECOVERY"));
    expect(await screen.findByText("Nova senha", { selector: "h1" })).toBeInTheDocument();
  });

  it("senha fraca mostra a regra violada e mantém o botão desabilitado", async () => {
    const { senha, confirmar, user } = await irParaSenha();
    await user.type(senha, "curta");
    await user.type(confirmar, "curta");
    expect(await screen.findByText("Senha deve ter pelo menos 12 caracteres")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar nova senha" })).toBeDisabled();
  });

  it("senha sem caractere especial é recusada", async () => {
    const { senha, user } = await irParaSenha();
    await user.type(senha, "SenhaLonga2026");
    expect(await screen.findByText("Senha deve conter caractere especial")).toBeInTheDocument();
  });

  it("confirmação diferente mostra erro e não envia", async () => {
    const { senha, confirmar, user } = await irParaSenha();
    await user.type(senha, SENHA_FORTE);
    await user.type(confirmar, SENHA_FORTE + "x");
    expect(await screen.findByText("As senhas não coincidem")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar nova senha" })).toBeDisabled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("sucesso troca a senha, encerra a sessão e leva ao login", async () => {
    const { senha, confirmar, user } = await irParaSenha();
    await user.type(senha, SENHA_FORTE);
    await user.type(confirmar, SENHA_FORTE);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(await screen.findByTestId("login")).toBeInTheDocument();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: SENHA_FORTE });
    expect(auth.signOut).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Senha alterada!", expect.anything());
  });

  it("senha igual à anterior: erro traduzido e permanece na tela", async () => {
    auth.updateUser.mockResolvedValue({ error: { code: "same_password", message: "x" } });
    const { senha, confirmar, user } = await irParaSenha();
    await user.type(senha, SENHA_FORTE);
    await user.type(confirmar, SENHA_FORTE);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao alterar senha", {
        description: "A nova senha deve ser diferente da anterior.",
      })
    );
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(screen.queryByTestId("login")).not.toBeInTheDocument();
    expect(senha).toHaveValue(SENHA_FORTE);
  });

  it("sessão expirada no meio do fluxo vira mensagem amigável", async () => {
    auth.updateUser.mockResolvedValue({ error: { message: "Auth session missing!" } });
    const { senha, confirmar, user } = await irParaSenha();
    await user.type(senha, SENHA_FORTE);
    await user.type(confirmar, SENHA_FORTE);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao alterar senha", {
        description: "Sessão expirada. Faça login novamente.",
      })
    );
  });

  describe("com 2FA ativo", () => {
    beforeEach(() => {
      auth.mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "f1", status: "verified" }] } });
    });

    it("exige o código antes de liberar a troca de senha", async () => {
      renderPage();
      expect(await screen.findByText("Verificação em dois fatores")).toBeInTheDocument();
      expect(screen.queryByText("Salvar nova senha")).not.toBeInTheDocument();
    });

    it("código errado avisa e não libera a nova senha", async () => {
      auth.mfa.verify.mockResolvedValue({ error: { message: "Invalid TOTP code entered" } });
      renderPage();
      await screen.findByText("Verificação em dois fatores");
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "000000" } });
      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith("Código inválido", {
          description: "Código incorreto. Tente novamente.",
        })
      );
      expect(screen.queryByText("Nova senha", { selector: "h1" })).not.toBeInTheDocument();
    });

    it("falha no challenge também é tratada", async () => {
      auth.mfa.challenge.mockResolvedValue({ data: null, error: { message: "MFA challenge not found" } });
      renderPage();
      await screen.findByText("Verificação em dois fatores");
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "123456" } });
      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith("Código inválido", {
          description: "Desafio MFA expirado. Tente novamente.",
        })
      );
      expect(auth.mfa.verify).not.toHaveBeenCalled();
    });

    it("código correto libera o formulário de senha", async () => {
      renderPage();
      await screen.findByText("Verificação em dois fatores");
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "123456" } });
      expect(await screen.findByText("Nova senha", { selector: "h1" })).toBeInTheDocument();
      expect(auth.mfa.verify).toHaveBeenCalledWith({ factorId: "f1", challengeId: "ch1", code: "123456" });
    });

    it("código de recuperação inválido não libera", async () => {
      recoverWithBackupCode.mockResolvedValue(false);
      renderPage();
      await screen.findByText("Verificação em dois fatores");
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /Não tenho acesso/ }));
      await user.type(screen.getByPlaceholderText("XXXX-XXXX"), "zzzz-zzzz");
      await user.click(screen.getByRole("button", { name: "Usar código de recuperação" }));
      await waitFor(() => expect(toastError).toHaveBeenCalledWith("Código inválido ou já utilizado"));
      expect(screen.queryByText("Nova senha", { selector: "h1" })).not.toBeInTheDocument();
    });

    it("código de recuperação válido segue para a nova senha", async () => {
      renderPage();
      await screen.findByText("Verificação em dois fatores");
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /Não tenho acesso/ }));
      await user.type(screen.getByPlaceholderText("XXXX-XXXX"), "AAAA-BBBB");
      await user.click(screen.getByRole("button", { name: "Usar código de recuperação" }));
      expect(await screen.findByText("Nova senha", { selector: "h1" })).toBeInTheDocument();
      expect(recoverWithBackupCode).toHaveBeenCalledWith("AAAA-BBBB");
    });
  });

  it("cancela a inscrição de auth ao desmontar", async () => {
    const view = renderPage();
    await screen.findByText("Nova senha", { selector: "h1" });
    view.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
