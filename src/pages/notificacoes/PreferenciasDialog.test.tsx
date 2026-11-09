import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import { PreferenciasDialog } from "./PreferenciasDialog";

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  auth: { user: { id: "u1" } as { id: string } | null, profile: { empresa_id: "e1" } as { empresa_id: string } | null },
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => h.auth }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PreferenciasDialog open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  );
}

const upserts = () => h.calls.filter((c) => c.op === "upsert");

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.auth = { user: { id: "u1" }, profile: { empresa_id: "e1" } };
  h.resolve.mockImplementation((q) => (q.op === "select" ? { data: [] } : { error: null }));
});

describe("Notificações › Preferências", () => {
  it("sem preferência gravada: app ligado em tudo, e-mail segue o padrão da categoria", async () => {
    renderDialog();
    expect(await screen.findByRole("switch", { name: "Tarefas" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "E-mail: Tarefas" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "E-mail: Financeiro" })).toBeChecked();
  });

  it("preferência gravada prevalece sobre o padrão", async () => {
    h.resolve.mockImplementation((q) =>
      q.op === "select" ? { data: [{ categoria: "financeiro", in_app: false, email: false }] } : { error: null }
    );
    renderDialog();
    await waitFor(() => expect(screen.getByRole("switch", { name: "Financeiro" })).not.toBeChecked());
    expect(screen.getByRole("switch", { name: "E-mail: Financeiro" })).not.toBeChecked();
  });

  it("desligar no app faz upsert do próprio usuário e empresa", async () => {
    renderDialog();
    await userEvent.setup().click(await screen.findByRole("switch", { name: "Projetos" }));
    await waitFor(() => expect(upserts()).toHaveLength(1));
    expect(upserts()[0].payload).toEqual({ user_id: "u1", empresa_id: "e1", categoria: "projeto", in_app: false });
  });

  it("ligar e-mail grava só a coluna email", async () => {
    renderDialog();
    await userEvent.setup().click(await screen.findByRole("switch", { name: "E-mail: Tarefas" }));
    await waitFor(() => expect(upserts()).toHaveLength(1));
    expect(upserts()[0].payload).toEqual({ user_id: "u1", empresa_id: "e1", categoria: "tarefa", email: true });
  });

  it("sessão sem empresa não grava nada", async () => {
    h.auth = { user: { id: "u1" }, profile: null };
    renderDialog();
    await userEvent.setup().click(await screen.findByRole("switch", { name: "Projetos" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(upserts()).toHaveLength(0);
  });
});
