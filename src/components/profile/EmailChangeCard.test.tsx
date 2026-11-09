import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailChangeCard } from "./EmailChangeCard";

const h = vi.hoisted(() => ({ updateUser: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { updateUser: h.updateUser } } }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));

const onChanged = vi.fn();

async function editar(email: string) {
  const user = userEvent.setup();
  render(<EmailChangeCard currentEmail="Dev@Local.test" onChanged={onChanged} />);
  await user.click(screen.getByRole("button", { name: "Trocar email" }));
  if (email) await user.type(screen.getByPlaceholderText("novo@empresa.com"), email);
  await user.click(screen.getByRole("button", { name: "Enviar confirmação" }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.updateUser.mockResolvedValue({ error: null });
});

describe("EmailChangeCard", () => {
  it("email inválido não chama o Supabase", async () => {
    await editar("sem-arroba");
    expect(h.toastError).toHaveBeenCalledWith("Email inválido");
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it("email igual ao atual (ignorando caixa) é recusado", async () => {
    await editar("  DEV@local.TEST ");
    expect(h.toastError).toHaveBeenCalledWith("Novo email igual ao atual");
  });

  it("envia confirmação com email normalizado e fecha a edição", async () => {
    await editar(" Novo@Seed.Test ");
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("novo@seed.test"));
    expect(h.updateUser).toHaveBeenCalledWith({ email: "novo@seed.test" });
    expect(h.toastSuccess).toHaveBeenCalledWith("Email de confirmação enviado", expect.any(Object));
    expect(screen.getByRole("button", { name: "Trocar email" })).toBeInTheDocument();
  });

  it("erro do Supabase mostra a mensagem e mantém o formulário", async () => {
    h.updateUser.mockResolvedValue({ error: new Error("Email rate limit exceeded") });
    await editar("novo@seed.test");
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao trocar email", { description: "Email rate limit exceeded" })
    );
    expect(screen.getByPlaceholderText("novo@empresa.com")).toHaveValue("novo@seed.test");
  });

  it("erro que não é Error usa mensagem padrão", async () => {
    h.updateUser.mockRejectedValue("falhou");
    await editar("novo@seed.test");
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao trocar email", { description: "Falha ao atualizar email" })
    );
  });

  it("cancelar limpa e volta", async () => {
    const user = userEvent.setup();
    render(<EmailChangeCard currentEmail="dev@local.test" onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: "Trocar email" }));
    await user.type(screen.getByPlaceholderText("novo@empresa.com"), "x@y.z");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Trocar email" }));
    expect(screen.getByPlaceholderText("novo@empresa.com")).toHaveValue("");
  });
});
