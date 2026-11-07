import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProfileSetup from "./ProfileSetup";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  auth: { getUser: vi.fn(), updateUser: vi.fn() },
  refreshProfile: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, auth: h.auth } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ refreshProfile: h.refreshProfile }) }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const SENHA = "Senha#Forte2026";

type Cenario = {
  profile?: Record<string, unknown> | null;
  aceite?: boolean;
  role?: string;
  empresaOk?: boolean;
  termsError?: unknown;
  updateError?: unknown;
};

function cenario(c: Cenario = {}) {
  const { profile = { first_name: "", last_name: "", contato: "", empresa_id: "e1" }, aceite = false } = c;
  h.resolve.mockImplementation((q) => {
    if (q.table === "profiles" && q.op === "select" && q.columns?.includes("role")) {
      return { data: { role: c.role ?? "user", empresas: { onboarding_completed: c.empresaOk ?? true } } };
    }
    if (q.table === "profiles" && q.op === "select") return { data: profile };
    if (q.table === "profiles" && q.op === "update") return { error: c.updateError ?? null };
    if (q.table === "terms_acceptances" && q.op === "select") return { data: aceite ? { id: "t" } : null };
    if (q.table === "terms_acceptances" && q.op === "insert") return { error: c.termsError ?? null };
    return { data: null };
  });
}

function usuario(meta: { provider?: string; invite?: boolean; identities?: string[] } = {}) {
  h.auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: "u1",
        app_metadata: { provider: meta.provider ?? "email" },
        user_metadata: meta.invite ? { invite_token: "tok" } : {},
        identities: (meta.identities ?? ["email"]).map((p) => ({ provider: p })),
      },
    },
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/profile-setup"]}>
      <Routes>
        <Route path="/profile-setup" element={<ProfileSetup />} />
        <Route path="/inicio" element={<div data-testid="inicio" />} />
        <Route path="/company-setup" element={<div data-testid="company-setup" />} />
      </Routes>
    </MemoryRouter>
  );
}

async function preencherBasico(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Ex: Maria"), "Maria");
  await user.type(screen.getByPlaceholderText("Ex: Souza"), "Souza");
  await user.type(screen.getByPlaceholderText("(00) 00000-0000"), "11999998888");
}

const salvar = () => screen.getByRole("button", { name: /Continuar|Salvar|Concluir|Salvando/ });

// Formulários longos preenchidos tecla a tecla passam de 5s com a suíte inteira em paralelo.
vi.setConfig({ testTimeout: 15000 });

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.auth.updateUser.mockResolvedValue({ error: null });
  h.refreshProfile.mockResolvedValue(undefined);
  usuario({ invite: true });
  cenario();
});

