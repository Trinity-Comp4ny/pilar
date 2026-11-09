import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";

/**
 * Shell do Admin: carrega perfil, empresa, plano e a lista de usuários
 * (perfis ativos + convites pendentes, sem duplicar quem já aceitou) e repassa
 * para as abas. As abas são dubladas: aqui só interessa o que chega nelas.
 */

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  user: { id: "me" } as { id: string } | null,
  toastError: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return {
    supabase: {
      from: chain.from,
      auth: { getUser: () => Promise.resolve({ data: { user: h.user } }) },
    },
  };
});
vi.mock("sonner", () => ({ toast: { error: h.toastError } }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException: h.captureException } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, isAdmin: true }) }));
vi.mock("@/components/ui/sidebar", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/sidebar")>()),
  useSidebar: () => ({ state: "expanded", isMobile: false, open: true, setOpenMobile: vi.fn() }),
}));
vi.mock("@/components/ModuleChipNav", () => ({ ModuleChipNav: () => null }));
vi.mock("./tabs/Usuarios", () => ({
  UsuariosTab: ({
    users,
    currentUserId,
  }: {
    users: { id: string; nome: string; isPending?: boolean }[];
    currentUserId: string | null;
  }) => (
    <div data-testid="usuarios" data-current={currentUserId ?? ""}>
      {users.map((u) => (
        <span key={u.id}>
          {u.nome}
          {u.isPending ? " (pendente)" : ""}
        </span>
      ))}
    </div>
  ),
}));
vi.mock("./tabs/Empresa", () => ({
  EmpresaTab: (p: {
    companyId: string | null;
    companyData: { nomeEmpresa: string; status: string };
    usersCount: number;
    isLoading: boolean;
  }) => (
    <div data-testid="empresa">
      {p.companyId}|{p.companyData.nomeEmpresa}|{p.companyData.status}|{p.usersCount}|{String(p.isLoading)}
    </div>
  ),
}));
vi.mock("./tabs/Auditoria", () => ({ AuditoriaTab: () => <div data-testid="auditoria" /> }));
vi.mock("./tabs/Plano", () => ({
  PlanoTab: ({ empresaId, currentPlan }: { empresaId: string | null; currentPlan: string }) => (
    <div data-testid="plano">
      {empresaId}|{currentPlan}
    </div>
  ),
}));

import Admin from "./index";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const PERFIL = {
  id: "me",
  empresa_id: "e1",
  role: "admin",
  empresas: { id: "e1", nome: "Seed Engenharia", cnpj: null, status: null, email: null, logo_url: null },
};

const PERFIS = [
  { id: "me", first_name: "Ana", last_name: "Lima", email: "ana@seed.test", role: "admin", onboarding_completed: true },
  { id: "u2", first_name: null, last_name: null, email: "bruno@seed.test", role: "user", onboarding_completed: false },
];

const CONVITES = [
  { id: "c1", nome: "Davi", email: "davi@seed.test", cargo: "user" },
  { id: "c2", nome: null, email: "BRUNO@seed.test", cargo: "user" }, // já tem perfil: some
  { id: "c3", nome: null, email: "eva@seed.test", cargo: "user" },
];

function respostas(over: Partial<Record<string, ChainResult>> = {}) {
  return (q: ChainQuery): ChainResult => {
    if (q.table === "profiles" && q.single) return over.perfil ?? { data: PERFIL };
    if (q.table === "profiles") return over.perfis ?? { data: PERFIS };
    if (q.table === "convites") return over.convites ?? { data: CONVITES };
    if (q.table === "pilar_subscriptions") return over.assinatura ?? { data: { plan_id: "plan-1" } };
    if (q.table === "pilar_subscription_plans") return over.plano ?? { data: { slug: "pro" } };
    return { data: null };
  };
}

function Local() {
  const { search } = useLocation();
  return <div data-testid="search">{search}</div>;
}

function renderAdmin(path = "/admin") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Admin />
      <Local />
    </MemoryRouter>
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.user = { id: "me" };
  h.resolve.mockImplementation(respostas());
});

