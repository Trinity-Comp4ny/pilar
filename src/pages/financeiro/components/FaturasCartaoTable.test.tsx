import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { Fatura } from "../hooks/useFaturas";

// Faturas do cartão: gera as faturas que faltam ao abrir (idempotente), lista
// da mais recente para a mais antiga, mostra restante de pagamento parcial e
// só oferece Pagar em fatura fechada/parcial com valor.

const estado: { data: Fatura[]; isLoading: boolean; error: unknown } = { data: [], isLoading: false, error: null };
const gerarFaturasCartao = vi.fn(async (_id: string) => undefined);
const invalidate = vi.fn();

vi.mock("../hooks/useFaturas", () => ({
  useFaturas: () => estado,
  useInvalidateFaturas: () => invalidate,
  gerarFaturasCartao: (id: string) => gerarFaturasCartao(id),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { FaturasCartaoTable } from "./FaturasCartaoTable";

const fatura = (p: Partial<Fatura>): Fatura => ({
  id: "f",
  cartao_id: "k1",
  cartao_nome: "Visa",
  cartao_cor: null,
  mes_referencia: 10,
  ano_referencia: 2026,
  data_inicio: "2026-09-06",
  data_fim: "2026-10-05",
  data_vencimento: "2099-10-15",
  status: "Fechada",
  data_pagamento: null,
  conta_pagamento_id: null,
  conta_pagamento_nome: null,
  valor_total: 1000,
  valor_pago: 0,
  qtd_despesas: 4,
  ...p,
});

async function setup(cartaoId = "k1") {
  const onDetalhe = vi.fn();
  const onPagar = vi.fn();
  await act(async () => {
    render(<FaturasCartaoTable cartaoId={cartaoId} onDetalhe={onDetalhe} onPagar={onPagar} />);
  });
  return { onDetalhe, onPagar };
}

const linhas = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

beforeEach(() => {
  vi.clearAllMocks();
  estado.data = [];
  estado.isLoading = false;
  estado.error = null;
  gerarFaturasCartao.mockResolvedValue(undefined);
});

describe("FaturasCartaoTable", () => {
  it("gera as faturas do cartão ao abrir e atualiza a lista", async () => {
    await setup("k1");
    expect(gerarFaturasCartao).toHaveBeenCalledWith("k1");
    expect(invalidate).toHaveBeenCalled();
  });

  it("sem cartão não gera nada", async () => {
    await setup("");
    expect(gerarFaturasCartao).not.toHaveBeenCalled();
  });

  it("falha ao gerar avisa (erro do Postgres sem ser Error)", async () => {
    gerarFaturasCartao.mockRejectedValueOnce({ message: "permission denied for function gerar_faturas" });
    await setup();
    expect(toast.error).toHaveBeenCalledWith("Erro ao carregar faturas", {
      description: "permission denied for function gerar_faturas",
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("falha sem mensagem usa o texto padrão", async () => {
    gerarFaturasCartao.mockRejectedValueOnce(null);
    await setup();
    expect(toast.error).toHaveBeenCalledWith("Erro ao carregar faturas", { description: "Erro ao gerar faturas" });
  });

  it("sem faturas mostra a mensagem vazia", async () => {
    await setup();
    expect(screen.getByText("Nenhuma fatura encontrada para este cartão.")).toBeInTheDocument();
  });

  it("erro na consulta mostra o estado de erro", async () => {
    estado.error = new Error("boom");
    await setup();
    expect(screen.getByText("Não foi possível carregar as faturas")).toBeInTheDocument();
  });

  it("ordena da referência mais recente e mostra restante do parcial", async () => {
    estado.data = [
      fatura({ id: "a", mes_referencia: 8, status: "Paga", valor_pago: 1000 }),
      fatura({ id: "b", mes_referencia: 10, status: "Parcial", valor_pago: 400 }),
      fatura({ id: "c", mes_referencia: 9, status: "Aberta" }),
    ];
    await setup();
    const [l1, l2, l3] = linhas();
    expect(l1).toHaveTextContent("Outubro 2026");
    expect(l1).toHaveTextContent(/Restante: R\$\s?600,00/);
    expect(l2).toHaveTextContent("Setembro 2026");
    expect(l3).toHaveTextContent("Agosto 2026");
    // paga não mostra restante
    expect(l3).not.toHaveTextContent("Restante");
  });

  it("Pagar só em fatura fechada/parcial com valor; não abre o detalhe junto", async () => {
    estado.data = [
      fatura({ id: "fechada", mes_referencia: 10 }),
      fatura({ id: "aberta", mes_referencia: 9, status: "Aberta" }),
      fatura({ id: "zerada", mes_referencia: 8, valor_total: 0 }),
      fatura({ id: "paga", mes_referencia: 7, status: "Paga" }),
    ];
    const { onPagar, onDetalhe } = await setup();
    const botoes = screen.getAllByRole("button", { name: /Pagar/ });
    expect(botoes).toHaveLength(1);
    fireEvent.click(botoes[0]);
    expect(onPagar).toHaveBeenCalledWith(expect.objectContaining({ id: "fechada" }));
    expect(onDetalhe).not.toHaveBeenCalled();
  });

  it("clicar na linha abre o detalhe", async () => {
    estado.data = [fatura({ id: "x" })];
    const { onDetalhe } = await setup();
    fireEvent.click(screen.getByText("Outubro 2026"));
    expect(onDetalhe).toHaveBeenCalledWith(expect.objectContaining({ id: "x" }));
  });
});
