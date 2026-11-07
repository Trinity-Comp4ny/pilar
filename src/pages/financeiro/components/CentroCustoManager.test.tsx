import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { sb } from "../testing/supabaseMock";
import { campoInput } from "../testing/dom";

// Cadastro de centros de custo: lista, criação, edição, ativar/desativar e
// exclusão lógica. Erros do banco viram aviso sem perder o que foi digitado.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { CentroCustoManager } from "./CentroCustoManager";

const centros = [
  { id: "cc-1", codigo: "ADM", nome: "Administrativo", descricao: "Back-office", ativo: true },
  { id: "cc-2", codigo: null, nome: "Obra Centro", descricao: null, ativo: false },
];

async function setup() {
  const onChanged = vi.fn();
  render(<CentroCustoManager open onOpenChange={vi.fn()} onChanged={onChanged} />);
  await screen.findByText(/Lista \(/);
  await waitFor(() => expect(screen.queryByText("Carregando centros de custo")).not.toBeInTheDocument());
  return { onChanged };
}

const botaoSalvar = (nome: "Criar" | "Atualizar") => screen.getByRole("button", { name: nome });

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  sb.resultado("centros_custo.select", { data: centros, error: null });
  sb.rpcResultado("get_user_empresa_id", { data: "emp-1", error: null });
});

describe("CentroCustoManager", () => {
  it("lista os centros ativos e inativos, sem os excluídos", async () => {
    await setup();
    expect(screen.getByText("Lista (2)")).toBeInTheDocument();
    expect(screen.getByText("Administrativo")).toBeInTheDocument();
    expect(screen.getByText("ADM")).toBeInTheDocument();
    expect(screen.getByText("Back-office")).toBeInTheDocument();
    expect(screen.getByText("inativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desativar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativar" })).toBeInTheDocument();
    expect(sb.de("centros_custo", "is")[0].args).toEqual(["deleted_at", null]);
  });

  it("fechado não busca", () => {
    render(<CentroCustoManager open={false} onOpenChange={vi.fn()} />);
    expect(sb.client.from).not.toHaveBeenCalled();
  });

  it("lista vazia mostra o estado vazio", async () => {
    sb.resultado("centros_custo.select", { data: [], error: null });
    await setup();
    expect(screen.getByText("Nenhum centro cadastrado")).toBeInTheDocument();
  });

  it("erro ao carregar avisa e mostra lista vazia", async () => {
    sb.resultado("centros_custo.select", { data: null, error: { message: "permission denied for table centros_custo" } });
    await setup();
    expect(toast.error).toHaveBeenCalledWith("Não foi possível carregar os centros de custo", {
      description: "Você não tem permissão para realizar esta ação.",
    });
    expect(screen.getByText("Lista (0)")).toBeInTheDocument();
  });

  it("criar sem nome não grava", async () => {
    await setup();
    fireEvent.change(campoInput("Nome *"), { target: { value: "   " } });
    fireEvent.click(botaoSalvar("Criar"));
    expect(toast.error).toHaveBeenCalledWith("Nome obrigatório");
    expect(sb.de("centros_custo", "insert")).toHaveLength(0);
  });

  it("cria com campos aparados e vazios como nulo, na empresa do usuário", async () => {
    const { onChanged } = await setup();
    fireEvent.change(campoInput("Código (opcional)"), { target: { value: "  " } });
    fireEvent.change(campoInput("Nome *"), { target: { value: "  Comercial " } });
    fireEvent.change(campoInput("Descrição"), { target: { value: "" } });
    await act(async () => {
      fireEvent.click(botaoSalvar("Criar"));
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(sb.de("centros_custo", "insert")[0].args[0]).toEqual({
      codigo: null,
      nome: "Comercial",
      descricao: null,
      empresa_id: "emp-1",
    });
    expect(toast.success).toHaveBeenCalledWith("Centro criado");
    expect(campoInput("Nome *")).toHaveValue("");
  });

  it("sem empresa não grava e avisa", async () => {
    sb.rpcResultado("get_user_empresa_id", { data: null, error: null });
    const { onChanged } = await setup();
    fireEvent.change(campoInput("Nome *"), { target: { value: "Comercial" } });
    await act(async () => {
      fireEvent.click(botaoSalvar("Criar"));
    });
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", expect.anything());
    expect(sb.de("centros_custo", "insert")).toHaveLength(0);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("erro do banco ao criar mantém o formulário preenchido", async () => {
    sb.resultado("centros_custo.insert", { data: null, error: { message: "duplicate key value violates unique" } });
    await setup();
    fireEvent.change(campoInput("Nome *"), { target: { value: "Administrativo" } });
    await act(async () => {
      fireEvent.click(botaoSalvar("Criar"));
    });
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", {
      description: "Já existe um registro com esses dados.",
    });
    expect(campoInput("Nome *")).toHaveValue("Administrativo");
    expect(botaoSalvar("Criar")).toBeEnabled();
  });

  it("edita um centro existente pelo id", async () => {
    const { onChanged } = await setup();
    fireEvent.click(screen.getAllByRole("button", { name: "Editar centro de custo" })[0]);
    expect(screen.getByText("Editar")).toBeInTheDocument();
    expect(campoInput("Código (opcional)")).toHaveValue("ADM");
    expect(campoInput("Descrição")).toHaveValue("Back-office");
    fireEvent.change(campoInput("Nome *"), { target: { value: "Administração" } });
    await act(async () => {
      fireEvent.click(botaoSalvar("Atualizar"));
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(sb.de("centros_custo", "update")[0].args[0]).toEqual({
      codigo: "ADM",
      nome: "Administração",
      descricao: "Back-office",
    });
    expect(sb.de("centros_custo", "eq")[0].args).toEqual(["id", "cc-1"]);
    expect(toast.success).toHaveBeenCalledWith("Centro atualizado");
    expect(sb.de("centros_custo", "insert")).toHaveLength(0);
  });

  it("cancelar edição volta para novo, com campo vazio", async () => {
    await setup();
    fireEvent.click(screen.getAllByRole("button", { name: "Editar centro de custo" })[1]);
    expect(campoInput("Código (opcional)")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: /^Novo$/ }));
    expect(screen.getByText("Novo", { selector: "div" })).toBeInTheDocument();
    expect(campoInput("Nome *")).toHaveValue("");
  });

  it("desativar inverte o ativo", async () => {
    const { onChanged } = await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(sb.de("centros_custo", "update")[0].args[0]).toEqual({ ativo: false });
  });

  it("erro ao ativar avisa e não notifica mudança", async () => {
    sb.resultado("centros_custo.update", { data: null, error: { message: "boom" } });
    const { onChanged } = await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ativar" }));
    });
    expect(toast.error).toHaveBeenCalledWith("Erro");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("exclusão pede confirmação e faz exclusão lógica", async () => {
    const { onChanged } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "Excluir Administrativo" }));
    expect(screen.getByText(/Excluir "Administrativo"\?/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const upd = sb.de("centros_custo", "update")[0].args[0] as { deleted_at: string };
    expect(Number.isNaN(Date.parse(upd.deleted_at))).toBe(false);
    expect(toast.success).toHaveBeenCalledWith("Centro excluído");
  });

  it("erro ao excluir avisa", async () => {
    sb.resultado("centros_custo.update", { data: null, error: { message: "violates foreign key constraint" } });
    const { onChanged } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "Excluir Obra Centro" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    });
    expect(toast.error).toHaveBeenCalledWith("Não foi possível excluir", {
      description: "Este registro está vinculado a outros dados e não pode ser alterado.",
    });
    expect(onChanged).not.toHaveBeenCalled();
  });
});
