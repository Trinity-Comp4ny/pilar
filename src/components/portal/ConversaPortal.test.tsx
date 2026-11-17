import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";

// Conversa do portal (BEZ-575): a equipe lê/escreve direto na tabela (RLS), o cliente só por RPC com o
// token; nota interna só existe do lado da equipe; mensagem da outra parte é marcada como lida.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const auth = vi.hoisted(() => ({
  profile: { empresa_id: "emp-1", nome: "Ana Souza", first_name: "Ana" } as Record<string, unknown> | null,
  user: { id: "user-1" } as { id: string } | null,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: auth.profile, user: auth.user }) }));

Element.prototype.scrollIntoView ??= () => {};

import { ConversaPortal } from "./ConversaPortal";

function montar(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const linhaEquipe = (p: Record<string, unknown>) => ({
  id: "m1",
  autor_tipo: "cliente",
  autor_nome: "Marina Prado",
  autor_profile_id: null,
  texto: "Posso trocar o piso?",
  interna: false,
  created_at: "2026-11-14T10:00:00Z",
  lida_pela_equipe_em: null,
  ...p,
});

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  rpcComEmpresa();
  sessionStorage.clear();
  sessionStorage.setItem("pilar_portal_token", "tok");
  auth.profile = { empresa_id: "emp-1", nome: "Ana Souza", first_name: "Ana" };
  auth.user = { id: "user-1" };
});

describe("ConversaPortal — equipe", () => {
  it("lê as mensagens soltas do projeto e marca as do cliente como lidas", async () => {
    fake.responder((c) =>
      c.tabela === "portal_mensagens" && c.op === "select" ? { data: [linhaEquipe({})], error: null } : undefined
    );
    montar(<ConversaPortal lado="equipe" escopo={{ projetoId: "p1" }} />);
    expect(await screen.findByText("Posso trocar o piso?")).toBeInTheDocument();
    expect(screen.getByText(/Marina Prado/)).toBeInTheDocument();
    await waitFor(() =>
      expect(fake.rpc).toHaveBeenCalledWith("marcar_mensagens_portal_lidas_equipe", {
        p_projeto_id: "p1",
        p_obra_id: undefined,
        p_entrega_id: undefined,
      })
    );
  });

  it("envia a resposta com a autoria da equipe e pede o e-mail ao cliente", async () => {
    montar(<ConversaPortal lado="equipe" escopo={{ obraId: "o1" }} />);
    fireEvent.change(await screen.findByLabelText("Mensagem"), { target: { value: "  Pode sim.  " } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/ }));
    await waitFor(() => expect(fake.escritas("portal_mensagens")).toHaveLength(1));
    expect(fake.escritas("portal_mensagens")[0].payload).toEqual({
      id: expect.any(String),
      empresa_id: "emp-1",
      projeto_id: null,
      obra_id: "o1",
      entrega_id: null,
      autor_tipo: "escritorio",
      autor_profile_id: "user-1",
      autor_nome: "Ana Souza",
      texto: "Pode sim.",
      interna: false,
    });
    expect(fake.invoke).toHaveBeenCalledWith("portal-avisar-mensagem", { body: { mensagem_id: expect.any(String) } });
  });

  it("nota interna é gravada como interna e não avisa o cliente", async () => {
    montar(<ConversaPortal lado="equipe" escopo={{ projetoId: "p1" }} />);
    fireEvent.click(await screen.findByLabelText(/Nota interna/));
    fireEvent.change(screen.getByLabelText("Mensagem"), { target: { value: "Cliente sensível a prazo" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/ }));
    await waitFor(() => expect(fake.escritas("portal_mensagens")).toHaveLength(1));
    expect((fake.escritas("portal_mensagens")[0].payload as { interna: boolean }).interna).toBe(true);
    expect(fake.invoke).not.toHaveBeenCalled();
  });

  it("fio de solicitação filtra só pela solicitação; o painel geral só pelas mensagens soltas", async () => {
    const { unmount } = montar(<ConversaPortal lado="equipe" escopo={{ entregaId: "e1" }} />);
    await screen.findByLabelText("Mensagem");
    const fio = fake.chamadas.find((c) => c.tabela === "portal_mensagens" && c.op === "select")!;
    expect(fio.filtros).toContainEqual(["eq", "entrega_id", "e1"]);
    expect(fio.filtros.some((f) => f[1] === "projeto_id")).toBe(false);
    unmount();

    fake.chamadas.length = 0;
    montar(<ConversaPortal lado="equipe" escopo={{ projetoId: "p1" }} />);
    await screen.findByLabelText("Mensagem");
    const geral = fake.chamadas.find((c) => c.tabela === "portal_mensagens" && c.op === "select")!;
    expect(geral.filtros).toContainEqual(["eq", "projeto_id", "p1"]);
    expect(geral.filtros).toContainEqual(["is", "entrega_id", null]);
  });

  it("falha ao enviar avisa e mantém o texto", async () => {
    fake.responder((c) => (c.op === "insert" ? { data: null, error: { message: "rls" } } : undefined));
    montar(<ConversaPortal lado="equipe" escopo={{ projetoId: "p1" }} />);
    fireEvent.change(await screen.findByLabelText("Mensagem"), { target: { value: "Oi" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível enviar", expect.anything()));
    expect(screen.getByLabelText("Mensagem")).toHaveValue("Oi");
  });
});

describe("ConversaPortal — cliente", () => {
  it("lista pela RPC do token, sem opção de nota interna, e marca como lida", async () => {
    fake.rpc.mockImplementation(async (nome: string) => {
      if (nome === "portal_listar_mensagens")
        return {
          data: [
            {
              id: "m1",
              autor_tipo: "escritorio",
              autor_nome: "Ana Souza",
              texto: "Enviei o projeto revisado.",
              created_at: "2026-11-14T10:00:00Z",
              lida_pelo_cliente_em: null,
            },
          ],
          error: null,
        };
      return { data: null, error: null };
    });
    montar(<ConversaPortal lado="cliente" escopo={{ projetoId: "p1" }} />);
    expect(await screen.findByText("Enviei o projeto revisado.")).toBeInTheDocument();
    expect(fake.rpc).toHaveBeenCalledWith("portal_listar_mensagens", {
      p_token: "tok",
      p_projeto_id: "p1",
      p_obra_id: undefined,
      p_entrega_id: undefined,
    });
    expect(screen.queryByLabelText(/Nota interna/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(fake.rpc).toHaveBeenCalledWith(
        "portal_marcar_mensagens_lidas",
        expect.objectContaining({ p_token: "tok" })
      )
    );
  });

  it("envia pela RPC com o token e o escopo", async () => {
    montar(<ConversaPortal lado="cliente" escopo={{ obraId: "o1" }} />);
    const campo = await screen.findByLabelText("Mensagem");
    fireEvent.change(campo, { target: { value: "Quando começa a laje?" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    await waitFor(() =>
      expect(fake.rpc).toHaveBeenCalledWith("portal_enviar_mensagem", {
        p_token: "tok",
        p_texto: "Quando começa a laje?",
        p_projeto_id: undefined,
        p_obra_id: "o1",
        p_entrega_id: undefined,
      })
    );
    expect(fake.escritas("portal_mensagens")).toHaveLength(0);
  });

  it("estado vazio convida a escrever", async () => {
    montar(<ConversaPortal lado="cliente" escopo={{ projetoId: "p1" }} />);
    expect(await screen.findByText("Nenhuma mensagem ainda")).toBeInTheDocument();
    expect(screen.getByText("Escreva aqui para falar com o escritório.")).toBeInTheDocument();
  });
});
