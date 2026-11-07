import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import type { Draft, DraftCampos, Entidade } from "./useChat";

// Card genérico de cadastro pelo agente (cliente, fornecedor, pessoa, proposta, marco...):
// campos obrigatórios barram antes do crédito, máscaras de documento/telefone/moeda, dicas
// *_nome viram o id da lista certa, e os estados criado/cancelado.

const h = vi.hoisted(() => ({
  resolve: (() => ({ data: [] })) as (q: ChainQuery) => ChainResult,
  calls: [] as ChainQuery[],
}));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from } };
});
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

import { SimpleEntityCard } from "./SimpleEntityCard";

const onConfirmar = vi.fn();
const onCancelar = vi.fn();
const onDesfazer = vi.fn();

function montar(entidade: Entidade, campos: DraftCampos | Record<string, unknown>, over: Partial<Draft> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const draft: Draft = {
    runId: "r1",
    entidade,
    campos: campos as DraftCampos,
    custoCreditos: 1,
    status: "pendente",
    ...over,
  };
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SimpleEntityCard
          index={0}
          draft={draft}
          entidade={entidade}
          onConfirmar={onConfirmar}
          onCancelar={onCancelar}
          onDesfazer={onDesfazer}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.resolve = (q) => {
    if (q.table === "clientes") return { data: [{ id: "cli-1", nome: "Lima Construtora" }] };
    if (q.table === "leads") return { data: [{ id: "lead-1", nome: "Casa Ribeiro" }] };
    if (q.table === "projetos") return { data: [{ id: "proj-1", nome: "Residência Lima" }] };
    return { data: [] };
  };
  onConfirmar.mockResolvedValue("x1");
  onCancelar.mockResolvedValue(undefined);
  onDesfazer.mockResolvedValue(undefined);
});