describe("ProfileSetup", () => {
  it("convite (com invite_token) pede senha; campos vazios ficam com erro", async () => {
    renderPage();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getAllByPlaceholderText("••••••••")).toHaveLength(2));
    await user.click(await screen.findByRole("checkbox"));
    await user.click(salvar());
    expect(await screen.findByText("Nome é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Sobrenome é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Telefone obrigatório")).toBeInTheDocument();
    expect(h.auth.updateUser).not.toHaveBeenCalled();
  });

  it("sem aceitar os termos o botão fica desabilitado", async () => {
    renderPage();
    await screen.findByRole("checkbox");
    expect(salvar()).toBeDisabled();
  });

  it("senha fraca/divergente é recusada antes de ir ao servidor", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await preencherBasico(user);
    const [senha, conf] = screen.getAllByPlaceholderText("••••••••");
    await user.type(senha, "abc");
    await user.type(conf, "abd");
    await user.click(salvar());
    expect(await screen.findByText("Senha deve ter pelo menos 12 caracteres")).toBeInTheDocument();
    expect(screen.getByText("As senhas não coincidem")).toBeInTheDocument();
    expect(h.auth.updateUser).not.toHaveBeenCalled();
  });

  it("fluxo completo: senha primeiro, aceite, perfil, refresh e vai ao início", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await preencherBasico(user);
    const [senha, conf] = screen.getAllByPlaceholderText("••••••••");
    await user.type(senha, SENHA);
    await user.type(conf, SENHA);
    await user.click(salvar());
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(h.auth.updateUser).toHaveBeenCalledWith({ password: SENHA });
    const insert = h.calls.find((c) => c.table === "terms_acceptances" && c.op === "insert");
    expect(insert?.payload).toMatchObject({ user_id: "u1", empresa_id: "e1", source: "profile_setup" });
    const update = h.calls.find((c) => c.table === "profiles" && c.op === "update");
    expect(update?.payload).toMatchObject({ first_name: "Maria", last_name: "Souza", onboarding_completed: true });
    expect(h.refreshProfile).toHaveBeenCalled();
  });

  it("falha ao definir a senha NÃO marca onboarding concluído", async () => {
    h.auth.updateUser.mockResolvedValue({ error: { message: "Password should be at least 12" } });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await preencherBasico(user);
    const [senha, conf] = screen.getAllByPlaceholderText("••••••••");
    await user.type(senha, SENHA);
    await user.type(conf, SENHA);
    await user.click(salvar());
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Erro ao salvar", expect.anything()));
    expect(h.calls.some((c) => c.table === "profiles" && c.op === "update")).toBe(false);
    expect(h.calls.some((c) => c.table === "terms_acceptances" && c.op === "insert")).toBe(false);
    expect(screen.queryByTestId("inicio")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: Maria")).toHaveValue("Maria");
  });

  it("erro de RLS ao salvar perfil vira mensagem segura", async () => {
    usuario({ provider: "google", identities: ["google"] });
    cenario({ updateError: { message: 'new row violates row-level security policy for table "profiles"' } });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await preencherBasico(user);
    await user.click(salvar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao salvar", {
        description: "Você não tem permissão para realizar esta ação.",
      })
    );
    expect(JSON.stringify(h.toastError.mock.calls)).not.toContain("profiles");
  });

  it("conta Google não pede senha e não chama updateUser", async () => {
    usuario({ provider: "google", identities: ["google"] });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await waitFor(() => expect(screen.queryByPlaceholderText("••••••••")).not.toBeInTheDocument());
    await preencherBasico(user);
    await user.click(salvar());
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(h.auth.updateUser).not.toHaveBeenCalled();
  });

  it("quem já aceitou os termos não vê o checkbox nem grava novo aceite", async () => {
    usuario();
    cenario({ aceite: true });
    renderPage();
    const user = userEvent.setup();
    await waitFor(() => expect(salvar()).toBeEnabled());
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await preencherBasico(user);
    await user.click(salvar());
    await screen.findByTestId("inicio");
    expect(h.calls.some((c) => c.table === "terms_acceptances" && c.op === "insert")).toBe(false);
  });

  it("falha ao gravar o aceite interrompe antes do perfil", async () => {
    usuario({ provider: "google", identities: ["google"] });
    cenario({ termsError: { message: "duplicate key value violates unique constraint" } });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await preencherBasico(user);
    await user.click(salvar());
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao salvar", {
        description: "Já existe um registro com esses dados.",
      })
    );
    expect(h.calls.some((c) => c.table === "profiles" && c.op === "update")).toBe(false);
  });

  it("admin com empresa pendente segue para o setup da empresa", async () => {
    usuario({ provider: "google", identities: ["google"] });
    cenario({ role: "admin", empresaOk: false });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await preencherBasico(user);
    await user.click(salvar());
    expect(await screen.findByTestId("company-setup")).toBeInTheDocument();
  });

  it("pré-preenche com o que já existe no perfil", async () => {
    cenario({ profile: { first_name: "Ana", last_name: "Lima", contato: "11988887777", empresa_id: "e1" } });
    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText("Ex: Maria")).toHaveValue("Ana"));
    expect(screen.getByPlaceholderText("Ex: Souza")).toHaveValue("Lima");
  });

  it("sessão perdida no envio mostra erro e não navega", async () => {
    usuario({ provider: "google", identities: ["google"] });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await preencherBasico(user);
    h.auth.getUser.mockResolvedValue({ data: { user: null } });
    await user.click(salvar());
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Erro ao salvar", expect.anything()));
    expect(screen.queryByTestId("inicio")).not.toBeInTheDocument();
  });
});