describe("Admin", () => {
  it("junta perfis e convites pendentes, sem duplicar quem já aceitou", async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByText("Davi (pendente)")).toBeInTheDocument());
    expect(screen.getByText("Ana Lima")).toBeInTheDocument();
    // Sem nome cai no email; onboarding incompleto conta como pendente.
    expect(screen.getByText("bruno@seed.test (pendente)")).toBeInTheDocument();
    expect(screen.getByText("eva@seed.test (pendente)")).toBeInTheDocument();
    expect(screen.queryByText("BRUNO@seed.test (pendente)")).not.toBeInTheDocument();
    expect(screen.getByTestId("usuarios")).toHaveAttribute("data-current", "me");
    expect(screen.getByRole("heading", { name: "Admin Portal" })).toBeInTheDocument();

    const convites = h.calls.find((c) => c.table === "convites")!;
    expect(convites.filters).toContainEqual(["eq", "empresa_id", "e1"]);
    expect(convites.filters).toContainEqual(["is", "usado_em", null]);
    const perfis = h.calls.find((c) => c.table === "profiles" && !c.single)!;
    expect(perfis.filters).toContainEqual(["is", "desativado_em", null]);
  });

  it("aba pela URL: empresa recebe dados com padrões e a contagem de usuários", async () => {
    renderAdmin("/admin?tab=empresa");
    await waitFor(() => expect(screen.getByTestId("empresa")).toHaveTextContent("e1|Seed Engenharia|active|4|false"));
    expect(screen.getByRole("heading", { name: "Empresa" })).toBeInTheDocument();
  });

  it("plano vem do slug da assinatura", async () => {
    renderAdmin("/admin?tab=plano");
    await waitFor(() => expect(screen.getByTestId("plano")).toHaveTextContent("e1|pro"));
  });

  it("slug fora da lista é ignorado", async () => {
    h.resolve.mockImplementation(respostas({ plano: { data: { slug: "gold" } } }));
    renderAdmin("/admin?tab=plano");
    await waitFor(() => expect(h.calls.some((c) => c.table === "convites")).toBe(true));
    expect(screen.getByTestId("plano")).toHaveTextContent("e1|starter");
  });

  it("sem assinatura não consulta planos", async () => {
    h.resolve.mockImplementation(respostas({ assinatura: { data: null } }));
    renderAdmin("/admin?tab=plano");
    await waitFor(() => expect(h.calls.some((c) => c.table === "convites")).toBe(true));
    expect(h.calls.some((c) => c.table === "pilar_subscription_plans")).toBe(false);
    expect(screen.getByTestId("plano")).toHaveTextContent("e1|starter");
  });

  it("aba inválida na URL cai em usuários", () => {
    renderAdmin("/admin?tab=hackear");
    expect(screen.getByTestId("usuarios")).toBeInTheDocument();
  });

  it("trocar de aba grava na URL e o breadcrumb volta para o início", async () => {
    const user = renderAdmin();
    await user.click(screen.getByRole("tab", { name: /Auditoria/ }));
    expect(screen.getByTestId("auditoria")).toBeInTheDocument();
    expect(screen.getByTestId("search")).toHaveTextContent("?tab=auditoria");
    await user.click(screen.getByRole("button", { name: "Admin Portal" }));
    expect(screen.getByTestId("search")).toHaveTextContent("?tab=usuarios");
    expect(screen.getByTestId("usuarios")).toBeInTheDocument();
  });

  it("sem sessão não carrega nada e encerra o carregamento", async () => {
    h.user = null;
    renderAdmin("/admin?tab=empresa");
    await waitFor(() => expect(screen.getByTestId("empresa")).toHaveTextContent("|false"));
    expect(h.calls).toHaveLength(0);
  });

  it("perfil sem empresa não busca usuários", async () => {
    h.resolve.mockImplementation(respostas({ perfil: { data: { id: "me", empresa_id: null, empresas: null } } }));
    renderAdmin("/admin?tab=empresa");
    await waitFor(() => expect(screen.getByTestId("empresa")).toHaveTextContent("|false"));
    expect(h.calls.map((c) => c.table)).toEqual(["profiles"]);
  });

  it("falha inesperada avisa e reporta", async () => {
    h.resolve.mockImplementation((q) => {
      if (q.table === "convites") throw new Error("network down");
      return respostas()(q);
    });
    renderAdmin();
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao carregar admin", {
        description: "Atualize a página em instantes.",
      })
    );
    expect(h.captureException).toHaveBeenCalledWith(expect.any(Error), { context: "admin-load" });
  });
});
