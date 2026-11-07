import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "./Login";

const { rpc, signInWithPassword, signInWithOAuth, getSession, getAAL, toastError, toastSuccess } = vi.hoisted(() => ({
  rpc: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  getSession: vi.fn(),
  getAAL: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
    auth: {
      signInWithPassword,
      signInWithOAuth,
      getSession,
      mfa: { getAuthenticatorAssuranceLevel: getAAL },
    },
  },
}));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess, info: vi.fn() } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));
vi.mock("@/components/AuthPromessa", () => ({ AuthPromessa: () => null }));

// Checkbox do Radix mede o tamanho com ResizeObserver; o jsdom não tem.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/inicio" element={<div data-testid="inicio">Início</div>} />
        <Route path="/mfa" element={<div data-testid="mfa">MFA</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function preencher(email: string, senha: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByPlaceholderText("seu@empresa.com"), email);
  if (senha) await user.type(screen.getByPlaceholderText("••••••••"), senha);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  getSession.mockResolvedValue({ data: { session: null } });
  rpc.mockResolvedValue({ data: true, error: null });
  signInWithPassword.mockResolvedValue({ error: null });
  getAAL.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" } });
  signInWithOAuth.mockResolvedValue({ error: null });
});

describe("Login", () => {
  it("já autenticado é levado para /inicio", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u" } } } });
    renderLogin();
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
  });

  it("campos vazios mostram erro e não chamam o Supabase", async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Email inválido")).toBeInTheDocument();
    expect(screen.getByText("Informe a senha")).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("email em formato inválido é barrado no cliente", async () => {
    renderLogin();
    const user = await preencher("nao-e-email", "qualquer");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Email inválido")).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("credencial errada mostra mensagem em PT, sem vazar o erro técnico, e mantém os dados", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials", code: "invalid_credentials", status: 400 },
    });
    renderLogin();
    const user = await preencher("ana@escritorio.com", "senhaErrada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao fazer login", { description: "Email ou senha incorretos." })
    );
    expect(JSON.stringify(toastError.mock.calls)).not.toContain("Invalid login credentials");
    expect(screen.getByPlaceholderText("seu@empresa.com")).toHaveValue("ana@escritorio.com");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(screen.queryByTestId("inicio")).not.toBeInTheDocument();
  });

  it("normaliza o email (trim + minúsculas) antes de enviar", async () => {
    renderLogin();
    const user = await preencher("  Ana@Escritorio.COM ", "Senha#Forte123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({ email: "ana@escritorio.com", password: "Senha#Forte123" })
    );
  });

  it("rate limit: guard negando bloqueia e não tenta autenticar", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    renderLogin();
    const user = await preencher("ana@escritorio.com", "x");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Muitas tentativas", {
        description: "Aguarde 15 minutos antes de tentar novamente.",
      })
    );
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("falha de infra no guard é fail-open (não trava login legítimo)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    renderLogin();
    const user = await preencher("ana@escritorio.com", "x");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(signInWithPassword).toHaveBeenCalled();
  });

  it("erro de rede vira mensagem amigável", async () => {
    signInWithPassword.mockResolvedValue({ error: { name: "AuthRetryableFetchError", message: "" } });
    renderLogin();
    const user = await preencher("ana@escritorio.com", "x");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao fazer login", {
        description: "Falha de conexão. Verifique sua internet.",
      })
    );
  });

  it("email não confirmado orienta a confirmar", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed", message: "Email not confirmed" } });
    renderLogin();
    const user = await preencher("ana@escritorio.com", "x");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao fazer login", {
        description: "Confirme seu email antes de entrar.",
      })
    );
  });

  it("botão fica desabilitado enquanto envia (sem duplo submit)", async () => {
    let resolver: (v: unknown) => void = () => {};
    signInWithPassword.mockReturnValue(new Promise((r) => (resolver = r)));
    renderLogin();
    const user = await preencher("ana@escritorio.com", "x");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    const busy = await screen.findByRole("button", { name: /Entrando/ });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    resolver({ error: null });
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
  });

  it("sucesso marca pós-login, lembra-me e navega para /inicio", async () => {
    renderLogin();
    const user = await preencher("ana@escritorio.com", "x");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith("Login realizado com sucesso!", expect.anything());
    expect(sessionStorage.getItem("pilar_post_login")).toBe("1");
    expect(localStorage.length).toBeGreaterThan(0);
  });

  it("desmarcar lembre-me não persiste a preferência", async () => {
    renderLogin();
    const user = await preencher("ana@escritorio.com", "x");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByTestId("inicio");
    expect(Object.keys(localStorage).some((k) => k.toLowerCase().includes("remember"))).toBe(false);
  });

  it("MFA ativo leva ao desafio sem toast de sucesso", async () => {
    getAAL.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" } });
    renderLogin();
    const user = await preencher("ana@escritorio.com", "x");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByTestId("mfa")).toBeInTheDocument();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("pilar_post_login")).toBeNull();
  });

  it("mostrar/ocultar senha alterna o tipo do campo", async () => {
    renderLogin();
    const user = userEvent.setup();
    const senha = screen.getByPlaceholderText("••••••••");
    expect(senha).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(senha).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(senha).toHaveAttribute("type", "password");
  });

  it("erro no Google mostra toast traduzido", async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: "Email rate limit exceeded" } });
    renderLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Google/ }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao continuar com Google", {
        description: "Muitas tentativas. Aguarde alguns minutos.",
      })
    );
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        options: { redirectTo: expect.stringContaining("/auth/callback") },
      })
    );
  });

  it("link de esqueci a senha aponta para /forgot-password", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: "Esqueceu a senha?" })).toHaveAttribute("href", "/forgot-password");
  });
});
