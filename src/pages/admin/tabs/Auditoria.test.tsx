import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { PageSlotsContext } from "@/components/pageSlotsContext";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import { AuditoriaTab } from "./Auditoria";

/**
 * Auditoria do Admin: duas visões (ações admin e mutações de dados), cada uma
 * com filtros que vão para a consulta, rótulos em português, linha expansível
 * com o JSON, erro do banco visível e exportação CSV com escape.
 */

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult | Promise<ChainResult>>(),
  calls: [] as ChainQuery[],
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from } };
});

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// A lista de tabelas é longa e vira busca (cmdk), que rola o item ativo.
Element.prototype.scrollIntoView ??= () => {};

function ComSlot({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return (
    <PageSlotsContext.Provider value={{ toolbarEl: el, tabsEl: null }}>
      <div ref={setEl} data-testid="toolbar" />
      {children}
    </PageSlotsContext.Provider>
  );
}

const ADMIN_LOGS = [
  {
    id: "a1",
    actor_email: "ana@seed.test",
    actor_role: "admin",
    action: "invite_user",
    category: "user",
    target_type: "profile",
    target_name: "Eva Lima",
    metadata: { role: "coordenador" },
    created_at: "2026-11-05T13:04:05Z",
  },
  {
    id: "a2",
    actor_email: "root@pilar.test",
    actor_role: "suporte",
    action: "acao_nova",
    category: "outra",
    target_type: null,
    target_name: null,
    metadata: null,
    created_at: "2026-11-04T10:00:00Z",
  },
];

const DATA_LOGS = [
  {
    id: "d1",
    actor_id: "u1",
    actor_email: null,
    action: "UPDATE",
    target_table: "clientes",
    target_id: "c1",
    diff: {
      nome: { old: "A", new: "B" },
      email: { old: null, new: "x@y.z" },
      contato: { old: "1", new: "2" },
      endereco: { old: "", new: 'Rua "A", 1' },
    },
    created_at: "2026-11-05T13:04:05Z",
  },
  {
    id: "d2",
    actor_id: "u1",
    actor_email: "ana@seed.test",
    action: "DELETE",
    target_table: "leads",
    target_id: "l1",
    diff: {},
    created_at: "2026-11-05T12:00:00Z",
  },
];

const toolbar = () => within(screen.getByTestId("toolbar"));

function renderTab() {
  render(
    <ComSlot>
      <AuditoriaTab />
    </ComSlot>
  );
  return userEvent.setup();
}

const lastCall = (table: string) => [...h.calls].reverse().find((c) => c.table === table)!;

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.resolve.mockImplementation((q) => ({ data: q.table === "admin_audit_logs" ? ADMIN_LOGS : DATA_LOGS }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Auditoria: ações admin", () => {
  it("lista com ação, papel e categoria traduzidos, e cru quando desconhecido", async () => {
    renderTab();
    expect(await screen.findByText("Convite enviado")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Usuário")).toBeInTheDocument();
    expect(screen.getByText("Eva Lima")).toBeInTheDocument();
    expect(screen.getByText("acao_nova")).toBeInTheDocument();
    expect(screen.getByText("suporte")).toBeInTheDocument();
    expect(screen.getByText("outra")).toBeInTheDocument();
    const q = lastCall("admin_audit_logs");
    expect(q.filters).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(q.filters).toContainEqual(["limit", 200]);
  });

  it("clicar na linha expande o metadata e clicar de novo recolhe", async () => {
    const user = renderTab();
    const linha = await screen.findByRole("row", { name: "Ver detalhes da ação Convite enviado" });
    await user.click(linha);
    expect(screen.getByText(/"role": "coordenador"/)).toBeInTheDocument();
    await user.click(linha);
    expect(screen.queryByText(/"role": "coordenador"/)).not.toBeInTheDocument();
  });

  it("filtros de categoria e autor vão para a consulta", async () => {
    const user = renderTab();
    await screen.findByText("Convite enviado");
    await user.click(toolbar().getByRole("button", { name: "Categoria" }));
    await user.click(
      within(await screen.findByRole("listbox", { name: "Categoria" })).getByRole("option", { name: "Billing" })
    );
    await waitFor(() => expect(lastCall("admin_audit_logs").filters).toContainEqual(["eq", "category", "billing"]));
    fireEvent.change(toolbar().getByRole("textbox", { name: "Autor (email)" }), { target: { value: "  ana " } });
    await waitFor(() => expect(lastCall("admin_audit_logs").filters).toContainEqual(["ilike", "actor_email", "%ana%"]));
  });

  it("erro do banco aparece e a lista vazia mostra o vazio", async () => {
    h.resolve.mockReturnValue({ data: null, error: new Error("permission denied for table admin_audit_logs") });
    renderTab();
    expect(await screen.findByText("permission denied for table admin_audit_logs")).toBeInTheDocument();
    expect(screen.getByText("Nenhum registro encontrado")).toBeInTheDocument();
    expect(toolbar().getByRole("button", { name: "CSV" })).toBeDisabled();
  });

  it("erro sem mensagem cai no texto padrão", async () => {
    h.resolve.mockReturnValue({ data: null, error: { code: "42501" } });
    renderTab();
    expect(await screen.findByText("Erro ao carregar logs admin")).toBeInTheDocument();
  });

  it("atualizar refaz a consulta", async () => {
    const user = renderTab();
    await screen.findByText("Convite enviado");
    const antes = h.calls.length;
    await user.click(toolbar().getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(h.calls.length).toBe(antes + 1));
  });

  it("exporta CSV com BOM, cabeçalho e JSON escapado", async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return "blob:csv";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = renderTab();
    await screen.findByText("Convite enviado");
    await user.click(toolbar().getByRole("button", { name: "CSV" }));
    expect(click).toHaveBeenCalledOnce();
    // BOM UTF-8 para o Excel abrir acentos certo.
    const bytes = new Uint8Array(await blobs[0].arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const texto = new TextDecoder().decode(bytes);
    const [cabecalho, primeira, segunda] = texto.split("\n");
    expect(cabecalho).toBe("created_at,actor_email,actor_role,action,category,target_name,metadata");
    expect(primeira).toBe(
      '2026-11-05T13:04:05Z,ana@seed.test,admin,invite_user,user,Eva Lima,"{""role"":""coordenador""}"'
    );
    // Nulos viram campo vazio.
    expect(segunda.endsWith("outra,,")).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:csv");
  });
});

describe("Auditoria: mutações de dados", () => {
  async function irParaDados(user: ReturnType<typeof userEvent.setup>) {
    await user.click(toolbar().getByRole("button", { name: "Mutações de dados" }));
    return screen.findByRole("row", { name: "Ver campos alterados em clientes" });
  }

  it("mostra autor ausente como traço e resume os campos alterados", async () => {
    const user = renderTab();
    await irParaDados(user);
    expect(screen.getByText("nome, email, contato +1")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2); // autor nulo e diff vazio
    expect(screen.getByText("UPDATE")).toBeInTheDocument();
  });

  it("expande o diff da mutação", async () => {
    const user = renderTab();
    await user.click(await irParaDados(user));
    expect(screen.getByText(/"new": "x@y.z"/)).toBeInTheDocument();
  });

  it("filtros de tabela, ação e autor vão para a consulta", async () => {
    const user = renderTab();
    await irParaDados(user);
    await user.click(toolbar().getByRole("button", { name: "Tabela" }));
    const lista = await screen.findByRole("listbox");
    await user.click(within(lista).getByRole("option", { name: "receitas" }));
    await waitFor(() => expect(lastCall("audit_logs").filters).toContainEqual(["eq", "target_table", "receitas"]));
    await user.click(toolbar().getByRole("button", { name: "Ação" }));
    await user.click(
      within(await screen.findByRole("listbox", { name: "Ação" })).getByRole("option", { name: "DELETE" })
    );
    await waitFor(() => expect(lastCall("audit_logs").filters).toContainEqual(["eq", "action", "DELETE"]));
    fireEvent.change(toolbar().getByRole("textbox", { name: "Autor (email)" }), { target: { value: "ana" } });
    await waitFor(() => expect(lastCall("audit_logs").filters).toContainEqual(["ilike", "actor_email", "%ana%"]));
    expect(lastCall("audit_logs").filters).toContainEqual(["eq", "target_table", "receitas"]);
  });

  it("erro do banco mostra a mensagem real, não o texto padrão", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "audit_logs"
        ? { data: null, error: { message: "permission denied for audit_logs" } }
        : { data: ADMIN_LOGS }
    );
    const user = renderTab();
    await user.click(toolbar().getByRole("button", { name: "Mutações de dados" }));
    expect(await screen.findByText("permission denied for audit_logs")).toBeInTheDocument();
  });

  it("erro sem mensagem cai no texto padrão", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "audit_logs" ? { data: null, error: { message: "" } } : { data: ADMIN_LOGS }
    );
    const user = renderTab();
    await user.click(toolbar().getByRole("button", { name: "Mutações de dados" }));
    expect(await screen.findByText("Erro ao carregar logs")).toBeInTheDocument();
  });

  it("exporta as mutações em CSV", async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return "blob:csv";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = renderTab();
    await irParaDados(user);
    await user.click(toolbar().getByRole("button", { name: "CSV" }));
    const linhas = (await blobs[0].text()).split("\n");
    expect(linhas[0]).toContain("created_at,actor_email,action,target_table,target_id,diff");
    expect(linhas[1].startsWith("2026-11-05T13:04:05Z,,UPDATE,clientes,c1,")).toBe(true);
    expect(linhas[2]).toBe("2026-11-05T12:00:00Z,ana@seed.test,DELETE,leads,l1,{}");
  });
});
