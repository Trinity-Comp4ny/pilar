import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sb } from "../testing/supabaseMock";
import { campoSelect } from "../testing/dom";
import type { Fatura } from "../hooks/useFaturas";

// Pagamento de fatura de cartão: debita uma conta. Integral, parcial, acima do
// saldo, valor zero/negativo, sem conta e erro do servidor.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("@/components/ui/select", async () => await import("../testing/nativeSelect"));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { FaturaPagamentoDialog } from "./FaturaPagamentoDialog";

const contas = [
  { id: "conta-1", nome: "Itaú PJ" },
  { id: "conta-2", nome: "Nubank" },
];

const faturaBase: Fatura = {
  id: "fat-1",
  cartao_id: "cartao-1",
  cartao_nome: "Visa Empresa",
  cartao_cor: null,
  mes_referencia: 10,
  ano_referencia: 2026,
  data_inicio: "2026-09-06",
  data_fim: "2026-10-05",
  data_vencimento: "2026-10-15",
  status: "Fechada",
  data_pagamento: null,
  conta_pagamento_id: "conta-1",
  conta_pagamento_nome: "Itaú PJ",
  valor_total: 2500,
  valor_pago: 0,
  qtd_despesas: 7,
};

function setup(fatura: Fatura = faturaBase) {
  const onOpenChange = vi.fn();
  const onPaid = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FaturaPagamentoDialog fatura={fatura} contas={contas} open onOpenChange={onOpenChange} onPaid={onPaid} />
    </QueryClientProvider>
  );
  return { onOpenChange, onPaid };
}

const campoValor = () => screen.getByRole("spinbutton") as HTMLInputElement;
const confirmar = () => fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  sb.rpcResultado("pagar_fatura", { data: null, error: null });
});

describe("FaturaPagamentoDialog", () => {
  it("abre com a conta padrão do cartão e o saldo devedor preenchidos", () => {
    setup();
    expect(screen.getByText("Visa Empresa — Outubro 2026")).toBeInTheDocument();
    expect(campoSelect("Conta bancária para pagamento")).toHaveValue("conta-1");
    expect(campoValor()).toHaveValue(2500);
  });

  it("pagamento integral chama pagar_fatura com o valor e fecha", async () => {
    const { onOpenChange, onPaid } = setup();
    confirmar();
    await waitFor(() => expect(onPaid).toHaveBeenCalled());
    expect(sb.argsRpc("pagar_fatura")).toMatchObject({
      p_fatura_id: "fat-1",
      p_conta_id: "conta-1",
      p_valor_pago: 2500,
      p_idempotency_key: expect.any(String),
    });
    expect(toast.success).toHaveBeenCalledWith("Fatura paga com sucesso!");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("pagamento parcial usa o valor digitado e a conta escolhida", async () => {
    const { onPaid } = setup();
    fireEvent.change(campoSelect("Conta bancária para pagamento"), { target: { value: "conta-2" } });
    fireEvent.change(campoValor(), { target: { value: "1000.50" } });
    confirmar();
    await waitFor(() => expect(onPaid).toHaveBeenCalled());
    expect(sb.argsRpc("pagar_fatura")).toMatchObject({ p_conta_id: "conta-2", p_valor_pago: 1000.5 });
  });

  it("fatura já parcialmente paga mostra o restante e pré-preenche só ele", () => {
    setup({ ...faturaBase, valor_pago: 1000 });
    expect(screen.getByText("Já pago")).toBeInTheDocument();
    expect(screen.getByText("Restante")).toBeInTheDocument();
    expect(campoValor()).toHaveValue(1500);
  });

  it("quitar o restante com centavos não é barrado por erro de ponto flutuante", async () => {
    // 1000,30 − 500,10 em float dá 500,19999…; o restante pré-preenchido (500,20)
    // era recusado como "acima do saldo devedor" e a fatura não podia ser quitada.
    const { onPaid } = setup({ ...faturaBase, valor_total: 1000.3, valor_pago: 500.1 });
    expect(campoValor()).toHaveValue(500.2);
    confirmar();
    await waitFor(() => expect(onPaid).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
    expect(sb.argsRpc("pagar_fatura")).toMatchObject({ p_valor_pago: 500.2 });
  });

  it("valor acima do saldo devedor é recusado", () => {
    setup();
    fireEvent.change(campoValor(), { target: { value: "2500.01" } });
    confirmar();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/^Valor acima do saldo devedor \(R\$\s2\.500,00\)$/)
    );
    expect(sb.client.rpc).not.toHaveBeenCalled();
  });

  it.each(["0", "-10", ""])("valor %j é recusado", (v) => {
    setup();
    fireEvent.change(campoValor(), { target: { value: v } });
    confirmar();
    expect(toast.error).toHaveBeenCalledWith("Informe um valor de pagamento válido");
    expect(sb.client.rpc).not.toHaveBeenCalled();
  });

  it("sem conta de pagamento o botão fica desabilitado e há aviso", () => {
    setup({ ...faturaBase, conta_pagamento_id: null });
    expect(screen.getByText("Selecione a conta bancária de onde o pagamento será debitado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeDisabled();
  });

  it("erro do servidor mantém o dialog aberto e avisa", async () => {
    sb.rpcResultado("pagar_fatura", { data: null, error: { message: "saldo insuficiente" } });
    const { onOpenChange, onPaid } = setup();
    confirmar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao pagar fatura"));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onPaid).not.toHaveBeenCalled();
    expect(campoValor()).toHaveValue(2500);
  });
});
