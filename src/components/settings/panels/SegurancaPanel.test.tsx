import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegurancaPanel } from "./SegurancaPanel";

const h = vi.hoisted(() => ({
  signOut: vi.fn(),
  updateUser: vi.fn(),
  verifyCurrentPassword: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  email: "ana@seed.test" as string | undefined,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: h.signOut, updateUser: h.updateUser } },
}));
vi.mock("@/lib/supabase", () => ({ verifyCurrentPassword: h.verifyCurrentPassword }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: h.email ? { email: h.email } : null }) }));
vi.mock("@/components/MfaSetup", () => ({ MfaSetup: () => <div data-testid="mfa-setup" /> }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));

const ATUAL = "Atual#Senha2025";
const NOVA = "Nova#Senha2026x";

async function abrirTroca() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Trocar senha" }));
  const [atual, nova, conf] = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]'));
  return { user, atual, nova, conf };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.email = "ana@seed.test";
  h.signOut.mockResolvedValue({ error: null });
  h.updateUser.mockResolvedValue({ error: null });
  h.verifyCurrentPassword.mockResolvedValue(null);
});

describe("Configurações › Segurança", () => {
  it("mostra 2FA, senha e outros dispositivos", () => {
    render(<SegurancaPanel />);
    expect(screen.getByTestId("mfa-setup")).toBeInTheDocument();
    expect(screen.getByText("Autenticação em dois fatores")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair dos outros dispositivos/ })).toBeInTheDocument();
  });

  it("senha nova fraca é recusada antes de verificar a atual", async () => {
    render(<SegurancaPanel />);
    const { user, atual, nova, conf } = await abrirTroca();
    await user.type(atual, ATUAL);
    await user.type(nova, "fraca");
    await user.type(conf, "fraca");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(h.toastError).toHaveBeenCalledWith("Senha nova não atende aos requisitos", {
      description: "Senha deve ter pelo menos 12 caracteres",
    });
    expect(h.verifyCurrentPassword).not.toHaveBeenCalled();
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it("confirmação diferente é recusada", async () => {
    render(<SegurancaPanel />);
    const { user, atual, nova, conf } = await abrirTroca();
    await user.type(atual, ATUAL);
    await user.type(nova, NOVA);
    await user.type(conf, NOVA + "1");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(h.toastError).toHaveBeenCalledWith("As senhas não coincidem");
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it("senha atual errada não troca a senha", async () => {
    h.verifyCurrentPassword.mockResolvedValue({ code: "invalid_credentials", message: "Invalid login credentials" });
    render(<SegurancaPanel />);
    const { user, atual, nova, conf } = await abrirTroca();
    await user.type(atual, "errada");
    await user.type(nova, NOVA);
    await user.type(conf, NOVA);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Senha atual incorreta", { description: undefined }));
    expect(h.updateUser).not.toHaveBeenCalled();
    expect(nova).toHaveValue(NOVA);
  });

  it("muitas tentativas na verificação viram mensagem de espera", async () => {
    h.verifyCurrentPassword.mockResolvedValue({ code: "over_request_rate_limit", message: "x" });
    render(<SegurancaPanel />);
    const { user, atual, nova, conf } = await abrirTroca();
    await user.type(atual, ATUAL);
    await user.type(nova, NOVA);
    await user.type(conf, NOVA);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao confirmar a senha atual", {
        description: "Muitas tentativas. Aguarde alguns minutos.",
      })
    );
  });

  it("sem email na sessão não tenta trocar", async () => {
    h.email = undefined;
    render(<SegurancaPanel />);
    const { user, atual, nova, conf } = await abrirTroca();
    await user.type(atual, ATUAL);
    await user.type(nova, NOVA);
    await user.type(conf, NOVA);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(h.toastError).toHaveBeenCalledWith("Email não disponível");
    expect(h.verifyCurrentPassword).not.toHaveBeenCalled();
  });

  it("sucesso verifica a atual, troca e fecha o formulário", async () => {
    render(<SegurancaPanel />);
    const { user, atual, nova, conf } = await abrirTroca();
    await user.type(atual, ATUAL);
    await user.type(nova, NOVA);
    await user.type(conf, NOVA);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Senha atualizada"));
    expect(h.verifyCurrentPassword).toHaveBeenCalledWith("ana@seed.test", ATUAL);
    expect(h.updateUser).toHaveBeenCalledWith({ password: NOVA });
    expect(screen.getByRole("button", { name: "Trocar senha" })).toBeInTheDocument();
  });

  it("senha igual à anterior (servidor) mostra o motivo", async () => {
    h.updateUser.mockResolvedValue({ error: { code: "same_password", message: "x" } });
    render(<SegurancaPanel />);
    const { user, atual, nova, conf } = await abrirTroca();
    await user.type(atual, ATUAL);
    await user.type(nova, NOVA);
    await user.type(conf, NOVA);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao trocar senha", {
        description: "A nova senha deve ser diferente da anterior.",
      })
    );
  });

  it("Cancelar limpa e fecha o formulário", async () => {
    render(<SegurancaPanel />);
    const { user, atual } = await abrirTroca();
    await user.type(atual, "abc");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Trocar senha" }));
    expect(document.querySelector<HTMLInputElement>('input[type="password"]')).toHaveValue("");
  });

  it("sair dos outros dispositivos usa escopo 'others' (mantém esta sessão)", async () => {
    render(<SegurancaPanel />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Sair dos outros dispositivos/ }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Outros dispositivos desconectados"));
    expect(h.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("falha ao sair dos outros dispositivos avisa", async () => {
    h.signOut.mockResolvedValue({ error: { message: "Auth session missing!" } });
    render(<SegurancaPanel />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Sair dos outros dispositivos/ }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível desconectar", {
        description: "Sessão expirada. Faça login novamente.",
      })
    );
  });
});
