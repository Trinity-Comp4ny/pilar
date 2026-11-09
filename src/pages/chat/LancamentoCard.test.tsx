import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Draft, DraftCampos } from "./useChat";

// Card de lançamento do agente financeiro: as dicas de nome viram ids quando as listas carregam,
// a validação barra antes de gastar crédito (descrição, valor, cartão, vencimento de parcelado,
// conta para quitado), cartão nasce Pendente sem conta e desfazer parcelado apaga o grupo.

const aux = vi.hoisted(() => ({
  loading: false,
  categorias: [
    { id: "cat-1", nome: "Honorários" },
    { id: "cat-2", nome: "Material" },
  ],
  projetos: [{ id: "proj-1", nome: "Residência Lima", cliente_id: null }],
  contas: [{ id: "conta-1", nome: "Itaú PJ" }],
  centrosCusto: [],
  clientes: [{ id: "cli-1", nome: "Lima Construtora", chaves_pix: [] }],
  fornecedores: [{ id: "for-1", nome: "Papelaria Central" }],
  cartoes: [{ id: "car-1", nome: "Nubank PJ", tipo: "credito" }],
}));
vi.mock("@/pages/financeiro/hooks/useFinanceAuxData", () => ({ useFinanceAuxData: () => aux }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

import { LancamentoCard } from "./LancamentoCard";

const onConfirmar = vi.fn();
const onCancelar = vi.fn();
const onDesfazer = vi.fn();

function draft(campos: DraftCampos, over: Partial<Draft> = {}): Draft {
  return { runId: "r1", entidade: "receita", campos, custoCreditos: 1, status: "pendente", ...over };
}

function montar(tipo: "receita" | "despesa", d: Draft) {
  return render(
    <MemoryRouter>
      <LancamentoCard
        index={0}
        draft={d}
        tipo={tipo}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
        onDesfazer={onDesfazer}
      />
    </MemoryRouter>
  );
}

const lancar = (tipo: "receita" | "despesa") =>
  userEvent.click(screen.getByRole("button", { name: tipo === "receita" ? /Lançar receita/ : /Lançar despesa/ }));

beforeEach(() => {
  vi.clearAllMocks();
  aux.loading = false;
  onConfirmar.mockResolvedValue("rec-1");
  onCancelar.mockResolvedValue(undefined);
  onDesfazer.mockResolvedValue(undefined);
});

describe("LancamentoCard: receita", () => {
  it("resolve as dicas de categoria, cliente e projeto e lança", async () => {
    montar(
      "receita",
      draft({
        descricao: "Honorário etapa 2",
        valor: 1500,
        categoria_nome: "honorários",
        cliente_nome: "Lima",
        projeto_nome: "residência",
      })
    );
    expect((screen.getByLabelText(/Valor/) as HTMLInputElement).value).toMatch(/^R\$\s1\.500,00$/);
    await lancar("receita");
    await waitFor(() => expect(onConfirmar).toHaveBeenCalled());
    const [runId, entidade, payload] = onConfirmar.mock.calls[0];
    expect(runId).toBe("r1");
    expect(entidade).toBe("receita");
    expect(payload).toMatchObject({
      categoria_id: "cat-1",
      cliente_id: "cli-1",
      projeto_id: "proj-1",
      status: "Pendente",
      cartao_id: undefined,
    });
    expect(toast.success).toHaveBeenCalledWith("Receita lançada");
  });

  it("dica que não casa com nada fica sem id", async () => {
    montar("receita", draft({ descricao: "X", valor: 10, categoria_nome: "inexistente", projeto_nome: "outro" }));
    await lancar("receita");
    await waitFor(() => expect(onConfirmar).toHaveBeenCalled());
    expect(onConfirmar.mock.calls[0][2].categoria_id).toBeUndefined();
    expect(onConfirmar.mock.calls[0][2].projeto_id).toBeUndefined();
  });

  it("enquanto as listas carregam não resolve nada", async () => {
    aux.loading = true;
    montar("receita", draft({ descricao: "X", valor: 10, categoria_nome: "honorários" }));
    await lancar("receita");
    await waitFor(() => expect(onConfirmar).toHaveBeenCalled());
    expect(onConfirmar.mock.calls[0][2].categoria_id).toBeUndefined();
  });

  it("sem descrição ou sem valor não lança", async () => {
    montar("receita", draft({ valor: 100 }));
    await lancar("receita");
    expect(toast.error).toHaveBeenCalledWith("Informe a descrição");
    await userEvent.type(screen.getByLabelText(/Descrição/), "Honorário");
    await userEvent.clear(screen.getByLabelText(/Valor/));
    await lancar("receita");
    expect(toast.error).toHaveBeenCalledWith("Informe um valor maior que zero");
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("digitar o valor aplica a máscara de moeda", async () => {
    montar("receita", draft({ descricao: "X" }));
    await userEvent.type(screen.getByLabelText(/Valor/), "12345");
    expect((screen.getByLabelText(/Valor/) as HTMLInputElement).value).toMatch(/^R\$\s123,45$/);
    await lancar("receita");
    await waitFor(() => expect(onConfirmar.mock.calls[0][2].valor).toBe(123.45));
  });

  it("recebida sem conta pede a conta", async () => {
    montar("receita", draft({ descricao: "X", valor: 10, status: "Recebido" }));
    await lancar("receita");
    expect(toast.error).toHaveBeenCalledWith("Selecione a conta para o recebimento");
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("parcelado: mostra o valor da parcela e exige vencimento", async () => {
    montar("receita", draft({ descricao: "Contrato", valor: 3000, parcelas: 3 }));
    expect(screen.getByText(/3x de R\$\s?1\.000,00/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    await lancar("receita");
    expect(toast.error).toHaveBeenCalledWith("Informe a data de vencimento da 1ª parcela");
  });

  it("falha ao lançar mostra o motivo do banco", async () => {
    onConfirmar.mockRejectedValue(new Error("Categoria inativa"));
    montar("receita", draft({ descricao: "X", valor: 10 }));
    await lancar("receita");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível lançar a receita", {
        description: "Categoria inativa",
      })
    );
  });

  it("cancelar descarta o rascunho", async () => {
    montar("receita", draft({ descricao: "X" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancelar).toHaveBeenCalledWith("r1");
  });

  it("mais campos mostra categoria, cliente, projeto e observação", async () => {
    montar("receita", draft({ descricao: "X" }));
    await userEvent.click(screen.getByRole("button", { name: /Categoria, cliente, projeto/ }));
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Observação"), "NF 123");
    await userEvent.click(screen.getByRole("button", { name: "Menos campos" }));
    expect(screen.queryByLabelText("Observação")).not.toBeInTheDocument();
  });

  it("estados finais: criado com atalho e desfazer; cancelado", async () => {
    const { unmount } = montar(
      "receita",
      draft({ descricao: "Honorário", valor: 200 }, { status: "criado", entityId: "rec-1" })
    );
    expect(screen.getByText("Receita lançada")).toBeInTheDocument();
    expect(screen.getByText(/Honorário · R\$\s?200,00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver no Financeiro/ })).toHaveAttribute("href", "/gestao/financeiro");
    await userEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    await waitFor(() => expect(onDesfazer).toHaveBeenCalledWith("r1", "receita", "rec-1", false));
    expect(toast.success).toHaveBeenCalledWith("Lançamento desfeito");
    unmount();
    montar("receita", draft({}, { status: "cancelado" }));
    expect(screen.getByText("Rascunho descartado.")).toBeInTheDocument();
  });

  it("desfazer parcelado apaga o grupo; falha avisa; sem id não faz nada", async () => {
    onDesfazer.mockRejectedValueOnce(new Error("x"));
    const { unmount } = montar(
      "receita",
      draft({ descricao: "C", valor: 300, parcelas: 3 }, { status: "criado", entityId: "g1" })
    );
    await userEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível desfazer"));
    expect(onDesfazer).toHaveBeenCalledWith("r1", "receita", "g1", true);
    unmount();
    onDesfazer.mockClear();
    montar("receita", draft({ descricao: "C" }, { status: "criado" }));
    await userEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    expect(onDesfazer).not.toHaveBeenCalled();
  });
});

describe("LancamentoCard: despesa", () => {
  it("dica de cartão abre no modo cartão e resolve fornecedor e cartão", async () => {
    montar(
      "despesa",
      draft(
        {
          descricao: "Resma",
          valor: 80,
          cartao_nome: "nubank",
          fornecedor_nome: "Papelaria",
          conta_id: "conta-1",
          parcelas: 2,
        },
        { entidade: "despesa" }
      )
    );
    expect(screen.getByText(/Despesa de cartão entra na fatura/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Parcelas")).not.toBeInTheDocument();
    await lancar("despesa");
    await waitFor(() => expect(onConfirmar).toHaveBeenCalled());
    expect(onConfirmar.mock.calls[0][2]).toMatchObject({
      cartao_id: "car-1",
      fornecedor_id: "for-1",
      status: "Pendente",
      conta_id: undefined,
      parcelas: undefined,
    });
    expect(toast.success).toHaveBeenCalledWith("Despesa lançada");
  });

  it("modo cartão sem cartão escolhido não lança", async () => {
    montar("despesa", draft({ descricao: "Resma", valor: 80 }, { entidade: "despesa" }));
    await userEvent.click(screen.getByRole("button", { name: "Cartão" }));
    await lancar("despesa");
    expect(toast.error).toHaveBeenCalledWith("Selecione o cartão");
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("voltar para conta limpa o cartão e mantém a quitação", async () => {
    montar(
      "despesa",
      draft(
        { descricao: "Resma", valor: 80, cartao_id: "car-1", status: "Pago", conta_id: "conta-1" },
        { entidade: "despesa" }
      )
    );
    await userEvent.click(screen.getByRole("button", { name: "Conta" }));
    await lancar("despesa");
    await waitFor(() => expect(onConfirmar).toHaveBeenCalled());
    expect(onConfirmar.mock.calls[0][2]).toMatchObject({ status: "Pago", conta_id: "conta-1" });
    expect(onConfirmar.mock.calls[0][2].cartao_id).toBeUndefined();
  });

  it("despesa paga sem conta é barrada", async () => {
    montar("despesa", draft({ descricao: "Resma", valor: 80, status: "Pago" }, { entidade: "despesa" }));
    await lancar("despesa");
    expect(toast.error).toHaveBeenCalledWith("Selecione a conta para o pagamento");
  });

  it("falha ao lançar despesa avisa com o texto certo", async () => {
    onConfirmar.mockRejectedValue(new Error("Failed to fetch"));
    montar("despesa", draft({ descricao: "Resma", valor: 80 }, { entidade: "despesa" }));
    await lancar("despesa");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível lançar a despesa", {
        description: "Tente de novo em instantes.",
      })
    );
  });
});