describe("SimpleEntityCard", () => {
  it("entidade sem configuração não renderiza nada", () => {
    const { container } = montar("lead", {});
    expect(container).toBeEmptyDOMElement();
  });

  it("cliente: obrigatório barra; máscaras de documento e telefone; cria", async () => {
    const user = userEvent.setup();
    montar("cliente", {});
    expect(screen.getByText("Novo cliente")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Criar cliente/ }));
    expect(toast.error).toHaveBeenCalledWith("Preencha: Nome");
    expect(onConfirmar).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/^Nome/), "Lima");
    await user.type(screen.getByLabelText("CPF/CNPJ"), "12345678000190");
    await user.type(screen.getByLabelText("Contato"), "11987654321");
    expect(screen.getByLabelText("CPF/CNPJ")).toHaveValue("12.345.678/0001-90");
    expect(screen.getByLabelText("Contato")).toHaveValue("(11) 98765-4321");
    await user.type(screen.getByLabelText("Endereço"), "Rua A, 10");
    await user.click(screen.getByRole("button", { name: /Criar cliente/ }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalled());
    expect(onConfirmar.mock.calls[0][1]).toBe("cliente");
    expect(onConfirmar.mock.calls[0][2]).toMatchObject({
      nome: "Lima",
      cpf_cnpj: "12.345.678/0001-90",
      endereco: "Rua A, 10",
    });
    expect(toast.success).toHaveBeenCalledWith("Novo cliente criado");
    // Cliente não tem lista de origem: não consulta o banco.
    expect(h.calls).toHaveLength(0);
  });

  it("pessoa: CPF mascarado, moeda pré-formatada e número", async () => {
    const user = userEvent.setup();
    montar("pessoa", { primeiro_nome: "Rita", sobrenome: "Alves", email: "rita@seed.test", salario_fixo: 5000 });
    expect((screen.getByLabelText("Salário fixo") as HTMLInputElement).value).toMatch(/^R\$\s5\.000,00$/);
    await user.type(screen.getByLabelText("CPF"), "12345678901");
    expect(screen.getByLabelText("CPF")).toHaveValue("123.456.789-01");
    await user.type(screen.getByLabelText("Valor por m²"), "1550");
    await user.clear(screen.getByLabelText("Salário fixo"));
    await user.click(screen.getByRole("button", { name: /Cadastrar pessoa/ }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalled());
    expect(onConfirmar.mock.calls[0][2]).toMatchObject({
      valor_m2: 15.5,
      salario_fixo: undefined,
      cpf: "123.456.789-01",
    });
  });

  it("proposta: resolve cliente e lead pelas dicas e lê só os não excluídos", async () => {
    const user = userEvent.setup();
    montar("proposta", { titulo: "Projeto casa", cliente_nome: "lima", lead_nome: "Casa Ribeiro Fase 2" });
    await waitFor(() => expect(h.calls.length).toBe(2));
    expect(h.calls.map((c) => c.table).sort()).toEqual(["clientes", "leads"]);
    expect(h.calls[0].filters).toContainEqual(["is", "deleted_at", null]);
    await user.type(screen.getByLabelText("Prazo (dias)"), "45");
    await user.type(screen.getByLabelText("Observação"), "Inclui aprovação");
    // As dicas viram a opção selecionada nos selects.
    expect(await screen.findByText("Lima Construtora")).toBeInTheDocument();
    expect(screen.getByText("Casa Ribeiro")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Criar proposta/ }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalledTimes(1));
    expect(onConfirmar.mock.calls[0][2]).toMatchObject({
      cliente_id: "cli-1",
      lead_id: "lead-1",
      prazo_estimado_dias: 45,
      observacao: "Inclui aprovação",
    });
  });

  it("marco: projeto obrigatório sem dica que case barra a criação", async () => {
    const user = userEvent.setup();
    montar("marco", { nome: "Entrega 1", valor: 1000, projeto_nome: "não existe" });
    await waitFor(() => expect(h.calls.length).toBe(1));
    await user.click(screen.getByRole("button", { name: /Criar marco/ }));
    expect(toast.error).toHaveBeenCalledWith("Preencha: Projeto");
  });

  it("disciplina: escolhe projeto e prioridade nos selects", async () => {
    const user = userEvent.setup();
    montar("disciplina", { nome: "Elétrica" });
    await waitFor(() => expect(h.calls.length).toBe(1));
    await user.click(screen.getByLabelText(/^Projeto/));
    await user.click(await screen.findByRole("option", { name: "Residência Lima" }));
    await user.click(screen.getByLabelText("Prioridade"));
    await user.click(await screen.findByRole("option", { name: "Alta" }));
    await user.click(screen.getByRole("button", { name: /Adicionar disciplina/ }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalled());
    expect(onConfirmar.mock.calls[0][2]).toMatchObject({ projeto_id: "proj-1", prioridade: "Alta", nome: "Elétrica" });
  });

  it("fornecedor com CNPJ mascarado; falha ao criar mostra o motivo", async () => {
    onConfirmar.mockRejectedValue(new Error("CNPJ já cadastrado"));
    const user = userEvent.setup();
    montar("fornecedor", { nome: "Papelaria" });
    await user.type(screen.getByLabelText("CNPJ"), "11222333000181");
    expect(screen.getByLabelText("CNPJ")).toHaveValue("11.222.333/0001-81");
    await user.click(screen.getByRole("button", { name: /Criar fornecedor/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível criar", { description: "CNPJ já cadastrado" })
    );
  });

  it("cancelar chama o descarte", async () => {
    const user = userEvent.setup();
    montar("centro_custo", { nome: "Obra" });
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancelar).toHaveBeenCalledWith("r1");
  });

  it("criado: link para a área e desfazer; falha ao desfazer avisa", async () => {
    const user = userEvent.setup();
    montar("cliente", { nome: "Lima" }, { status: "criado", entityId: "cli-9" });
    expect(screen.getByText("Novo cliente criado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver/ })).toHaveAttribute("href", "/clientes");
    await user.click(screen.getByRole("button", { name: /Desfazer/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Desfeito"));
    expect(onDesfazer).toHaveBeenCalledWith("r1", "cliente", "cli-9");
    onDesfazer.mockRejectedValueOnce(new Error("x"));
    await user.click(screen.getByRole("button", { name: /Desfazer/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível desfazer"));
  });

  it("criado sem id não desfaz; cancelado mostra descartado e não busca listas", async () => {
    const user = userEvent.setup();
    const { unmount } = montar("cliente", {}, { status: "criado" });
    await user.click(screen.getByRole("button", { name: /Desfazer/ }));
    expect(onDesfazer).not.toHaveBeenCalled();
    unmount();
    montar("marco", {}, { status: "cancelado" });
    expect(screen.getByText("Rascunho descartado.")).toBeInTheDocument();
    expect(h.calls).toHaveLength(0);
  });
});
