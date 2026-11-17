import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import { PlanoTab } from "./Plano";

/**
 * Plano do Admin: uso contado por empresa (usuários ativos, projetos pela view
 * segura, clientes) e o contato com o comercial, que monta um mailto.
 */

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  openSettings: vi.fn(),
  assinatura: null as unknown,
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from } };
});
vi.mock("@/pages/billing/hooks/useMySubscription", () => ({ useMySubscription: () => ({ data: h.assinatura }) }));
vi.mock("@/pages/billing/components/ChangePlanDialog", () => ({
  ChangePlanDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Trocar plano" /> : null),
}));
vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ openSettings: h.openSettings }) }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const CONTAGEM: Record<string, number> = { profiles: 4, projetos_safe: 12, clientes: 30 };

const stat = (label: string) => screen.getByText(label).parentElement!;

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.assinatura = null;
  h.resolve.mockImplementation((q) => ({ count: CONTAGEM[q.table] }));
});

describe("PlanoTab", () => {
  it("sem empresa não consulta e mostra zero", () => {
    render(<PlanoTab empresaId={null} currentPlan="starter" />);
    expect(h.calls).toHaveLength(0);
    expect(within(stat("Usuários ativos")).getByText("0")).toBeInTheDocument();
    expect(screen.getAllByText(/Essencial/).length).toBeGreaterThan(0);
  });

  it("conta usuários ativos, projetos (view segura) e clientes da empresa", async () => {
    render(<PlanoTab empresaId="e1" currentPlan="pro" />);
    await waitFor(() => expect(within(stat("Clientes")).getByText("30")).toBeInTheDocument());
    expect(within(stat("Usuários ativos")).getByText("4")).toBeInTheDocument();
    expect(within(stat("Projetos")).getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Acesso completo à Pilar no plano Profissional")).toBeInTheDocument();

    const perfis = h.calls.find((c) => c.table === "profiles")!;
    expect(perfis.filters).toContainEqual(["eq", "empresa_id", "e1"]);
    expect(perfis.filters).toContainEqual(["is", "desativado_em", null]);
    // projetos vem da view sem colunas financeiras (select("*") na base foi revogado).
    expect(h.calls.find((c) => c.table === "projetos")).toBeUndefined();
    expect(h.calls.find((c) => c.table === "projetos_safe")!.columns).toBe("id");
  });

  it("contagem ausente (erro/sem permissão) vira zero", async () => {
    h.resolve.mockReturnValue({ count: null, error: { message: "permission denied" } });
    render(<PlanoTab empresaId="e1" currentPlan="enterprise" />);
    await waitFor(() => expect(h.calls).toHaveLength(3));
    expect(within(stat("Projetos")).getByText("0")).toBeInTheDocument();
    expect(screen.getAllByText(/Escala/).length).toBeGreaterThan(0);
  });

  it("assinatura ativa: Mudar de plano abre a troca de plano", async () => {
    h.assinatura = { status: "active", plan: null };
    render(<PlanoTab empresaId={null} currentPlan="starter" />);
    expect(screen.queryByRole("button", { name: "Falar com comercial" })).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Mudar de plano" }));
    expect(screen.getByRole("dialog", { name: "Trocar plano" })).toBeInTheDocument();
  });

  it("sem assinatura ativa: Mudar de plano leva ao Pagamento", async () => {
    render(<PlanoTab empresaId={null} currentPlan="starter" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Mudar de plano" }));
    expect(h.openSettings).toHaveBeenCalledWith("pagamento");
  });
});
