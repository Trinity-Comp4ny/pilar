import { clicarAcaoDe, itemDeAcao } from "@/test/acoesLinha";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import { EmpresaPanel } from "./EmpresaPanel";

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  invoke: vi.fn(),
  getUser: vi.fn(),
  requireAal2: vi.fn(),
  role: "admin",
  status: "active",
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return {
    supabase: {
      from: chain.from,
      auth: { getUser: h.getUser },
      functions: { invoke: h.invoke },
      storage: { from: () => ({ upload: vi.fn(), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
    },
  };
});
vi.mock("@/hooks/useRequireAal2", () => ({ useRequireAal2: () => h.requireAal2 }));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function cenario() {
  h.resolve.mockImplementation((q) => {
    if (q.table === "profiles" && q.op === "select" && q.columns?.includes("empresas(")) {
      return {
        data: {
          id: "u1",
          empresa_id: "e1",
          role: h.role,
          empresas: { nome: "Escritório Seed", cnpj: "", status: h.status, email: "contato@seed.test" },
        },
      };
    }
    if (q.table === "profiles" && q.op === "select" && q.columns === "empresa_id")
      return { data: { empresa_id: "e1" } };
    if (q.table === "profiles" && q.op === "select") {
      return {
        data: [
          { id: "u1", first_name: "Ana", last_name: "Admin", email: "ana@seed.test", role: "admin" },
          { id: "u2", first_name: "Bia", last_name: "User", email: "bia@seed.test", role: "user" },
        ],
      };
    }
    return { error: null };
  });
}

async function renderPanel() {
  render(
    <MemoryRouter>
      <EmpresaPanel />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByLabelText("Nome da Empresa")).toHaveValue("Escritório Seed"));
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.role = "admin";
  h.status = "active";
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  h.requireAal2.mockResolvedValue(true);
  h.invoke.mockResolvedValue({ data: {}, error: null });
  cenario();
});

