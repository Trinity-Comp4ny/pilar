import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EventoAgenda } from "@/lib/googleAgenda";

const h = vi.hoisted(() => ({
  criar: vi.fn(),
  editar: vi.fn(),
  excluir: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() }, rpc: vi.fn() } }));
vi.mock("@/lib/googleAgenda", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/googleAgenda")>()),
  criarReuniao: h.criar,
  editarReuniao: h.editar,
  excluirReuniao: h.excluir,
}));
vi.mock("sonner", () => ({ toast: h.toast }));

import { ReuniaoDialog } from "./ReuniaoDialog";

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const REUNIAO: EventoAgenda = {
  id: "r1",
  titulo: "Reunião com a VRZ",
  inicio: "2026-11-20T17:00:00.000Z",
  fim: "2026-11-20T18:00:00.000Z",
  dia_inteiro: false,
  local: "Escritório",
  descricao: "Pauta",
  convidados: ["cliente@vrz.com"],
  link_reuniao: "https://meet.google.com/abc",
  link_google: "https://www.google.com/calendar/event?eid=1",
  pode_editar: true,
  lembrete_minutos: 30,
};

function abrir(reuniao: EventoAgenda | null = null) {
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReuniaoDialog open onOpenChange={onOpenChange} reuniao={reuniao} diaInicial="2026-11-20" avisoPadrao={10} />
    </QueryClientProvider>
  );
  return { user: userEvent.setup(), onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.criar.mockResolvedValue({ ok: true, evento: { id: "novo" } });
  h.editar.mockResolvedValue({ ok: true });
  h.excluir.mockResolvedValue({ ok: true });
});

describe("ReuniaoDialog", () => {
  it("cria reunião com Meet, convidados e o aviso padrão", async () => {
    const { user, onOpenChange } = abrir();
    expect(screen.getByRole("combobox", { name: "Aviso" })).toHaveTextContent("Padrão (10 minutos antes)");
    await user.type(screen.getByLabelText("Título"), "Alinhamento");
    await user.clear(screen.getByLabelText("Início"));
    await user.type(screen.getByLabelText("Início"), "14:00");
    await user.clear(screen.getByLabelText("Fim"));
    await user.type(screen.getByLabelText("Fim"), "15:00");
    await user.type(screen.getByLabelText("Convidados"), "Cliente@VRZ.com, socio@vrz.com");
    await user.click(screen.getByRole("button", { name: "Criar reunião" }));

    await waitFor(() => expect(h.criar).toHaveBeenCalled());
    const dados = h.criar.mock.calls[0][0];
    expect(dados).toMatchObject({
      titulo: "Alinhamento",
      dia_inteiro: false,
      convidados: ["cliente@vrz.com", "socio@vrz.com"],
      meet: true,
      lembrete_minutos: null,
    });
    expect(new Date(dados.fim).getTime() - new Date(dados.inicio).getTime()).toBe(60 * 60 * 1000);
    expect(h.toast.success).toHaveBeenCalledWith("Reunião criada", expect.anything());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("não salva sem título, com convidado inválido ou fim antes do início", async () => {
    const { user } = abrir();
    await user.click(screen.getByRole("button", { name: "Criar reunião" }));
    expect(h.toast.error).toHaveBeenCalledWith("Dê um título para a reunião");

    await user.type(screen.getByLabelText("Título"), "X");
    await user.type(screen.getByLabelText("Convidados"), "sem-arroba");
    expect(screen.getByText("E-mail inválido: sem-arroba")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar reunião" }));
    expect(h.toast.error).toHaveBeenCalledWith("E-mail de convidado inválido", expect.anything());

    await user.clear(screen.getByLabelText("Convidados"));
    await user.clear(screen.getByLabelText("Fim"));
    await user.type(screen.getByLabelText("Fim"), "08:00");
    await user.clear(screen.getByLabelText("Início"));
    await user.type(screen.getByLabelText("Início"), "09:00");
    await user.click(screen.getByRole("button", { name: "Criar reunião" }));
    expect(h.toast.error).toHaveBeenCalledWith("O fim precisa ser depois do início");
    expect(h.criar).not.toHaveBeenCalled();
  });

  it("edita a reunião mantendo o aviso dela e mostra entrar e abrir no Google", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    const { user } = abrir(REUNIAO);
    expect(screen.getByLabelText("Título")).toHaveValue("Reunião com a VRZ");
    expect(screen.getByLabelText("Convidados")).toHaveValue("cliente@vrz.com");
    expect(screen.getByRole("combobox", { name: "Aviso" })).toHaveTextContent("30 minutos antes");
    // Já tem sala: não oferece criar outra.
    expect(screen.queryByLabelText("Criar sala do Google Meet")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Entrar na reunião/ }));
    expect(abrirJanela).toHaveBeenCalledWith("https://meet.google.com/abc", "_blank", "noopener,noreferrer");

    await user.clear(screen.getByLabelText("Título"));
    await user.type(screen.getByLabelText("Título"), "Reunião remarcada");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.editar).toHaveBeenCalledWith("r1", expect.objectContaining({ lembrete_minutos: 30 })));
    expect(h.editar.mock.calls[0][1].titulo).toBe("Reunião remarcada");
    abrirJanela.mockRestore();
  });

  it("exclui com confirmação", async () => {
    const { user } = abrir(REUNIAO);
    await user.click(screen.getByRole("button", { name: /Excluir reunião/ }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(h.excluir).toHaveBeenCalledWith("r1"));
    expect(h.toast.success).toHaveBeenCalledWith("Reunião excluída");
  });

  it("convidado só vê: campos travados, sem salvar nem excluir", () => {
    abrir({ ...REUNIAO, pode_editar: false });
    expect(screen.getByText(/Só quem organiza/)).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Excluir reunião/ })).not.toBeInTheDocument();
  });

  it("erro do Google avisa e mantém o diálogo aberto", async () => {
    h.editar.mockRejectedValue(new Error("x"));
    const { user, onOpenChange } = abrir(REUNIAO);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith("Não foi possível salvar a reunião", expect.anything())
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
