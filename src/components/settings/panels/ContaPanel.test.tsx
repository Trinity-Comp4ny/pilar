import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import { ContaPanel } from "./ContaPanel";

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  upload: vi.fn(),
  auth: {
    user: { id: "u1", email: "ana@seed.test" } as { id: string; email: string } | null,
    profile: null as null | Record<string, unknown>,
    profileError: false,
    refreshProfile: vi.fn(),
  },
  isAdmin: false,
  resetOnboarding: vi.fn(),
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
      storage: {
        from: () => ({
          upload: h.upload,
          getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }),
        }),
      },
    },
  };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isAdmin: h.isAdmin }) }));
vi.mock("@/hooks/useOnboardingState", () => ({ useOnboardingState: () => ({ reset: h.resetOnboarding }) }));
vi.mock("@/components/profile/EmailChangeCard", () => ({ EmailChangeCard: () => <div data-testid="email-card" /> }));
vi.mock("@/components/settings/SobrePilar", () => ({ SobrePilar: () => <div data-testid="sobre-pilar" /> }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));

const PERFIL = {
  id: "u1",
  first_name: "Ana",
  last_name: "Souza",
  contato: "(11) 99999-8888",
  avatar_url: null as string | null,
  empresas: { nome: "Escritório Seed" },
};

function renderPanel() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ContaPanel />
    </QueryClientProvider>
  );
}

const nomeInput = () => screen.getByLabelText("Nome *");

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.isAdmin = false;
  h.auth.user = { id: "u1", email: "ana@seed.test" };
  h.auth.profile = { ...PERFIL };
  h.auth.profileError = false;
  h.auth.refreshProfile.mockResolvedValue(undefined);
  h.resolve.mockReturnValue({ error: null });
  h.upload.mockResolvedValue({ error: null });
  h.resetOnboarding.mockResolvedValue(undefined);
});

describe("Configurações › Conta", () => {
  it("campos começam somente leitura com os dados do perfil", () => {
    renderPanel();
    expect(nomeInput()).toHaveValue("Ana");
    expect(nomeInput()).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Empresa")).toHaveValue("Escritório Seed");
  });

  it("nome vazio não salva", async () => {
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.clear(nomeInput());
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Nome é obrigatório")).toBeInTheDocument();
    expect(h.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("salvar grava só o próprio perfil, com nome aparado", async () => {
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.clear(nomeInput());
    await user.type(nomeInput(), "  Ana Maria ");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Conta atualizada", expect.anything()));
    const up = h.calls.find((c) => c.op === "update");
    expect(up?.table).toBe("profiles");
    expect(up?.payload).toMatchObject({ first_name: "Ana Maria", last_name: "Souza" });
    expect(up?.filters).toContainEqual(["eq", "id", "u1"]);
    expect(h.auth.refreshProfile).toHaveBeenCalled();
  });

  it("erro ao salvar mantém a edição e mostra mensagem segura", async () => {
    h.resolve.mockReturnValue({ error: { message: 'violates check constraint "profiles_contato_check"' } });
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível salvar", {
        description: "Os dados informados são inválidos.",
      })
    );
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });

  it("Cancelar descarta o que foi digitado", async () => {
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.clear(nomeInput());
    await user.type(nomeInput(), "Outro");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(nomeInput()).toHaveValue("Ana");
    expect(h.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("perfil que não carregou oferece tentar de novo", async () => {
    h.auth.profile = null;
    h.auth.profileError = true;
    renderPanel();
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(h.auth.refreshProfile).toHaveBeenCalled();
  });

  describe("foto de perfil", () => {
    const enviar = (file: File) =>
      fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });

    it("formato não permitido é recusado sem upload", () => {
      renderPanel();
      enviar(new File(["x"], "foto.gif", { type: "image/gif" }));
      expect(h.toastError).toHaveBeenCalledWith("Formato inválido", { description: "Use PNG, JPG ou WebP." });
      expect(h.upload).not.toHaveBeenCalled();
    });

    it("arquivo acima de 2MB é recusado sem upload", () => {
      renderPanel();
      const grande = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "foto.png", { type: "image/png" });
      enviar(grande);
      expect(h.toastError).toHaveBeenCalledWith("Arquivo muito grande", {
        description: "A foto deve ter no máximo 2MB.",
      });
      expect(h.upload).not.toHaveBeenCalled();
    });

    it("upload válido grava no caminho do próprio usuário e atualiza o perfil", async () => {
      renderPanel();
      enviar(new File(["x"], "foto.png", { type: "image/png" }));
      await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Foto atualizada"));
      expect(h.upload).toHaveBeenCalledWith("u1/avatar", expect.any(File), { upsert: true });
      const up = h.calls.find((c) => c.op === "update");
      expect((up?.payload as { avatar_url: string }).avatar_url).toMatch(/^https:\/\/cdn\.test\/u1\/avatar\?v=\d+$/);
    });

    it("falha no upload não altera o perfil", async () => {
      h.upload.mockResolvedValue({ error: { message: "Payload too large" } });
      renderPanel();
      enviar(new File(["x"], "foto.png", { type: "image/png" }));
      await waitFor(() =>
        expect(h.toastError).toHaveBeenCalledWith("Não foi possível enviar a foto", {
          description: "Confira o arquivo e tente de novo.",
        })
      );
      expect(h.calls.some((c) => c.op === "update")).toBe(false);
    });

    it("remover foto pede confirmação e zera avatar_url", async () => {
      h.auth.profile = { ...PERFIL, avatar_url: "https://cdn.test/u1/avatar" };
      renderPanel();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Remover foto de perfil" }));
      await user.click(await screen.findByRole("button", { name: "Remover foto" }));
      await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Foto removida"));
      expect(h.calls.find((c) => c.op === "update")?.payload).toEqual({ avatar_url: null });
    });
  });

  it("grava função e LinkedIn normalizado (SPEC 149)", async () => {
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("radio", { name: "Coordenação de projetos" }));
    await user.type(screen.getByPlaceholderText("linkedin.com/in/seu-perfil"), "ana-souza");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Conta atualizada", expect.anything()));
    expect(h.calls.find((c) => c.op === "update")?.payload).toMatchObject({
      funcao: "coordenador",
      linkedin_url: "https://www.linkedin.com/in/ana-souza",
    });
  });

  it("guia de primeiros passos aparece para todo mundo (SPEC 149: convidado também tem checklist)", async () => {
    renderPanel();
    await userEvent.setup().click(screen.getByRole("button", { name: "Refazer o guia" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Guia reativado", expect.anything()));
  });
});
