import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Troca de senha: cada rótulo aponta para o seu campo (leitor de tela e clique
// no rótulo), e a troca só acontece depois de confirmar a senha atual.

const h = vi.hoisted(() => ({
  verifyCurrentPassword: vi.fn(),
  updateUser: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { updateUser: h.updateUser } } }));
vi.mock("@/lib/supabase", () => ({ verifyCurrentPassword: h.verifyCurrentPassword }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/components/PasswordRequirements", () => ({ PasswordRequirements: () => null }));

import { PasswordChangeCard } from "./PasswordChangeCard";

beforeEach(() => {
  vi.clearAllMocks();
  h.verifyCurrentPassword.mockResolvedValue(null);
  h.updateUser.mockResolvedValue({ error: null });
});

describe("PasswordChangeCard", () => {
  it("rótulos ligados aos campos de senha", async () => {
    const user = userEvent.setup();
    render(<PasswordChangeCard currentEmail="dev@local.test" />);
    await user.click(screen.getByRole("button", { name: "Trocar senha" }));
    const atual = screen.getByLabelText("Senha atual");
    const nova = screen.getByLabelText("Nova senha");
    const confirmar = screen.getByLabelText("Confirmar nova senha");
    expect(atual).toHaveAttribute("autocomplete", "current-password");
    expect(nova).toHaveAttribute("autocomplete", "new-password");
    expect(confirmar).toHaveAttribute("autocomplete", "new-password");
    expect(new Set([atual.id, nova.id, confirmar.id]).size).toBe(3);
  });

  it("confirma a senha atual antes de gravar a nova", async () => {
    const user = userEvent.setup();
    render(<PasswordChangeCard currentEmail="dev@local.test" />);
    await user.click(screen.getByRole("button", { name: "Trocar senha" }));
    await user.type(screen.getByLabelText("Senha atual"), "antiga");
    await user.type(screen.getByLabelText("Nova senha"), "Nova#Senha2026");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "Nova#Senha2026");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(h.verifyCurrentPassword).toHaveBeenCalledWith("dev@local.test", "antiga");
    expect(h.updateUser).toHaveBeenCalledWith({ password: "Nova#Senha2026" });
    expect(h.toastSuccess).toHaveBeenCalledWith("Senha atualizada");
  });
});
