import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AcessoPortal } from "@/hooks/useAcessoPortal";

// Acessos ao portal (SPEC 164): e-mail do cadastro já preenchido no primeiro convite,
// vários acessos por cliente, reenviar e revogar um por um, 2FA antes de cada ação.

const h = vi.hoisted(() => ({
  acessos: [] as AcessoPortal[],
  invitePortal: vi.fn(),
  resetPortalPassword: vi.fn(),
  revogar: vi.fn(),
  requireAal2: vi.fn(),
  update: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/useAcessoPortal", () => ({
  linkDoPortal: () => "https://app.test/cliente/login",
  chaveAcessosPortal: (id: string) => ["portal-acesso", id],
  useAcessosPortal: () => ({ data: h.acessos, isLoading: false }),
  revogarAcessoPortal: h.revogar,
}));
vi.mock("@/hooks/useClientes", () => ({
  useClientes: () => ({
    invitePortal: h.invitePortal,
    isInvitingPortal: false,
    resetPortalPassword: h.resetPortalPassword,
  }),
}));
vi.mock("@/hooks/useRequireAal2", () => ({ useRequireAal2: () => h.requireAal2 }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ update: (v: unknown) => ({ eq: (c: string, id: string) => h.update(v, c, id) }) }),
  },
}));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));

import { AcessoPortalDialog } from "./AcessoPortalDialog";

const ANA: AcessoPortal = {
  id: "a1",
  email: "ana@seed.test",
  nome: "Ana",
  status: "ativo",
  ultimoAcesso: null,
};
const MARIA: AcessoPortal = {
  id: "a2",
  email: "maria@seed.test",
  nome: "Maria, esposa",
  status: "convite_pendente",
  ultimoAcesso: null,
};

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
  h.acessos = [];
  h.requireAal2.mockResolvedValue(true);
  h.invitePortal.mockResolvedValue({ email: "ana@seed.test" });
  h.resetPortalPassword.mockResolvedValue({ email: "ana@seed.test" });
  h.revogar.mockResolvedValue(undefined);
  h.update.mockResolvedValue({ error: null });
});

describe("AcessoPortalDialog", () => {
  it("primeiro convite: o e-mail vem do cadastro para o admin conferir e enviar", async () => {
    const { user } = abrir();
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@seed.test");
    expect(screen.getByText("Puxado do cadastro do cliente. Confira antes de enviar.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(h.invitePortal).toHaveBeenCalledWith({ clienteId: "c1", email: "ana@seed.test" }));
    expect(h.update).not.toHaveBeenCalled();
    expect(h.toastSuccess).toHaveBeenCalledWith("Convite enviado", expect.anything());
  });

  it("admin troca o e-mail sugerido antes de enviar", async () => {
    const { user } = abrir();
    await user.clear(screen.getByLabelText("E-mail"));
    await user.type(screen.getByLabelText("E-mail"), "Outro@Seed.test");
    expect(screen.queryByText(/Puxado do cadastro/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(h.invitePortal).toHaveBeenCalledWith({ clienteId: "c1", email: "outro@seed.test" }));
  });

  it("cliente sem e-mail: digita na hora e o e-mail fica no cadastro", async () => {
    h.invitePortal.mockResolvedValue({ email: "novo@seed.test" });
    const { user } = abrir(null);
    expect(screen.getByRole("button", { name: "Enviar convite" })).toBeDisabled();
    await user.type(screen.getByLabelText("E-mail"), "novo@seed.test");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(h.update).toHaveBeenCalledWith({ email: "novo@seed.test" }, "id", "c1"));
  });

  it("com acesso: lista as pessoas e convida mais alguém com nome", async () => {
    h.acessos = [ANA];
    h.invitePortal.mockResolvedValue({ email: "maria@seed.test" });
    const { user } = abrir();
    const lista = screen.getByRole("list", { name: "Acessos ao portal" });
    expect(within(lista).getByText("ana@seed.test")).toBeInTheDocument();
    // O e-mail do cadastro já tem acesso: o campo vem vazio para a pessoa nova.
    expect(screen.getByLabelText("E-mail")).toHaveValue("");
    await user.type(screen.getByLabelText("E-mail"), "maria@seed.test");
    await user.type(screen.getByLabelText("Quem é (opcional)"), "Maria, esposa");
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() =>
      expect(h.invitePortal).toHaveBeenCalledWith({ clienteId: "c1", email: "maria@seed.test", nome: "Maria, esposa" })
    );
    expect(h.update).not.toHaveBeenCalled();
  });

  it("reenvia o convite pendente da pessoa certa", async () => {
    h.acessos = [ANA, MARIA];
    h.resetPortalPassword.mockResolvedValue({ email: "maria@seed.test" });
    const { user } = abrir();
    expect(screen.getByText(/Maria, esposa · Convite enviado/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reenviar convite para maria@seed.test" }));
    await waitFor(() =>
      expect(h.resetPortalPassword).toHaveBeenCalledWith({ clienteId: "c1", nomeCliente: "Ana", accountId: "a2" })
    );
    expect(h.toastSuccess).toHaveBeenCalledWith("Convite reenviado", expect.anything());
  });

  it("revoga um acesso só, com confirmação", async () => {
    h.acessos = [ANA, MARIA];
    const { user } = abrir();
    await user.click(screen.getByRole("button", { name: "Revogar o acesso de maria@seed.test" }));
    await user.click(screen.getByRole("button", { name: "Revogar" }));
    await waitFor(() => expect(h.revogar).toHaveBeenCalledWith("a2"));
    expect(h.toastSuccess).toHaveBeenCalledWith("Acesso revogado", expect.anything());
  });

  it("2FA negado não envia nem revoga nada", async () => {
    h.requireAal2.mockResolvedValue(false);
    h.acessos = [ANA];
    const { user } = abrir();
    await user.click(screen.getByRole("button", { name: "Enviar novo acesso para ana@seed.test" }));
    await user.click(screen.getByRole("button", { name: "Revogar o acesso de ana@seed.test" }));
    await user.click(screen.getByRole("button", { name: "Revogar" }));
    await waitFor(() => expect(h.requireAal2).toHaveBeenCalledTimes(2));
    expect(h.resetPortalPassword).not.toHaveBeenCalled();
    expect(h.revogar).not.toHaveBeenCalled();
  });

  it("falha ao revogar avisa", async () => {
    h.acessos = [ANA];
    h.revogar.mockRejectedValue(new Error("x"));
    const { user } = abrir();
    await user.click(screen.getByRole("button", { name: "Revogar o acesso de ana@seed.test" }));
    await user.click(screen.getByRole("button", { name: "Revogar" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível revogar o acesso", expect.anything())
    );
  });

  it("copia o link do portal", async () => {
    h.acessos = [ANA];
    const { user } = abrir();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: /Copiar link do portal/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://app.test/cliente/login"));
  });
});
