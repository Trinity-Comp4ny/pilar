import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake } from "@/pages/obras/testing/supabaseFake";
import type { ObraResumo } from "@/pages/obras/hooks/useObras";

// Conta da obra: saldo e extrato, ações só com permissão, exclusão sob confirmação
// (despesa estorna a taxa via RPC) e falha na exclusão avisada.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
vi.mock("@/hooks/useMoneyMask", () => ({ useMoneyMask: () => (v: number) => `R$ ${v.toFixed(2)}` }));
vi.mock("./ObraDesembolsoChart", () => ({ ObraDesembolsoChart: () => null }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { ObraContaTab } from "./ObraContaTab";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const obra = { id: "obra-1", modelo_cobranca: "administracao", taxa_administracao_pct: 10 } as unknown as ObraResumo;

const lancamentos = [
  { id: "l-1", tipo: "aporte", data: "2026-10-01", descricao: "Aporte inicial", valor: 10000, pago_por: "cliente" },
  { id: "l-2", tipo: "despesa", data: "2026-10-02", descricao: "Concreto", valor: 2500, pago_por: "cliente" },
];

function montar(canEdit = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  render(<ObraContaTab obra={obra} canEdit={canEdit} />, { wrapper: Wrapper });
}

describe("ObraContaTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    fake.responder((c) =>
      c.tabela === "obra_conta_lancamento" && c.op === "select" ? { data: lancamentos, error: null } : undefined
    );
  });

  it("vazio: convida a registrar o primeiro lançamento", async () => {
    fake.responder(() => undefined);
    montar();
    expect(await screen.findByText("Nenhum lançamento ainda")).toBeInTheDocument();
  });

  it("mostra saldo, aportes, despesas e a taxa ativa", async () => {
    montar();
    expect(await screen.findByText("Concreto")).toBeInTheDocument();
    expect(screen.getByText("R$ 7500.00")).toBeInTheDocument();
    expect(screen.getByText(/Taxa de administração de 10%/)).toBeInTheDocument();
  });

  it("sem permissão: nada de aporte, despesa, editar ou excluir", async () => {
    montar(false);
    expect(await screen.findByText("Concreto")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aporte/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Despesa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir lançamento/ })).not.toBeInTheDocument();
  });

  it("excluir despesa pede confirmação e estorna via RPC", async () => {
    montar();
    await screen.findByText("Concreto");
    fireEvent.click(screen.getByRole("button", { name: "Excluir lançamento Concreto" }));
    expect(screen.getByText("Excluir lançamento?")).toBeInTheDocument();
    expect(screen.getByText(/taxa de administração correspondente é estornada/)).toBeInTheDocument();
    expect(fake.rpc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(fake.rpc).toHaveBeenCalledWith("rpc_obra_despesa_excluir", { p_id: "l-2" }));
  });

  it("cancelar a exclusão não apaga", async () => {
    montar();
    await screen.findByText("Aporte inicial");
    fireEvent.click(screen.getByRole("button", { name: "Excluir lançamento Aporte inicial" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fake.escritas()).toHaveLength(0);
  });

  it("falha ao excluir avisa o usuário", async () => {
    fake.rpc.mockResolvedValue({ data: null, error: new Error("obra encerrada") });
    montar();
    await screen.findByText("Concreto");
    fireEvent.click(screen.getByRole("button", { name: "Excluir lançamento Concreto" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível excluir", { description: "obra encerrada" })
    );
  });

  it("aporte não tem editar; despesa abre o diálogo de edição", async () => {
    montar();
    await screen.findByText("Concreto");
    expect(screen.queryByRole("button", { name: "Editar Aporte inicial" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar Concreto" }));
    expect(await screen.findByText("Editar despesa")).toBeInTheDocument();
  });
});
