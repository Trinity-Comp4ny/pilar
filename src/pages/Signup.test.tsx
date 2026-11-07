import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Signup from "./Signup";

const { auth, toastError, toastSuccess, envMock, track } = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), signUp: vi.fn(), resend: vi.fn(), signInWithOAuth: vi.fn() },
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  envMock: { VITE_TURNSTILE_SITE_KEY: "" as string | undefined },
  track: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ analytics: { track } }));
vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@/components/TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (t: string) => void }) => (
    <button type="button" onClick={() => onToken("captcha-ok")}>
      resolver captcha
    </button>
  ),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const SENHA = "Senha#Forte2026";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/signup"]}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/inicio" element={<div data-testid="inicio">Início</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function preencherTudo(
  over: Partial<Record<"nome" | "email" | "tel" | "senha" | "conf" | "empresa", string>> = {}
) {
  const user = userEvent.setup();
  const v = {
    nome: "Ana Souza",
    email: "ana@escritorio.com",
    tel: "11999998888",
    senha: SENHA,
    conf: SENHA,
    empresa: "Escritório Ana",
    ...over,
  };
  const [senha, conf] = screen.getAllByPlaceholderText("••••••••");
  if (v.nome) await user.type(screen.getByPlaceholderText("Seu nome"), v.nome);
  if (v.email) await user.type(screen.getByPlaceholderText("seu@empresa.com"), v.email);
  if (v.tel) await user.type(screen.getByPlaceholderText("(11) 90000-0000"), v.tel);
  if (v.senha) await user.type(senha, v.senha);
  if (v.conf) await user.type(conf, v.conf);
  if (v.empresa) await user.type(screen.getByPlaceholderText("Sua empresa"), v.empresa);
  return user;
}

const botaoCriar = () => screen.getByRole("button", { name: /Criar conta|Criando conta/ });

beforeEach(() => {
  vi.clearAllMocks();
  envMock.VITE_TURNSTILE_SITE_KEY = "";
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.signUp.mockResolvedValue({ data: { user: { id: "u", identities: [{ id: "i" }] } }, error: null });
  auth.resend.mockResolvedValue({ error: null });
  auth.signInWithOAuth.mockResolvedValue({ error: null });
});

describe("Signup", () => {
  it("já autenticado vai para /inicio", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "u" } } } });
    renderPage();
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
  });

  it("formulário vazio mantém o botão desabilitado", () => {
    renderPage();
    expect(botaoCriar()).toBeDisabled();
  });

  it("sem aceitar os termos não habilita o envio nem o Google", async () => {
    renderPage();
    await preencherTudo();
    expect(botaoCriar()).toBeDisabled();
    expect(screen.getByRole("button", { name: /Google/ })).toBeDisabled();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("email inválido mostra erro", async () => {
    renderPage();
    await preencherTudo({ email: "ana.escritorio" });
    expect(await screen.findByText("Email inválido")).toBeInTheDocument();
  });

  it("telefone curto mostra erro", async () => {
    renderPage();
    await preencherTudo({ tel: "1199" });
    expect(await screen.findByText("Informe um celular válido")).toBeInTheDocument();
  });

  it("senha fraca e confirmação divergente são recusadas", async () => {
    renderPage();
    const user = await preencherTudo({ senha: "fraca", conf: "outra" });
    await user.click(screen.getByRole("checkbox"));
    expect(await screen.findByText("Senha deve ter pelo menos 12 caracteres")).toBeInTheDocument();
    expect(screen.getByText("As senhas não coincidem")).toBeInTheDocument();
    expect(botaoCriar()).toBeDisabled();
  });

  it("cadastro válido envia metadados normalizados e mostra 'Confira seu e-mail'", async () => {
    renderPage();
    const user = await preencherTudo({ email: " Ana@Escritorio.com" });
    await user.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(botaoCriar()).toBeEnabled());
    await user.click(botaoCriar());
    expect(await screen.findByText("Confira seu e-mail")).toBeInTheDocument();
    const arg = auth.signUp.mock.calls[0][0];
    expect(arg.email).toBe("ana@escritorio.com");
    expect(arg.password).toBe(SENHA);
    expect(arg.options.data).toMatchObject({
      nome: "Ana Souza",
      company_name: "Escritório Ana",
      terms_accepted: true,
    });
    expect(arg.options.emailRedirectTo).toMatch(/\/auth\/callback$/);
    expect(arg.options.captchaToken).toBeUndefined();
    expect(track).toHaveBeenCalledWith("signup_completed", { method: "email" });
  });

  it("email que já tem conta mostra o caminho de login/recuperação (sem 'Confira seu e-mail')", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: "u", identities: [] } }, error: null });
    renderPage();
    const user = await preencherTudo();
    await user.click(screen.getByRole("checkbox"));
    await user.click(botaoCriar());
    expect(await screen.findByText("Esse e-mail já tem conta")).toBeInTheDocument();
    expect(screen.queryByText("Confira seu e-mail")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Recuperar senha" })).toHaveAttribute("href", "/forgot-password");
  });

  it("cadastro fechado (sem convite) mostra mensagem de negócio, não o erro do banco", async () => {
    auth.signUp.mockResolvedValue({ data: { user: null }, error: { message: "Database error saving new user" } });
    renderPage();
    const user = await preencherTudo();
    await user.click(screen.getByRole("checkbox"));
    await user.click(botaoCriar());
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao criar conta", {
        description: "Este e-mail ainda não tem conta no Pilar. Fale com o time para criar a da sua empresa.",
      })
    );
    expect(JSON.stringify(toastError.mock.calls)).not.toContain("Database error");
    expect(screen.getByPlaceholderText("Seu nome")).toHaveValue("Ana Souza");
    expect(botaoCriar()).toBeEnabled();
  });

  it("senha recusada pelo servidor (weak_password) vira mensagem da política", async () => {
    auth.signUp.mockResolvedValue({ data: { user: null }, error: { code: "weak_password", message: "x" } });
    renderPage();
    const user = await preencherTudo();
    await user.click(screen.getByRole("checkbox"));
    await user.click(botaoCriar());
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao criar conta", {
        description: expect.stringContaining("Senha muito fraca"),
      })
    );
  });

  it("desabilita o botão enquanto cria a conta", async () => {
    let resolver: (v: unknown) => void = () => {};
    auth.signUp.mockReturnValue(new Promise((r) => (resolver = r)));
    renderPage();
    const user = await preencherTudo();
    await user.click(screen.getByRole("checkbox"));
    await user.click(botaoCriar());
    expect(await screen.findByRole("button", { name: /Criando conta/ })).toBeDisabled();
    await user.click(botaoCriar());
    expect(auth.signUp).toHaveBeenCalledTimes(1);
    resolver({ data: { user: { id: "u", identities: [{}] } }, error: null });
    expect(await screen.findByText("Confira seu e-mail")).toBeInTheDocument();
  });

  it("com captcha configurado, só envia depois de resolver e passa o token", async () => {
    envMock.VITE_TURNSTILE_SITE_KEY = "site-key";
    renderPage();
    const user = await preencherTudo();
    await user.click(screen.getByRole("checkbox"));
    expect(botaoCriar()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "resolver captcha" }));
    await waitFor(() => expect(botaoCriar()).toBeEnabled());
    await user.click(botaoCriar());
    await screen.findByText("Confira seu e-mail");
    expect(auth.signUp.mock.calls[0][0].options.captchaToken).toBe("captcha-ok");
  });

  it("reenviar e-mail: sucesso e falha", async () => {
    renderPage();
    const user = await preencherTudo();
    await user.click(screen.getByRole("checkbox"));
    await user.click(botaoCriar());
    await screen.findByText("Confira seu e-mail");
    const reenviar = screen.getByRole("button", { name: /Reenviar/ });
    await user.click(reenviar);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("E-mail reenviado", expect.anything()));
    expect(auth.resend).toHaveBeenCalledWith(expect.objectContaining({ type: "signup", email: "ana@escritorio.com" }));

    auth.resend.mockResolvedValue({ error: { message: "For security purposes, you can only request this after 30s" } });
    await user.click(reenviar);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Não foi possível reenviar", {
        description: "Aguarde alguns segundos e tente de novo.",
      })
    );
  });

  it("erro no Google com termos aceitos mostra toast", async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: { code: "signup_disabled", message: "x" } });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Google/ }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao continuar com Google", {
        description: expect.stringContaining("ainda não tem conta"),
      })
    );
  });
});
