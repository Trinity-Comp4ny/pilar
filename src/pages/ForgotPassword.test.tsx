import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ForgotPassword from "./ForgotPassword";

const { resetPasswordForEmail, toastError } = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { resetPasswordForEmail } } }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/components/AuthPromessa", () => ({ AuthPromessa: () => null }));

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>
  );
}

const botao = () => screen.getByRole("button", { name: /Enviar link de recuperação|Enviando/ });

beforeEach(() => {
  vi.clearAllMocks();
  resetPasswordForEmail.mockResolvedValue({ error: null });
});

describe("ForgotPassword", () => {
  it("email vazio é barrado e não chama o Supabase", async () => {
    renderPage();
    await userEvent.setup().click(botao());
    expect(await screen.findByText("Email inválido")).toBeInTheDocument();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("email mal formatado é barrado", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("seu@empresa.com"), "ana@");
    await user.click(botao());
    expect(await screen.findByText("Email inválido")).toBeInTheDocument();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("sucesso mostra confirmação com o email e redirect para /reset-password", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("seu@empresa.com"), " Ana@Escritorio.com ");
    await user.click(botao());
    expect(await screen.findByText("Email enviado!")).toBeInTheDocument();
    expect(screen.getByText("ana@escritorio.com")).toBeInTheDocument();
    expect(resetPasswordForEmail).toHaveBeenCalledWith("ana@escritorio.com", {
      redirectTo: expect.stringMatching(/\/reset-password$/),
    });
    expect(screen.getByRole("link", { name: "Voltar para o login" })).toHaveAttribute("href", "/login");
  });

  it("rate limit do Supabase vira mensagem em PT e mantém o formulário", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: { code: "over_email_send_rate_limit", message: "email rate limit exceeded" },
    });
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("seu@empresa.com"), "ana@escritorio.com");
    await user.click(botao());
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao enviar", {
        description: "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
      })
    );
    expect(screen.queryByText("Email enviado!")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("seu@empresa.com")).toHaveValue("ana@escritorio.com");
    expect(botao()).toBeEnabled();
  });

  it("erro desconhecido não vaza mensagem técnica", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: "pg: relation auth.users does not exist" } });
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("seu@empresa.com"), "ana@escritorio.com");
    await user.click(botao());
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao enviar", { description: "Erro inesperado. Tente novamente." })
    );
  });

  it("desabilita o botão enquanto envia", async () => {
    let resolver: (v: unknown) => void = () => {};
    resetPasswordForEmail.mockReturnValue(new Promise((r) => (resolver = r)));
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("seu@empresa.com"), "ana@escritorio.com");
    await user.click(botao());
    expect(await screen.findByRole("button", { name: /Enviando/ })).toBeDisabled();
    await user.click(botao());
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    resolver({ error: null });
    expect(await screen.findByText("Email enviado!")).toBeInTheDocument();
  });
});
