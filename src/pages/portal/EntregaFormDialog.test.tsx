import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";

// Nova solicitação ao cliente do portal: título obrigatório, link só do Google Drive/Docs (mesma regra do
// CHECK do banco), tipo e etapa opcionais, payload gravado, erro do servidor (RLS) e
// usuário sem empresa no perfil.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const auth = vi.hoisted(() => ({ profile: { empresa_id: "emp-1" } as { empresa_id: string } | null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: auth.profile }) }));
vi.mock("@/hooks/useProjetoDisciplinas", () => ({
  useProjetoDisciplinas: () => ({
    data: [
      { id: "d-1", nome: "Arquitetura" },
      { id: "d-2", nome: "Estrutural" },
    ],
  }),
}));

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { EntregaFormDialog } from "./EntregaFormDialog";

function montar() {
  const qc = new QueryClient();
  const h = { onOpenChange: vi.fn(), onCreated: vi.fn() };
  render(<EntregaFormDialog open projetoId="proj-1" {...h} />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  });
  return h;
}

const criar = () => screen.getByRole("button", { name: "Enviar ao cliente" });
const escolher = (combo: HTMLElement, opcao: string) => {
  fireEvent.keyDown(combo, { key: "Enter" });
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }));
};

describe("EntregaFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
    auth.profile = { empresa_id: "emp-1" };
  });

  it("sem título não deixa criar", () => {
    montar();
    expect(criar()).toBeDisabled();
  });

  it.each(["https://dropbox.com/x", "http://drive.google.com/x", "drive.google.com/x"])(
    "link %s é recusado como no banco",
    (url) => {
      montar();
      fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Anteprojeto" } });
      fireEvent.change(screen.getByLabelText("Link do Google Drive"), { target: { value: url } });
      expect(screen.getByText("Precisa ser um link do drive.google.com ou docs.google.com")).toBeInTheDocument();
      expect(criar()).toBeDisabled();
    }
  );

  it("grava a entrega pendente com tipo e etapa e avisa quem chamou", async () => {
    const h = montar();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "  Anteprojeto revisado " } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: " Planta e cortes " } });
    fireEvent.change(screen.getByLabelText("Link do Google Drive"), {
      target: { value: "https://docs.google.com/document/d/abc" },
    });
    const [tipo, etapa] = screen.getAllByRole("combobox");
    escolher(tipo, "Aprovação");
    escolher(etapa, "Estrutural");
    fireEvent.click(criar());
    await waitFor(() => expect(h.onCreated).toHaveBeenCalled());
    expect(fake.escritas("portal_entregas")[0].payload).toEqual({
      empresa_id: "emp-1",
      projeto_id: "proj-1",
      obra_id: null,
      titulo: "Anteprojeto revisado",
      tipo: "aprovacao",
      descricao: "Planta e cortes",
      drive_url: "https://docs.google.com/document/d/abc",
      projeto_disciplina_id: "d-2",
      status: "pendente",
    });
    expect(toast.success).toHaveBeenCalledWith("Solicitação criada");
    expect(h.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("campos opcionais vazios vão como null", async () => {
    montar();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Memorial" } });
    fireEvent.click(criar());
    await waitFor(() => expect(fake.escritas("portal_entregas")).toHaveLength(1));
    expect(fake.escritas("portal_entregas")[0].payload).toMatchObject({
      tipo: null,
      descricao: null,
      drive_url: null,
      projeto_disciplina_id: null,
    });
  });

  it("erro do servidor (RLS) avisa sem fechar nem limpar", async () => {
    fake.responder(() => ({ data: null, error: { message: "new row violates row-level security policy" } }));
    const h = montar();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Memorial" } });
    fireEvent.click(criar());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível criar a solicitação", {
        description: "Você não tem permissão para realizar esta ação.",
      })
    );
    expect(h.onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Título")).toHaveValue("Memorial");
  });

  it("perfil sem empresa não grava", async () => {
    auth.profile = null;
    const h = montar();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Memorial" } });
    fireEvent.click(criar());
    await new Promise((r) => setTimeout(r, 10));
    expect(fake.escritas()).toHaveLength(0);
    expect(h.onCreated).not.toHaveBeenCalled();
  });
});
