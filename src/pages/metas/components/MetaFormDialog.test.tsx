import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import type { MetaRow } from "@/lib/metas";
import { MetaFormDialog } from "./MetaFormDialog";

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  profile: { empresa_id: "e1" } as { empresa_id: string } | null,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: h.profile }) }));
vi.mock("@/lib/supabaseQueries", () => ({ fetchPessoasLookup: async () => [{ id: "p1", nome: "Rita" }] }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const NOME_PH = "Ex.: Organizar a segurança social dos trabalhadores";

const META: MetaRow = {
  id: "m1",
  nome: "Entregar 10 projetos",
  alvo: 10,
  atual: 2,
  prazo: "2026-01-01",
  categoria: null,
  pessoa_id: null,
  descricao: null,
  unidade: "quantity",
  unidade_rotulo: null,
  indicador: null,
  periodo_inicio: "2026-06-01",
  recorrencia: "nenhuma",
  created_at: "2026-01-01T00:00:00Z",
};

function renderDialog(meta?: MetaRow) {
  const onOpenChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MetaFormDialog open onOpenChange={onOpenChange} meta={meta} />
    </QueryClientProvider>
  );
  return { onOpenChange, user: userEvent.setup() };
}

// Campos numéricos do formulário manual, na ordem: alvo e atual (ambos required).
const numericos = () => screen.getAllByRole("textbox").filter((el) => el.getAttribute("inputmode"));
const alvo = () => numericos()[0];
const atual = () => numericos()[1];

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.profile = { empresa_id: "e1" };
  h.resolve.mockReturnValue({ error: null });
});

describe("Metas › MetaFormDialog", () => {
  it("sem nome e alvo o salvar fica desabilitado", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Salvar meta" })).toBeDisabled();
  });

  it("valor atual vazio (required) impede o envio do formulário", async () => {
    const { user } = renderDialog();
    await user.type(screen.getByPlaceholderText(NOME_PH), "Organizar arquivo");
    await user.type(alvo(), "5");
    await user.click(screen.getByRole("button", { name: "Salvar meta" }));
    expect(atual()).toBeInvalid();
    expect(h.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("alvo zero não habilita o salvar", async () => {
    const { user } = renderDialog();
    await user.type(screen.getByPlaceholderText(NOME_PH), "Organizar arquivo");
    await user.type(alvo(), "0");
    expect(screen.getByRole("button", { name: "Salvar meta" })).toBeDisabled();
  });

  it("meta manual válida grava com a empresa do perfil e fecha", async () => {
    const { user, onOpenChange } = renderDialog();
    await user.type(screen.getByPlaceholderText(NOME_PH), "  Organizar arquivo  ");
    await user.type(alvo(), "12");
    await user.type(atual(), "3");
    await user.click(screen.getByRole("button", { name: "Salvar meta" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const ins = h.calls.find((c) => c.op === "insert");
    expect(ins?.table).toBe("metas");
    expect(ins?.payload).toMatchObject({
      nome: "Organizar arquivo",
      alvo: 12,
      empresa_id: "e1",
      indicador: null,
      auto_sync: false,
      pessoa_id: null,
    });
    expect(h.toastSuccess).toHaveBeenCalledWith("Meta criada");
  });

  it("perfil sem empresa não grava e avisa", async () => {
    h.profile = null;
    const { user, onOpenChange } = renderDialog();
    await user.type(screen.getByPlaceholderText(NOME_PH), "Organizar arquivo");
    await user.type(alvo(), "5");
    await user.type(atual(), "0");
    await user.click(screen.getByRole("button", { name: "Salvar meta" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível criar a meta", {
        description: "Sem empresa no perfil.",
      })
    );
    expect(h.calls.some((c) => c.op === "insert")).toBe(false);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("erro do banco mantém o diálogo aberto", async () => {
    h.resolve.mockReturnValue({ error: { message: "row-level security" } });
    const { user, onOpenChange } = renderDialog();
    await user.type(screen.getByPlaceholderText(NOME_PH), "Organizar arquivo");
    await user.type(alvo(), "5");
    await user.type(atual(), "0");
    await user.click(screen.getByRole("button", { name: "Salvar meta" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Não foi possível criar a meta", expect.anything()));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByPlaceholderText(NOME_PH)).toHaveValue("Organizar arquivo");
  });

  it("edição com início depois do fim avisa e bloqueia", () => {
    renderDialog(META);
    expect(screen.getByText("O início precisa ser antes do fim.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar meta" })).toBeDisabled();
  });

  it("edição válida atualiza a meta pelo id", async () => {
    const { user } = renderDialog({ ...META, periodo_inicio: "2026-01-01", prazo: "2026-12-31" });
    await user.click(screen.getByRole("button", { name: "Atualizar meta" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Meta atualizada"));
    const up = h.calls.find((c) => c.op === "update");
    expect(up?.filters).toContainEqual(["eq", "id", "m1"]);
    expect(up?.payload).toMatchObject({ nome: "Entregar 10 projetos", alvo: 10, atual: 2 });
    expect(up?.payload).not.toHaveProperty("empresa_id");
  });
});
