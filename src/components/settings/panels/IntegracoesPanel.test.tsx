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
  agenda: { data: { conectado: false, reconectar: false }, isLoading: false, isError: false } as Record<
    string,
    unknown
  >,
  conectarAgenda: vi.fn(),
  desconectarAgenda: vi.fn(),
  definirAviso: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isAdmin: h.isAdmin }) }));
vi.mock("@/hooks/useGoogleDrive", () => ({ CHAVE_STATUS_DRIVE: ["s"], useStatusDrive: () => h.status }));
vi.mock("@/lib/googleDrive", () => ({ conectarGoogleDrive: h.conectar, desconectarDrive: h.desconectar }));
vi.mock("@/hooks/useGoogleAgenda", () => ({
  CHAVE_STATUS_AGENDA: ["a"],
  CHAVE_EVENTOS_AGENDA: ["b"],
  useStatusAgenda: () => h.agenda,
}));
vi.mock("@/lib/googleAgenda", () => ({
  OPCOES_AVISO: [
    { valor: 10, rotulo: "10 minutos antes" },
    { valor: 30, rotulo: "30 minutos antes" },
  ],
  conectarGoogleAgenda: h.conectarAgenda,
  desconectarAgenda: h.desconectarAgenda,
  definirAvisoPadrao: h.definirAviso,
}));
vi.mock("sonner", () => ({ toast: h.toast }));

import { IntegracoesPanel } from "./IntegracoesPanel";

// Select do Radix no jsdom.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

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
  h.agenda = { data: { conectado: false, reconectar: false }, isLoading: false, isError: false };
  h.conectarAgenda.mockResolvedValue(undefined);
  h.desconectarAgenda.mockResolvedValue({ ok: true });
  h.definirAviso.mockResolvedValue(undefined);
});

describe("IntegracoesPanel: Google Agenda", () => {
  it("qualquer pessoa conecta a própria agenda, mesmo sem ser admin", async () => {
    h.isAdmin = false;
    const user = abrir();
    await user.click(screen.getByRole("button", { name: "Conectar Google Agenda" }));
    expect(h.conectarAgenda).toHaveBeenCalled();
  });

  it("acesso revogado no Google pede para reconectar", () => {
    h.agenda = {
      data: { conectado: true, reconectar: true, email: "ana@vrz.com" },
      isLoading: false,
      isError: false,
    };
    abrir();
    expect(screen.getByText(/recusou o acesso/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconectar Google Agenda" })).toBeInTheDocument();
  });

  it("conectado mostra a conta e desconecta com confirmação", async () => {
    h.agenda = {
      data: { conectado: true, reconectar: false, email: "ana@vrz.com", sincronizadoEm: null, lembreteMinutos: 10 },
      isLoading: false,
      isError: false,
    };
    const user = abrir();
    expect(screen.getByText("ana@vrz.com")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Desconectar" }));
    await user.click(screen.getByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(h.desconectarAgenda).toHaveBeenCalled());
    expect(h.toast.success).toHaveBeenCalledWith("Google Agenda desconectado", expect.anything());
  });

  it("muda o aviso padrão das reuniões (10 min de partida)", async () => {
    h.agenda = {
      data: { conectado: true, reconectar: false, email: "ana@vrz.com", sincronizadoEm: null, lembreteMinutos: 10 },
      isLoading: false,
      isError: false,
    };
    const user = abrir();
    const seletor = screen.getByRole("combobox", { name: "Avisar antes das reuniões" });
    expect(seletor).toHaveTextContent("10 minutos antes");
    await user.click(seletor);
    await user.click(await screen.findByRole("option", { name: "Não avisar" }));
    await waitFor(() => expect(h.definirAviso).toHaveBeenCalledWith(null));
    expect(h.toast.success).toHaveBeenCalledWith("Aviso das reuniões atualizado");
  });
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
