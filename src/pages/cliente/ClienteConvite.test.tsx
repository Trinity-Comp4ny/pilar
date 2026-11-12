import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ClienteConvite from "./ClienteConvite";

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  consultar: vi.fn(),
  definir: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

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
  await user.click(await screen.findByRole("button", { name: "Criar conta" }));
  const [a, b] = screen.getAllByPlaceholderText("••••••••");
  if (senha) await user.type(a, senha);
  if (conf) await user.type(b, conf);
  return user;
}

const enviar = () => screen.getByRole("button", { name: /Definir senha e entrar|Salvando/ });

// Formulários longos preenchidos tecla a tecla passam de 5s com a suíte inteira em paralelo.
vi.setConfig({ testTimeout: 15000 });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  h.consultar.mockResolvedValue({
    data: { ok: true, nome: "Cliente Seed", email: "cliente@seed.test", empresa: "Escritório Seed" },
    error: null,
  });
  h.definir.mockResolvedValue({ data: { ok: true, token: "sessao", nome: "Cliente Seed" }, error: null });
  h.rpc.mockImplementation((fn: string) => (fn === "portal_convite_consultar" ? h.consultar() : h.definir()));
});

describe("ClienteConvite", () => {
  it("link sem token mostra 'Link inválido' e leva ao login", async () => {
    renderPage("/cliente/convite");
    expect(screen.getByText("Link inválido")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("••••••••")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Ir para o login" }));
    expect(await screen.findByTestId("login")).toBeInTheDocument();
  });

  it("mostra o escritório que convidou e só entra no formulário ao clicar em Criar conta", async () => {
    renderPage();
    expect(await screen.findByText("Escritório Seed")).toBeInTheDocument();
    expect(screen.getByText("Portal do cliente Pilar")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("••••••••")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByRole("heading", { name: "Crie sua conta" })).toBeInTheDocument();
  });

  it("e-mail do convite aparece preenchido e travado", async () => {
    renderPage();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Criar conta" }));
    const email = await screen.findByLabelText("E-mail");
    expect(email).toHaveValue("cliente@seed.test");
    expect(email).toBeDisabled();
  });

  it("checklist marca cada requisito conforme a senha é digitada", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Criar conta" }));
    const [a] = screen.getAllByPlaceholderText("••••••••");
    const lista = screen.getByRole("list", { name: "Requisitos da senha" });
    expect(lista).toHaveTextContent("Pelo menos 12 caracteres");
    await user.type(a, SENHA);
    expect(lista.querySelectorAll("svg.lucide-check")).toHaveLength(5);
  });

  it("convite expirado na abertura mostra aviso e não libera o formulário", async () => {
    h.consultar.mockResolvedValue({ data: { ok: false, erro: "Convite inválido ou expirado" }, error: null });
    renderPage();
    expect(await screen.findByText("Link inválido")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar conta" })).not.toBeInTheDocument();
  });

  it("campos vazios não chamam o servidor", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Criar conta" }));
    await user.click(enviar());
    expect(await screen.findByText("Confirme a senha")).toBeInTheDocument();
    expect(h.definir).not.toHaveBeenCalled();
  });

  it("senha fraca é recusada", async () => {
    renderPage();
    const user = await preencher("senha123", "senha123");
    await user.click(enviar());
    expect(await screen.findByText("Senha deve ter pelo menos 12 caracteres")).toBeInTheDocument();
    expect(h.definir).not.toHaveBeenCalled();
  });

  it("confirmação diferente é recusada", async () => {
    renderPage();
    const user = await preencher(SENHA, SENHA + "!");
    await user.click(enviar());
    expect(await screen.findByText("As senhas não coincidem")).toBeInTheDocument();
    expect(h.definir).not.toHaveBeenCalled();
  });

  it("convite expirado/usado: avisa e não cria sessão", async () => {
    h.definir.mockResolvedValue({ data: { ok: false }, error: null });
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
    h.definir.mockResolvedValue({ data: { ok: false, erro: "Convite já utilizado." }, error: null });
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
    h.definir.mockResolvedValue({ data: { ok: true }, error: null });
    renderPage();
    const user = await preencher(SENHA, SENHA);
    await user.click(enviar());
    await waitFor(() => expect(h.toastError).toHaveBeenCalled());
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("erro de rede/servidor mantém a tela e avisa", async () => {
    h.definir.mockResolvedValue({ data: null, error: { message: "boom" } });
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
