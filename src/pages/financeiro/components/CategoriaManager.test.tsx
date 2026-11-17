import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "../testing/supabaseMock";
import { campoInput } from "../testing/dom";

// Categorias financeiras: lista por tipo, criação, edição e exclusão lógica,
// e o atalho "gerenciar" do campo Categoria do lançamento.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/select", async () => await import("../testing/nativeSelect"));

import { toast } from "sonner";
import { CategoriaCampo, CategoriaManager } from "./CategoriaManager";

const categorias = [
  { id: "c-1", nome: "Aluguel" },
  { id: "c-2", nome: "Software" },
];

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function setup(tipo: "Receita" | "Despesa" = "Despesa") {
  render(<CategoriaManager open onOpenChange={vi.fn()} tipo={tipo} />, { wrapper: Wrapper });
  await screen.findByText(/Lista \(/);
  await waitFor(() => expect(screen.queryByText("Carregando categorias")).not.toBeInTheDocument());
}

const botao = (nome: "Criar" | "Atualizar") => screen.getByRole("button", { name: nome });

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  sb.resultado("categorias_financeiras.select", { data: categorias, error: null });
  sb.rpcResultado("get_user_empresa_id", { data: "emp-1", error: null });
});

describe("CategoriaManager", () => {
  it("lista as categorias do tipo, sem as excluídas", async () => {
    await setup();
    expect(screen.getByText("Categorias de despesa")).toBeInTheDocument();
    expect(screen.getByText("Lista (2)")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
    expect(sb.de("categorias_financeiras", "eq")[0].args).toEqual(["tipo", "Despesa"]);
    expect(sb.de("categorias_financeiras", "is")[0].args).toEqual(["deleted_at", null]);
  });

  it("fechado não busca", () => {
    render(<CategoriaManager open={false} onOpenChange={vi.fn()} tipo="Receita" />, { wrapper: Wrapper });
    expect(sb.client.from).not.toHaveBeenCalled();
  });

  it("lista vazia mostra o estado vazio", async () => {
    sb.resultado("categorias_financeiras.select", { data: [], error: null });
    await setup("Receita");
    expect(screen.getByText("Nenhuma categoria cadastrada")).toBeInTheDocument();
    expect(screen.getByText("Categorias de receita")).toBeInTheDocument();
  });

  it("erro ao carregar avisa", async () => {
    sb.resultado("categorias_financeiras.select", { data: null, error: { message: "permission denied" } });
    await setup();
    expect(toast.error).toHaveBeenCalledWith("Não foi possível carregar as categorias", expect.anything());
  });

  it("criar sem nome não grava", async () => {
    await setup();
    fireEvent.click(botao("Criar"));
    expect(toast.error).toHaveBeenCalledWith("Informe o nome da categoria");
    expect(sb.de("categorias_financeiras", "insert")).toHaveLength(0);
  });

  it("recusa nome repetido, sem diferenciar caixa", async () => {
    await setup();
    fireEvent.change(campoInput("Nome *"), { target: { value: "aluguel" } });
    fireEvent.click(botao("Criar"));
    expect(toast.error).toHaveBeenCalledWith("Já existe uma categoria com esse nome");
    expect(sb.de("categorias_financeiras", "insert")).toHaveLength(0);
  });

  it("cria na empresa do usuário com o tipo certo", async () => {
    await setup();
    fireEvent.change(campoInput("Nome *"), { target: { value: "  Impostos " } });
    await act(async () => {
      fireEvent.click(botao("Criar"));
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Categoria criada"));
    expect(sb.de("categorias_financeiras", "insert")[0].args[0]).toEqual({
      nome: "Impostos",
      tipo: "Despesa",
      empresa_id: "emp-1",
    });
    expect(campoInput("Nome *")).toHaveValue("");
  });

  it("sem empresa não grava e avisa", async () => {
    sb.rpcResultado("get_user_empresa_id", { data: null, error: null });
    await setup();
    fireEvent.change(campoInput("Nome *"), { target: { value: "Impostos" } });
    await act(async () => {
      fireEvent.click(botao("Criar"));
    });
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", expect.anything());
    expect(sb.de("categorias_financeiras", "insert")).toHaveLength(0);
  });

  it("edita o nome da categoria", async () => {
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Editar Software" }));
    expect(campoInput("Nome *")).toHaveValue("Software");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar edição" }));
    expect(botao("Criar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar Software" }));
    fireEvent.change(campoInput("Nome *"), { target: { value: "Licenças" } });
    await act(async () => {
      fireEvent.click(botao("Atualizar"));
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Categoria atualizada"));
    expect(sb.de("categorias_financeiras", "update")[0].args[0]).toEqual({ nome: "Licenças" });
    expect(botao("Criar")).toBeInTheDocument();
  });

  it("exclui pela RPC de soft delete depois de confirmar", async () => {
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Excluir Aluguel" }));
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Categoria excluída"));
    expect(sb.argsRpc("rpc_soft_delete")).toEqual({ p_tabela: "categorias_financeiras", p_id: "c-1" });
  });

  it("erro ao excluir avisa", async () => {
    sb.rpcResultado("rpc_soft_delete", { data: null, error: { message: "boom" } });
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Excluir Aluguel" }));
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível excluir", expect.anything()));
  });
});

describe("CategoriaCampo", () => {
  it("o atalho gerenciar abre a tela de categorias", async () => {
    render(<CategoriaCampo value="" onChange={vi.fn()} categorias={categorias} tipo="Receita" />, {
      wrapper: Wrapper,
    });
    expect(sb.client.from).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("gerenciar"));
    expect(await screen.findByText("Categorias de receita")).toBeInTheDocument();
  });
});
