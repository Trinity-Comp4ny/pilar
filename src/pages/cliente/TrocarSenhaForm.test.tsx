import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrocarSenhaForm } from "./TrocarSenhaForm";
import ForcarTrocaSenha from "./ForcarTrocaSenha";

const h = vi.hoisted(() => ({ rpc: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: h.rpc } }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));

const ATUAL = "Atual#Senha2025";
const NOVA = "Nova#Senha2026x";

async function preencher(atual: string, nova: string, conf: string) {
  const user = userEvent.setup();
  const [a, b, c] = screen.getAllByPlaceholderText("••••••••");
  if (atual) await user.type(a, atual);
  if (nova) await user.type(b, nova);
  if (conf) await user.type(c, conf);
  return user;
}

const salvar = () => screen.getByRole("button", { name: /Salvar nova senha|Salvando/ });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  sessionStorage.setItem("pilar_portal_token", "tok");
  h.rpc.mockResolvedValue({ data: { ok: true }, error: null });
});

describe("TrocarSenhaForm (portal)", () => {
  it("vazio: erros por campo e nada enviado", async () => {
    render(<TrocarSenhaForm onSuccess={vi.fn()} />);
    await userEvent.setup().click(salvar());
    expect(await screen.findByText("Informe a senha atual")).toBeInTheDocument();
    expect(screen.getByText("Confirme a nova senha")).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("nova senha igual à atual é recusada no cliente", async () => {
    render(<TrocarSenhaForm onSuccess={vi.fn()} />);
    const user = await preencher(ATUAL, ATUAL, ATUAL);
    await user.click(salvar());
    expect(await screen.findByText("A nova senha deve ser diferente da atual")).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("nova senha fraca e confirmação divergente são recusadas", async () => {
    render(<TrocarSenhaForm onSuccess={vi.fn()} />);
    const user = await preencher(ATUAL, "fraca", "outra");
    await user.click(salvar());
    expect(await screen.findByText("Senha deve ter pelo menos 12 caracteres")).toBeInTheDocument();
    expect(screen.getByText("As senhas não coincidem")).toBeInTheDocument();
  });

  it("senha atual incorreta marca o campo e avisa", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "Senha atual incorreta" } });
    const onSuccess = vi.fn();
    render(<TrocarSenhaForm onSuccess={onSuccess} />);
    const user = await preencher("errada#Senha1", NOVA, NOVA);
    await user.click(salvar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao trocar senha", { description: "Senha atual incorreta" })
    );
    expect(await screen.findByText("Senha atual incorreta", { selector: "p" })).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("erro desconhecido do servidor vira mensagem genérica", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'relation "portal_accounts" does not exist' } });
    render(<TrocarSenhaForm onSuccess={vi.fn()} />);
    const user = await preencher(ATUAL, NOVA, NOVA);
    await user.click(salvar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao trocar senha", {
        description: "Não foi possível trocar a senha. Tente novamente.",
      })
    );
  });

  it("sem token do portal pede novo login e não chama o servidor", async () => {
    sessionStorage.clear();
    render(<TrocarSenhaForm onSuccess={vi.fn()} />);
    const user = await preencher(ATUAL, NOVA, NOVA);
    await user.click(salvar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Sessão expirada", {
        description: "Entre novamente para trocar a senha.",
      })
    );
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("falha de rede avisa e mantém os dados", async () => {
    h.rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<TrocarSenhaForm onSuccess={vi.fn()} />);
    const user = await preencher(ATUAL, NOVA, NOVA);
    await user.click(salvar());
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Falha na conexão", expect.anything()));
    expect(screen.getAllByPlaceholderText("••••••••")[1]).toHaveValue(NOVA);
    expect(salvar()).toBeEnabled();
  });

  it("sucesso chama o RPC com o token e limpa o formulário", async () => {
    const onSuccess = vi.fn();
    render(<TrocarSenhaForm onSuccess={onSuccess} onCancel={vi.fn()} />);
    const user = await preencher(ATUAL, NOVA, NOVA);
    await user.click(salvar());
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(h.rpc).toHaveBeenCalledWith("portal_change_password", {
      p_token: "tok",
      p_senha_atual: ATUAL,
      p_nova_senha: NOVA,
    });
    expect(screen.getAllByPlaceholderText("••••••••")[0]).toHaveValue("");
  });

  it("Cancelar aparece fora do modo forçado", async () => {
    const onCancel = vi.fn();
    render(<TrocarSenhaForm onSuccess={vi.fn()} onCancel={onCancel} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("modo forçado (ForcarTrocaSenha) não oferece cancelar", () => {
    render(<ForcarTrocaSenha onSuccess={vi.fn()} />);
    expect(screen.getByText("Defina sua senha")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });

  it("desabilita enquanto salva", async () => {
    let liberar: (v: unknown) => void = () => {};
    h.rpc.mockReturnValue(new Promise((r) => (liberar = r)));
    render(<TrocarSenhaForm onSuccess={vi.fn()} />);
    const user = await preencher(ATUAL, NOVA, NOVA);
    await user.click(salvar());
    expect(await screen.findByRole("button", { name: /Salvando/ })).toBeDisabled();
    liberar({ data: { ok: true }, error: null });
    await waitFor(() => expect(salvar()).toBeEnabled());
  });
});
