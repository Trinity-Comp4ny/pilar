import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ClienteLogin from "./ClienteLogin";

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: h.rpc } }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess, info: h.toastInfo } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));

function renderPage(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/cliente/login", state }]}>
      <Routes>
        <Route path="/cliente/login" element={<ClienteLogin />} />
        <Route path="/cliente/dashboard" element={<div data-testid="dashboard" />} />
      </Routes>
    </MemoryRouter>
  );
}

async function preencher(email: string, senha: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByPlaceholderText("seu@email.com"), email);
  if (senha) await user.type(screen.getByPlaceholderText("••••••••"), senha);
  return user;
}

const entrar = () => screen.getByRole("button", { name: /Entrar|Entrando/ });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  h.rpc.mockResolvedValue({ data: { token: "tok-novo", nome: "Cliente Seed" }, error: null });
});

describe("ClienteLogin (portal)", () => {
  it("campos vazios mostram erro e não chamam o servidor", async () => {
    renderPage();
    await userEvent.setup().click(entrar());
    expect(await screen.findByText("Email inválido")).toBeInTheDocument();
    expect(screen.getByText("Informe a senha")).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("email inválido é barrado", async () => {
    renderPage();
    const user = await preencher("cliente@", "x");
    await user.click(entrar());
    expect(await screen.findByText("Email inválido")).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("credencial errada (RPC devolve vazio) mostra mensagem genérica, sem dizer o que errou", async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    renderPage();
    const user = await preencher("cliente@obra.com", "errada");
    await user.click(entrar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao fazer login", { description: "Email ou senha inválidos." })
    );
    expect(sessionStorage.getItem("pilar_portal_token")).toBeNull();
    expect(screen.getByPlaceholderText("seu@email.com")).toHaveValue("cliente@obra.com");
  });

  it("erro do servidor (ex.: bloqueio) não vaza detalhe técnico", async () => {
    h.rpc.mockResolvedValue({
      data: null,
      error: { message: "conta bloqueada: 5 tentativas (portal_login_attempts)" },
    });
    renderPage();
    const user = await preencher("cliente@obra.com", "x");
    await user.click(entrar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao fazer login", { description: "Email ou senha inválidos." })
    );
    expect(JSON.stringify(h.toastError.mock.calls)).not.toContain("portal_login_attempts");
  });

  it("falha de rede mostra 'Falha na conexão'", async () => {
    h.rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    renderPage();
    const user = await preencher("cliente@obra.com", "x");
    await user.click(entrar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Falha na conexão", {
        description: "Verifique sua internet e tente novamente.",
      })
    );
    expect(entrar()).toBeEnabled();
  });

  it("sucesso guarda o token e vai ao dashboard", async () => {
    renderPage();
    const user = await preencher("  Cliente@Obra.com", "Senha#2026abc");
    await user.click(entrar());
    expect(await screen.findByTestId("dashboard")).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith("portal_login", { p_email: "cliente@obra.com", p_senha: "Senha#2026abc" });
    expect(sessionStorage.getItem("pilar_portal_token")).toBe("tok-novo");
    expect(h.toastSuccess).toHaveBeenCalledWith("Login realizado!", { description: "Bem-vindo, Cliente Seed." });
  });

  it("desabilita o botão durante o envio", async () => {
    let liberar: (v: unknown) => void = () => {};
    h.rpc.mockReturnValue(new Promise((r) => (liberar = r)));
    renderPage();
    const user = await preencher("cliente@obra.com", "x");
    await user.click(entrar());
    expect(await screen.findByRole("button", { name: /Entrando/ })).toBeDisabled();
    await user.click(entrar());
    expect(h.rpc).toHaveBeenCalledTimes(1);
    liberar({ data: { token: "t", nome: "C" }, error: null });
    expect(await screen.findByTestId("dashboard")).toBeInTheDocument();
  });

  it("chegando por sessão expirada explica o motivo", () => {
    renderPage({ reason: "expired" });
    expect(h.toastInfo).toHaveBeenCalledWith("Sua sessão expirou", { description: "Entre novamente para continuar." });
  });

  it("token salvo válido (checagem read-only) redireciona sem rotacionar", async () => {
    sessionStorage.setItem("pilar_portal_token", "tok");
    h.rpc.mockResolvedValue({ data: { id: "c1" }, error: null });
    renderPage();
    expect(await screen.findByTestId("dashboard")).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith("portal_verify_session_readonly", { p_token: "tok" });
    expect(h.rpc).not.toHaveBeenCalledWith("portal_verify_session", expect.anything());
  });

  it("token salvo inválido mantém na tela de login", async () => {
    sessionStorage.setItem("pilar_portal_token", "tok");
    h.rpc.mockResolvedValue({ data: null, error: null });
    renderPage();
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("recuperar acesso abre e-mail ao suporte", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Recuperar acesso" }).getAttribute("href")).toMatch(
      /^mailto:suporte@pilarsoft\.com\.br/
    );
  });
});
