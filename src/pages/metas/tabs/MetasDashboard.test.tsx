import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import type { MetaRow } from "@/lib/metas";
import MetasDashboard from "./MetasDashboard";

/**
 * Painel de Metas: agrupa por escopo (Empresa primeiro), resume e filtra por
 * pessoa/situação, aceita falha do cálculo de progresso e exclui com confirmação.
 */

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  rpc: vi.fn(),
  calls: [] as ChainQuery[],
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, rpc: h.rpc } };
});
vi.mock("@/lib/supabaseQueries", () => ({
  fetchPessoasLookup: async () => [
    { id: "p1", nome: "Rita Alves" },
    { id: "p2", nome: "Bruno Melo" },
  ],
}));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("../components/MetaFormDialog", () => ({
  MetaFormDialog: ({ open, meta }: { open: boolean; meta: MetaRow | null }) =>
    open ? (
      <div role="dialog" aria-label="Editar meta">
        {meta?.nome}
      </div>
    ) : null,
}));
vi.mock("recharts", async (orig) => ({
  ...(await orig<typeof import("recharts")>()),
  ResponsiveContainer: () => <div data-testid="grafico" />,
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const meta = (m: Partial<MetaRow> & Pick<MetaRow, "id" | "nome">): MetaRow => ({
  alvo: 10,
  atual: 0,
  prazo: null,
  categoria: null,
  pessoa_id: null,
  descricao: null,
  unidade: "quantity",
  unidade_rotulo: null,
  indicador: null,
  periodo_inicio: null,
  recorrencia: "nenhuma",
  created_at: "2026-01-01T00:00:00Z",
  ...m,
});

const METAS: MetaRow[] = [
  meta({ id: "m1", nome: "Faturar o ano", atual: 10 }), // empresa, concluída
  meta({ id: "m2", nome: "Entregar pranchas", pessoa_id: "p1", atual: 5, prazo: "2020-01-01" }), // atrasada
  meta({ id: "m3", nome: "Lucro do mês", pessoa_id: "p2", indicador: "lucro", unidade: "currency" }), // restrita
  meta({ id: "m4", nome: "Meta órfã", pessoa_id: "px", atual: 2 }),
];

function renderDashboard() {
  const onCreate = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MetasDashboard onCreate={onCreate} />
    </QueryClientProvider>
  );
  return { onCreate, user: userEvent.setup() };
}

const kpi = (label: string) => screen.getByText(label).closest("div")!.parentElement!;

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.resolve.mockImplementation((q) => (q.table === "metas" && q.op === "select" ? { data: METAS } : { data: null }));
  h.rpc.mockResolvedValue({ data: [{ meta_id: "m3", atual: null, restrito: true }], error: null });
});

describe("MetasDashboard", () => {
  it("sem metas mostra o vazio com ação de criar", async () => {
    h.resolve.mockReturnValue({ data: [] });
    const { user, onCreate } = renderDashboard();
    expect(await screen.findByText("Nenhuma meta cadastrada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nova meta" }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("agrupa por escopo com Empresa primeiro e pessoa removida identificada", async () => {
    renderDashboard();
    await screen.findByRole("region", { name: "Metas: Empresa" });
    const secoes = screen.getAllByRole("region").map((s) => s.getAttribute("aria-label"));
    expect(secoes[0]).toBe("Metas: Empresa");
    expect(secoes).toEqual(
      expect.arrayContaining(["Metas: Rita Alves", "Metas: Bruno Melo", "Metas: Pessoa removida"])
    );
    // Restrita entra no total, mas fica fora da média e do top 5.
    expect(within(kpi("Total de metas")).getByText("4")).toBeInTheDocument();
    expect(within(kpi("Concluídas")).getByText("1")).toBeInTheDocument();
    expect(within(kpi("Atrasadas")).getByText("1")).toBeInTheDocument();
    // (100 + 50 + 20) / 3 = 57
    expect(within(kpi("Progresso médio")).getByText("57%")).toBeInTheDocument();
    expect(screen.getByText("Sem acesso ao valor")).toBeInTheDocument();
  });

  it("falha no cálculo de progresso avisa e cai no valor salvo", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "timeout" } });
    renderDashboard();
    expect(await screen.findByText(/Não foi possível calcular o progresso agora/)).toBeInTheDocument();
    expect(screen.queryByText("Sem acesso ao valor")).not.toBeInTheDocument();
  });

  it("filtra por situação e mostra vazio quando nada casa", async () => {
    renderDashboard();
    await screen.findByRole("region", { name: "Metas: Empresa" });
    const [, situacao] = screen.getAllByRole("combobox");
    fireEvent.keyDown(situacao, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Atrasada" }));
    expect(screen.getAllByText("Entregar pranchas").length).toBeGreaterThan(0);
    expect(screen.queryByText("Faturar o ano")).not.toBeInTheDocument();

    const [escopo] = screen.getAllByRole("combobox");
    fireEvent.keyDown(escopo, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Empresa" }));
    expect(screen.getByText("Nenhuma meta com esses filtros.")).toBeInTheDocument();
    expect(within(kpi("Total de metas")).getByText("0")).toBeInTheDocument();
  });

  it("editar abre o formulário com a meta escolhida", async () => {
    const { user } = renderDashboard();
    await screen.findByRole("region", { name: "Metas: Empresa" });
    const empresa = screen.getByRole("region", { name: "Metas: Empresa" });
    await user.click(within(empresa).getByRole("button", { name: "Editar meta" }));
    expect(screen.getByRole("dialog", { name: "Editar meta" })).toHaveTextContent("Faturar o ano");
  });

  it("excluir confirma, apaga pelo id e avisa", async () => {
    const { user } = renderDashboard();
    await screen.findByRole("region", { name: "Metas: Empresa" });
    const empresa = screen.getByRole("region", { name: "Metas: Empresa" });
    await user.click(within(empresa).getByRole("button", { name: "Excluir meta" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Meta excluída"));
    const del = h.calls.find((c) => c.table === "metas" && c.op === "delete")!;
    expect(del.filters).toContainEqual(["eq", "id", "m1"]);
  });

  it("erro ao excluir avisa e não confirma a exclusão", async () => {
    h.resolve.mockImplementation((q) =>
      q.op === "delete" ? { error: { message: "permission denied" } } : { data: METAS }
    );
    const { user } = renderDashboard();
    await screen.findByRole("region", { name: "Metas: Empresa" });
    const empresa = screen.getByRole("region", { name: "Metas: Empresa" });
    await user.click(within(empresa).getByRole("button", { name: "Excluir meta" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível excluir a meta", expect.any(Object))
    );
    expect(h.toastSuccess).not.toHaveBeenCalled();
  });
});
