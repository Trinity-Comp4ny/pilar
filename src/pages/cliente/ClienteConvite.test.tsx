import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ClienteConvite from "./ClienteConvite";

const h = vi.hoisted(() => ({ rpc: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: h.rpc } }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));

const SENHA = "Cliente#Senha2026";

function renderPage(url = "/cliente/convite?token=abc") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/cliente/convite" element={<ClienteConvite />} />
        <Route path="/cliente/login" element={<div data-testid="login" />} />
        <Route path="/cliente/dashboard" element={<div data-testid="dashboard" />} />
      </Routes>
    </MemoryRouter>
  );
}

async function preencher(senha: string, conf: string) {
  const user = userEvent.setup();
  const [a, b] = screen.getAllByPlaceholderText("••••••••");
  if (senha) await user.type(a, senha);
  if (conf) await user.type(b, conf);
  return user;
}

const enviar = () => screen.getByRole("button", { name: /Definir senha e entrar|Salvando/ });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  h.rpc.mockResolvedValue({ data: { ok: true, token: "sessao", nome: "Cliente Seed" }, error: null });
});

describe("ClienteConvite", () => {
  it("link sem token mostra 'Link inválido' e leva ao login", async () => {
    renderPage("/cliente/convite");
    expect(screen.getByText("Link inválido")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("••••••••")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Ir para o login" }));
    expect(await screen.findByTestId("login")).toBeInTheDocument();
  });

  it("campos vazios não chamam o servidor", async () => {
    renderPage();
    await userEvent.setup().click(enviar());
    expect(await screen.findByText("Confirme a senha")).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("senha fraca é recusada", async () => {
    renderPage();
    const user = await preencher("senha123", "senha123");
    await user.click(enviar());
    expect(await screen.findByText("Senha deve ter pelo menos 12 caracteres")).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("confirmação diferente é recusada", async () => {
    renderPage();
    const user = await preencher(SENHA, SENHA + "!");
    await user.click(enviar());
    expect(await screen.findByText("As senhas não coincidem")).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("convite expirado/usado: avisa e não cria sessão", async () => {
    h.rpc.mockResolvedValue({ data: { ok: false }, error: null });
    renderPage();
    const user = await preencher(SENHA, SENHA);
    await user.click(enviar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível definir a senha", {
        description: "O convite pode ter expirado. Peça um novo ao escritório.",
      })
    );
    expect(sessionStorage.getItem("pilar_portal_token")).toBeNull();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("mensagem de negócio do servidor é repassada", async () => {
    h.rpc.mockResolvedValue({ data: { ok: false, erro: "Convite já utilizado." }, error: null });
    renderPage();
    const user = await preencher(SENHA, SENHA);
    await user.click(enviar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível definir a senha", {
        description: "Convite já utilizado.",
      })
    );
  });

  it("ok sem token de sessão não entra no portal", async () => {
    h.rpc.mockResolvedValue({ data: { ok: true }, error: null });
    renderPage();
    const user = await preencher(SENHA, SENHA);
    await user.click(enviar());
    await waitFor(() => expect(h.toastError).toHaveBeenCalled());
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("erro de rede/servidor mantém a tela e avisa", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    renderPage();
    const user = await preencher(SENHA, SENHA);
    await user.click(enviar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Falha na conexão", {
        description: "Verifique sua internet e tente novamente.",
      })
    );
    expect(enviar()).toBeEnabled();
  });

  it("sucesso grava o token e entra no portal", async () => {
    renderPage();
    const user = await preencher(SENHA, SENHA);
    await user.click(enviar());
    expect(await screen.findByTestId("dashboard")).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith("portal_convite_definir_senha", { p_token: "abc", p_senha: SENHA });
    expect(sessionStorage.getItem("pilar_portal_token")).toBe("sessao");
  });
});
