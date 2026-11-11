import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  isAdmin: true,
  status: { data: { conectado: false, email: null, conectadoEm: null }, isLoading: false, isError: false } as Record<
    string,
    unknown
  >,
  conectar: vi.fn(),
  desconectar: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isAdmin: h.isAdmin }) }));
vi.mock("@/hooks/useGoogleDrive", () => ({ CHAVE_STATUS_DRIVE: ["s"], useStatusDrive: () => h.status }));
vi.mock("@/lib/googleDrive", () => ({ conectarGoogleDrive: h.conectar, desconectarDrive: h.desconectar }));
vi.mock("sonner", () => ({ toast: h.toast }));

import { IntegracoesPanel } from "./IntegracoesPanel";

const abrir = () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IntegracoesPanel />
    </QueryClientProvider>
  );
  return userEvent.setup();
};

beforeEach(() => {
  vi.clearAllMocks();
  h.isAdmin = true;
  h.status = { data: { conectado: false, email: null, conectadoEm: null }, isLoading: false, isError: false };
  h.conectar.mockResolvedValue(undefined);
  h.desconectar.mockResolvedValue({ ok: true });
});

describe("IntegracoesPanel: Google Drive", () => {
  it("admin conecta: o botão fica esperando enquanto vai para o Google", async () => {
    const user = abrir();
    await user.click(screen.getByRole("button", { name: "Conectar Google Drive" }));
    expect(h.conectar).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Conectar Google Drive" })).toBeDisabled();
  });

  it("falha ao abrir o Google avisa e libera o botão", async () => {
    h.conectar.mockRejectedValueOnce(new Error("x"));
    const user = abrir();
    await user.click(screen.getByRole("button", { name: "Conectar Google Drive" }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Conectar Google Drive" })).toBeEnabled();
  });

  it("membro não conecta: pede ao admin", () => {
    h.isAdmin = false;
    abrir();
    expect(screen.queryByRole("button", { name: "Conectar Google Drive" })).not.toBeInTheDocument();
    expect(screen.getByText(/Peça ao admin/)).toBeInTheDocument();
  });

  it("conectado mostra a conta e o admin desconecta com confirmação", async () => {
    h.status = {
      data: { conectado: true, email: "drive@vrz.com", conectadoEm: null },
      isLoading: false,
      isError: false,
    };
    const user = abrir();
    expect(screen.getByText("drive@vrz.com")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Desconectar" }));
    await user.click(await screen.findByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(h.desconectar).toHaveBeenCalled());
    expect(h.toast.success).toHaveBeenCalledWith("Google Drive desconectado", expect.anything());
  });
});
