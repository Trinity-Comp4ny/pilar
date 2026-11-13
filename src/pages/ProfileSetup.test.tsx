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
  const perfilCarregado = profile && {
    role: c.role ?? "user",
    empresas: { nome: "Alfa Engenharia", onboarding_completed: c.empresaOk ?? true },
    ...profile,
  };
  h.resolve.mockImplementation((q) => {
    if (q.table === "profiles" && q.op === "select" && q.columns?.startsWith("role")) {
      return { data: { role: c.role ?? "user", empresas: { onboarding_completed: c.empresaOk ?? true } } };
    }
    if (q.table === "profiles" && q.op === "select") return { data: perfilCarregado };
    if (q.table === "profiles" && q.op === "update") return { error: c.updateError ?? null };
    if (q.table === "terms_acceptances" && q.op === "select") return { data: aceite ? { id: "t" } : null };
    if (q.table === "terms_acceptances" && q.op === "insert") return { error: c.termsError ?? null };
    return { data: null };
  });
}

function usuario(meta: { provider?: string; invite?: boolean; identities?: string[]; convidadoPor?: string } = {}) {
  h.auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: "u1",
        app_metadata: { provider: meta.provider ?? "email" },
        user_metadata: {
          ...(meta.invite ? { invite_token: "tok" } : {}),
          ...(meta.convidadoPor ? { convidado_por: meta.convidadoPor } : {}),
        },
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

type Usuario = ReturnType<typeof userEvent.setup>;

/** Etapa 1 (acesso): nome, sobrenome e, quando a conta ainda não tem senha, a senha. Termina em "Continuar". */
async function preencherAcesso(user: Usuario, senha?: string) {
  await user.type(screen.getByPlaceholderText("Ex: Maria"), "Maria");
  await user.type(screen.getByPlaceholderText("Ex: Souza"), "Souza");
  if (senha) await user.type(screen.getByPlaceholderText("••••••••"), senha);
  await user.click(salvar());
}

/** Etapa 2 (contato): celular e função. Não clica em salvar. */
async function preencherContato(user: Usuario) {
  await user.type(await screen.findByPlaceholderText("(00) 00000-0000"), "11999998888");
  await user.click(screen.getByRole("radio", { name: "Sócio ou diretor" }));
}

/** As duas etapas, deixando o botão final pronto para salvar. */
async function preencherBasico(user: Usuario, senha?: string) {
  await preencherAcesso(user, senha);
  await preencherContato(user);
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
    await waitFor(() => expect(screen.getAllByPlaceholderText("••••••••")).toHaveLength(1));
    await user.click(await screen.findByRole("checkbox"));
    await user.click(salvar());
    expect(await screen.findByText("Nome é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Sobrenome é obrigatório")).toBeInTheDocument();
    expect(h.auth.updateUser).not.toHaveBeenCalled();
  });

  it("sem aceitar os termos o botão fica desabilitado", async () => {
    renderPage();
    await screen.findByRole("checkbox");
    expect(salvar()).toBeDisabled();
  });

  it("senha fraca é recusada antes de avançar e de ir ao servidor", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await preencherAcesso(user, "abc");
    expect(await screen.findByText("Senha deve ter pelo menos 12 caracteres")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("(00) 00000-0000")).not.toBeInTheDocument();
    expect(h.auth.updateUser).not.toHaveBeenCalled();
  });

  it("botão de mostrar revela a senha digitada", async () => {
    renderPage();
    const user = userEvent.setup();
    const campo = await screen.findByPlaceholderText("••••••••");
    expect(campo).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(campo).toHaveAttribute("type", "text");
  });

  it("fluxo completo: senha primeiro, aceite, perfil, refresh e vai ao início", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await preencherBasico(user, SENHA);
    await user.click(salvar());
    expect(await screen.findByTestId("inicio")).toBeInTheDocument();
    expect(h.auth.updateUser).toHaveBeenCalledWith({ password: SENHA });
    const insert = h.calls.find((c) => c.table === "terms_acceptances" && c.op === "insert");
    expect(insert?.payload).toMatchObject({ user_id: "u1", empresa_id: "e1", source: "profile_setup" });
    const update = h.calls.find((c) => c.table === "profiles" && c.op === "update");
    expect(update?.payload).toMatchObject({
      first_name: "Maria",
      last_name: "Souza",
      funcao: "socio",
      onboarding_completed: true,
    });
    expect(h.refreshProfile).toHaveBeenCalled();
  });

  it("falha ao definir a senha NÃO marca onboarding concluído", async () => {
    h.auth.updateUser.mockResolvedValue({ error: { message: "Password should be at least 12" } });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await preencherBasico(user, SENHA);
    await user.click(salvar());
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Erro ao salvar", expect.anything()));
    expect(h.calls.some((c) => c.table === "profiles" && c.op === "update")).toBe(false);
    expect(h.calls.some((c) => c.table === "terms_acceptances" && c.op === "insert")).toBe(false);
    expect(screen.queryByTestId("inicio")).not.toBeInTheDocument();
    // Segue na etapa de contato, com o que foi digitado, para tentar de novo.
    expect(screen.getByPlaceholderText("(00) 00000-0000")).toHaveValue("(11) 99999-8888");
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

  it("convidado vê quem convidou, o escritório e o papel (SPEC 149)", async () => {
    usuario({ invite: true, convidadoPor: "Ana Souza" });
    cenario({ role: "coordenador" });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Boas-vindas ao Alfa Engenharia" })).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Coordenador")).toBeInTheDocument();
    expect(screen.getByText("Etapa 1 de 2")).toBeInTheDocument();
  });

  it("dono de escritório novo vê a etapa 1 de 4", async () => {
    cenario({ role: "admin", empresaOk: false });
    renderPage();
    expect(await screen.findByText("Etapa 1 de 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seu acesso" })).toBeInTheDocument();
  });

  it("avança para o contato sem salvar nada e a barra vai para a etapa 2", async () => {
    usuario({ provider: "google", identities: ["google"] });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await preencherAcesso(user);
    expect(await screen.findByText("Etapa 2 de 2")).toBeInTheDocument();
    expect(h.calls.some((c) => c.table === "profiles" && c.op === "update")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByPlaceholderText("Ex: Maria")).toHaveValue("Maria");
  });

  it("sem função escolhida não salva", async () => {
    usuario({ provider: "google", identities: ["google"] });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await preencherAcesso(user);
    await user.type(await screen.findByPlaceholderText("(00) 00000-0000"), "11999998888");
    await user.click(salvar());
    expect(await screen.findByText("Escolha sua função no escritório")).toBeInTheDocument();
    expect(h.calls.some((c) => c.table === "profiles" && c.op === "update")).toBe(false);
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
