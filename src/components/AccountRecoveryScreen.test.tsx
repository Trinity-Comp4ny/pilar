import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AccountRecoveryScreen } from "./AccountRecoveryScreen";

const { rpc, refreshSession, refreshProfile, signOut, captureException, auth } = vi.hoisted(() => ({
  rpc: vi.fn(),
  refreshSession: vi.fn(),
  refreshProfile: vi.fn(),
  signOut: vi.fn(),
  captureException: vi.fn(),
  auth: { profileError: false },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "bia", email: "bia@test.com" }, ...auth, refreshProfile, signOut }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, auth: { refreshSession } } }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  auth.profileError = false;
  rpc.mockResolvedValue({ data: null, error: null });
  refreshSession.mockResolvedValue({ error: null });
  refreshProfile.mockResolvedValue(undefined);
});

describe("AccountRecoveryScreen", () => {
  it("sem convite orienta o administrador e permite verificar de novo e sair", async () => {
    render(<AccountRecoveryScreen />);
    expect(await screen.findByText(/Sua conta não está ligada/)).toBeInTheDocument();
    expect(screen.getByText("bia@test.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("recuperação atualiza o JWT antes de recarregar o profile", async () => {
    rpc.mockResolvedValue({ data: "bia", error: null });
    render(<AccountRecoveryScreen />);
    await waitFor(() => expect(refreshProfile).toHaveBeenCalledOnce());
    expect(rpc).toHaveBeenCalledWith("aceitar_convite_pendente");
    expect(refreshSession.mock.invocationCallOrder[0]).toBeLessThan(refreshProfile.mock.invocationCallOrder[0]);
  });

  it("falha da RPC chega ao monitoramento e permite retry", async () => {
    const error = { message: "network failure" };
    rpc.mockResolvedValueOnce({ data: null, error });
    render(<AccountRecoveryScreen />);
    expect(await screen.findByText(/Não foi possível verificar/)).toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith(error, expect.objectContaining({ context: "account-recovery" }));
    fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" }));
    expect(await screen.findByText(/Sua conta não está ligada/)).toBeInTheDocument();
  });

  it("erro ao carregar profile não consome convite; retry consulta o profile primeiro", async () => {
    auth.profileError = true;
    const view = render(<AccountRecoveryScreen />);
    expect(screen.getByText(/Não foi possível verificar/)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" }));
    await waitFor(() => expect(refreshProfile).toHaveBeenCalledOnce());
    expect(rpc).not.toHaveBeenCalled();
    auth.profileError = false;
    view.rerender(<AccountRecoveryScreen />);
    expect(await screen.findByText(/Sua conta não está ligada/)).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("falha ao renovar sessão mantém erro recuperável", async () => {
    rpc.mockResolvedValue({ data: "bia", error: null });
    refreshSession.mockResolvedValue({ error: new Error("refresh failed") });
    render(<AccountRecoveryScreen />);
    expect(await screen.findByText(/Não foi possível verificar/)).toBeInTheDocument();
    expect(refreshProfile).not.toHaveBeenCalled();
  });
});
