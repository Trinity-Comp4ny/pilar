import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Diálogo de acesso ao portal: os três estados (sem acesso, convite pendente,
// ativo), o e-mail editável, o 2FA e o e-mail guardado no cliente sem cadastro.

const h = vi.hoisted(() => ({
  acesso: { status: "sem_acesso", email: null } as { status: string; email: string | null },
  invitePortal: vi.fn(),
  resetPortalPassword: vi.fn(),
  requireAal2: vi.fn(),
  update: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/useAcessoPortal", () => ({
  linkDoPortal: () => "https://app.test/cliente/login",
  useAcessoPortal: () => ({ data: h.acesso, isLoading: false }),
}));
vi.mock("@/hooks/useClientes", () => ({
  useClientes: () => ({
    invitePortal: h.invitePortal,
    isInvitingPortal: false,
    resetPortalPassword: h.resetPortalPassword,
    isResettingPortal: false,
  }),
}));
vi.mock("@/hooks/useRequireAal2", () => ({ useRequireAal2: () => h.requireAal2 }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ update: (v: unknown) => ({ eq: (c: string, id: string) => h.update(v, c, id) }) }),
  },
}));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: vi.fn() } }));

import { AcessoPortalDialog } from "./AcessoPortalDialog";

function abrir(email: string | null = "ana@seed.test") {
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AcessoPortalDialog open onOpenChange={onOpenChange} clienteId="c1" clienteNome="Ana" clienteEmail={email} />
    </QueryClientProvider>
  );
  return { onOpenChange, user: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.acesso = { status: "sem_acesso", email: null };
  h.requireAal2.mockResolvedValue(true);
  h.invitePortal.mockResolvedValue({ email: "ana@seed.test" });
  h.resetPortalPassword.mockResolvedValue({ email: "ana@seed.test" });
  h.update.mockResolvedValue({ error: null });
});

describe("AcessoPortalDialog", () => {
  it("sem acesso: envia o convite para o e-mail do cadastro e fecha", async () => {
    const { onOpenChange, user } = abrir();
    expect(screen.getByLabelText("E-mail do cliente")).toHaveValue("ana@seed.test");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(h.invitePortal).toHaveBeenCalledWith({ clienteId: "c1", email: "ana@seed.test" }));
    expect(h.update).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cliente sem e-mail: digita na hora e o e-mail fica no cadastro", async () => {
    h.invitePortal.mockResolvedValue({ email: "novo@seed.test" });
    const { user } = abrir(null);
    const enviar = screen.getByRole("button", { name: "Enviar convite" });
    expect(enviar).toBeDisabled();
    await user.type(screen.getByLabelText("E-mail do cliente"), "Novo@Seed.test");
    await user.click(enviar);
    await waitFor(() => expect(h.invitePortal).toHaveBeenCalledWith({ clienteId: "c1", email: "novo@seed.test" }));
    expect(h.update).toHaveBeenCalledWith({ email: "novo@seed.test" }, "id", "c1");
  });

  it("2FA negado não envia nada", async () => {
    h.requireAal2.mockResolvedValue(false);
    const { user } = abrir();
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(h.requireAal2).toHaveBeenCalled());
    expect(h.invitePortal).not.toHaveBeenCalled();
  });

  it("falha no convite mantém o diálogo aberto", async () => {
    h.invitePortal.mockRejectedValue(new Error("x"));
    const { onOpenChange, user } = abrir();
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(h.invitePortal).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("convite pendente: reenvia pelo novo link", async () => {
    h.acesso = { status: "convite_pendente", email: "ana@seed.test" };
    const { user } = abrir();
    expect(screen.getByText(/ainda não aceito/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reenviar convite" }));
    await waitFor(() => expect(h.resetPortalPassword).toHaveBeenCalledWith({ clienteId: "c1", nomeCliente: "Ana" }));
  });

  it("ativo: copia o link do portal", async () => {
    h.acesso = { status: "ativo", email: "ana@seed.test" };
    const { user } = abrir();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await user.click(screen.getByRole("button", { name: "Copiar link do portal" }));
    expect(writeText).toHaveBeenCalledWith("https://app.test/cliente/login");
    expect(h.resetPortalPassword).not.toHaveBeenCalled();
  });
});