describe("Configurações › Empresa", () => {
  it("não-admin vê os dados mas não edita nem convida", async () => {
    h.role = "user";
    const user = await renderPanel();
    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
    await user.click(screen.getByRole("tab", { name: /Usuários/ }));
    expect(screen.queryByRole("button", { name: "Adicionar usuário" })).not.toBeInTheDocument();
  });

  it("admin salva os dados da empresa no próprio tenant", async () => {
    const user = await renderPanel();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.clear(screen.getByLabelText("Nome da Empresa"));
    await user.type(screen.getByLabelText("Nome da Empresa"), "Seed Engenharia");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Dados salvos", expect.anything()));
    const up = h.calls.find((c) => c.table === "empresas" && c.op === "update");
    expect(up?.payload).toMatchObject({ nome: "Seed Engenharia", status: "active" });
    expect(up?.filters).toContainEqual(["eq", "id", "e1"]);
  });

  it("erro ao salvar mostra mensagem segura e mantém a edição", async () => {
    const original = h.resolve.getMockImplementation()!;
    h.resolve.mockImplementation((q) =>
      q.table === "empresas" && q.op === "update"
        ? { error: { message: 'new row violates row-level security policy for table "empresas"' } }
        : original(q)
    );
    const user = await renderPanel();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível salvar", {
        description: "Você não tem permissão para realizar esta ação.",
      })
    );
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });

  it("status suspenso exige confirmação forte (risco de se trancar fora)", async () => {
    h.status = "suspended";
    cenario();
    const user = await renderPanel();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Suspender a empresa?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(h.calls.some((c) => c.table === "empresas" && c.op === "update")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await user.click(await screen.findByRole("button", { name: "Suspender empresa" }));
    await waitFor(() => expect(h.calls.some((c) => c.table === "empresas" && c.op === "update")).toBe(true));
  });

  describe("convite", () => {
    it("sem nome ou email o botão fica desabilitado", async () => {
      const user = await renderPanel();
      await user.click(screen.getByRole("tab", { name: /Usuários/ }));
      const add = screen.getByRole("button", { name: "Adicionar usuário" });
      expect(add).toBeDisabled();
      await user.type(screen.getByPlaceholderText("Nome"), "Caio");
      expect(add).toBeDisabled();
    });

    it("email em formato inválido avisa no campo e não envia", async () => {
      const user = await renderPanel();
      await user.click(screen.getByRole("tab", { name: /Usuários/ }));
      await user.type(screen.getByPlaceholderText("Nome"), "Caio");
      const email = screen.getByPlaceholderText("email@empresa.com");
      await user.type(email, "caio@seed");
      expect(screen.getByText("E-mail em formato inválido")).toBeInTheDocument();
      expect(email).toHaveAttribute("aria-invalid", "true");
      expect(email).toHaveAccessibleDescription("E-mail em formato inválido");
      expect(screen.getByRole("button", { name: "Adicionar usuário" })).toBeDisabled();
      await user.type(email, ".test");
      expect(screen.queryByText("E-mail em formato inválido")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Adicionar usuário" })).toBeEnabled();
      expect(h.invoke).not.toHaveBeenCalled();
    });

    it("botões de editar e remover usuário têm nome acessível", async () => {
      const user = await renderPanel();
      await user.click(screen.getByRole("tab", { name: /Usuários/ }));
      expect(screen.getByRole("button", { name: "Mais ações de Bia User" })).toBeInTheDocument();
      expect(await itemDeAcao(user, "Bia User", "Editar")).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Remover" })).toBeInTheDocument();
    });

    it("2FA negado não envia o convite", async () => {
      h.requireAal2.mockResolvedValue(false);
      const user = await renderPanel();
      await user.click(screen.getByRole("tab", { name: /Usuários/ }));
      await user.type(screen.getByPlaceholderText("Nome"), "Caio");
      await user.type(screen.getByPlaceholderText("email@empresa.com"), "caio@seed.test");
      await user.click(screen.getByRole("button", { name: "Adicionar usuário" }));
      await waitFor(() => expect(h.requireAal2).toHaveBeenCalled());
      expect(h.invoke).not.toHaveBeenCalled();
    });

    it("sucesso envia e limpa o formulário", async () => {
      const user = await renderPanel();
      await user.click(screen.getByRole("tab", { name: /Usuários/ }));
      await user.type(screen.getByPlaceholderText("Nome"), "Caio");
      await user.type(screen.getByPlaceholderText("Sobrenome"), "Reis");
      await user.type(screen.getByPlaceholderText("email@empresa.com"), " caio@seed.test ");
      await user.click(screen.getByRole("button", { name: "Adicionar usuário" }));
      await waitFor(() =>
        expect(h.invoke).toHaveBeenCalledWith("invite-user", {
          body: { email: "caio@seed.test", nome: "Caio Reis", role: "user" },
        })
      );
      await waitFor(() => expect(screen.getByPlaceholderText("Nome")).toHaveValue(""));
    });

    it("falha mantém o formulário preenchido", async () => {
      h.invoke.mockResolvedValue({ data: null, error: new Error("non-2xx") });
      const user = await renderPanel();
      await user.click(screen.getByRole("tab", { name: /Usuários/ }));
      await user.type(screen.getByPlaceholderText("Nome"), "Caio");
      await user.type(screen.getByPlaceholderText("email@empresa.com"), "caio@seed.test");
      await user.click(screen.getByRole("button", { name: "Adicionar usuário" }));
      await waitFor(() =>
        expect(h.toastError).toHaveBeenCalledWith("Erro ao convidar", {
          description: "Não foi possível enviar o convite. Tente de novo em instantes.",
        })
      );
      expect(screen.getByPlaceholderText("email@empresa.com")).toHaveValue("caio@seed.test");
    });
  });

  it("falha ao carregar avisa", async () => {
    h.getUser.mockRejectedValue(new Error("offline"));
    render(
      <MemoryRouter>
        <EmpresaPanel />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível carregar os dados da empresa", {
        description: "Atualize a página em instantes.",
      })
    );
  });
});
