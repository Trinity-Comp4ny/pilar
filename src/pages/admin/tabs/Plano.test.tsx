import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import { PlanoTab } from "./Plano";
import { FalarComercialDialog } from "../components/FalarComercialDialog";

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

describe("FalarComercialDialog", () => {
  const original = window.location;
  let href = "";
  beforeEach(() => {
    href = "";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...original,
        set href(v: string) {
          href = v;
        },
      },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("nome e email são obrigatórios", async () => {
    const onOpenChange = vi.fn();
    render(<FalarComercialDialog open onOpenChange={onOpenChange} defaultName="  " />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Enviar" }));
    expect(h.toastError).toHaveBeenCalledWith("Nome e email são obrigatórios");
    expect(href).toBe("");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("monta o mailto com assunto, telefone formatado e plano escolhido", async () => {
    const onOpenChange = vi.fn();
    render(<FalarComercialDialog open onOpenChange={onOpenChange} defaultEmail="ana@seed.test" />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Seu nome"), "Ana");
    await user.type(screen.getByPlaceholderText("(11) 99999-9999"), "11988887777");
    expect(screen.getByPlaceholderText("(11) 99999-9999")).toHaveValue("(11) 98888-7777");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Escala" }));
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const url = new URL(href);
    expect(url.protocol).toBe("mailto:");
    expect(url.pathname).toBe("comercial@pilarsoft.com.br");
    expect(url.searchParams.get("subject")).toBe("Contato comercial: ENTERPRISE");
    const corpo = url.searchParams.get("body")!;
    expect(corpo).toContain("Nome: Ana");
    expect(corpo).toContain("Telefone: (11) 98888-7777");
    expect(corpo).toContain("Interesse: plano enterprise");
    expect(corpo).toContain("(sem mensagem adicional)");
    expect(h.toastSuccess).toHaveBeenCalledWith("Cliente de email aberto", expect.any(Object));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sem telefone omite a linha e usa o plano atual como padrão", async () => {
    render(
      <FalarComercialDialog open onOpenChange={vi.fn()} defaultEmail="a@b.c" defaultName="Ana" currentPlan="starter" />
    );
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Conte um pouco/), "Quero migrar");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    const corpo = new URL(href).searchParams.get("body")!;
    expect(corpo).not.toContain("Telefone");
    expect(corpo).toContain("Interesse: plano starter");
    expect(corpo).toContain("Quero migrar");
  });

  it("cancelar fecha sem enviar", async () => {
    const onOpenChange = vi.fn();
    render(<FalarComercialDialog open onOpenChange={onOpenChange} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(href).toBe("");
  });
});
