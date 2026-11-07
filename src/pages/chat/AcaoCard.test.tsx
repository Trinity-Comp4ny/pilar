import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import type { Acao } from "./useChat";

// Ação do agente sobre entidade existente: lista os alvos certos por operação, pede conta para
// pagar fatura, e-mail para convite ao portal (pré-preenchido pelo cliente) e quantidade opcional
// para quitar parcelas. Sem alvo, o botão nem libera.

const h = vi.hoisted(() => ({
  resolve: (() => ({ data: [] })) as (q: ChainQuery) => ChainResult,
  calls: [] as ChainQuery[],
  track: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from } };
});
vi.mock("@/lib/analytics", () => ({ analytics: { track: h.track } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

import { AcaoCard } from "./AcaoCard";

const onExecutar = vi.fn();
const onCancelar = vi.fn();

const DADOS: Record<string, unknown[]> = {
  leads: [{ id: "l1", nome: "Casa Ribeiro" }],
  propostas: [{ id: "pr1", titulo: "Proposta Lima" }],
  receitas: [{ id: "r1", descricao: "Honorário", valor: "1500" }],
  despesas: [{ id: "d1", descricao: "Aluguel", valor: 3000 }],
  grupos_parcela: [{ id: "g1", descricao: null, tipo_lancamento: "despesa" }],
  faturas: [{ id: "f1", mes_referencia: 10, ano_referencia: 2026, valor_total: 820 }],
  clientes: [
    { id: "c1", nome: "Lima Construtora", email: "contato@lima.test" },
    { id: "c2", nome: "Sem Email", email: null },
  ],
  contas: [{ id: "ct1", nome: "Itaú PJ" }],
};

function montar(operacao: string, status: Acao["status"] = "pendente") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AcaoCard
        index={0}
        acao={{ operacao, runId: "run-1", custoCreditos: 1, status }}
        onExecutar={onExecutar}
        onCancelar={onCancelar}
      />
    </QueryClientProvider>
  );
}

async function escolher(label: string | RegExp, opcao: string | RegExp) {
  await userEvent.click(await screen.findByLabelText(label));
  await userEvent.click(await screen.findByRole("option", { name: opcao }));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.resolve = (q) => ({ data: DADOS[q.table] ?? [] });
  onExecutar.mockResolvedValue(undefined);
  onCancelar.mockResolvedValue(undefined);
});

describe("AcaoCard", () => {
  it("operação desconhecida não renderiza", () => {
    const { container } = montar("apagar_tudo");
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["converter_lead", "leads", /Casa Ribeiro/, { lead_id: "l1" }, [["is", "cliente_id", null]]],
    ["converter_proposta", "propostas", /Proposta Lima/, { proposta_id: "pr1" }, [["is", "projeto_id", null]]],
    [
      "marcar_recebido",
      "receitas",
      /Honorário · R\$\s?1\.500,00/,
      { receita_id: "r1" },
      [["eq", "status", "Pendente"]],
    ],
    ["marcar_pago", "despesas", /Aluguel/, { despesa_id: "d1" }, [["eq", "is_fatura_payment", false]]],
  ])("%s lista os alvos certos e executa", async (op, tabela, opcao, payload, filtros) => {
    montar(op);
    await escolher(/^(Lead|Proposta|Receita|Despesa)$/, opcao);
    await userEvent.click(screen.getByRole("button", { name: /Converter|Marcar/ }));
    await waitFor(() => expect(onExecutar).toHaveBeenCalledWith("run-1", op, payload));
    const q = h.calls.find((c) => c.table === tabela)!;
    for (const f of filtros) expect(q.filters).toContainEqual(f);
    expect(h.track).toHaveBeenCalledWith("ia_acao_confirmada", { operacao: op });
    expect(toast.success).toHaveBeenCalledWith("Ação concluída");
  });

  it("sem alvo o botão fica travado", async () => {
    montar("converter_lead");
    expect(await screen.findByLabelText("Lead")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Converter/ })).toBeDisabled();
  });

  it("sem candidatos mostra o vazio da operação e trava", async () => {
    h.resolve = () => ({ data: null });
    montar("marcar_pago");
    expect(await screen.findByText("Nenhuma despesa pendente.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marcar paga/ })).toBeDisabled();
  });

  it("pagar fatura exige conta e manda as duas", async () => {
    montar("pagar_fatura");
    await escolher("Fatura", /Fatura 10\/2026/);
    await userEvent.click(screen.getByRole("button", { name: /Pagar/ }));
    expect(toast.error).toHaveBeenCalledWith("Selecione a conta de pagamento");
    expect(onExecutar).not.toHaveBeenCalled();
    await escolher("Conta de pagamento", "Itaú PJ");
    await userEvent.click(screen.getByRole("button", { name: /Pagar/ }));
    await waitFor(() =>
      expect(onExecutar).toHaveBeenCalledWith("run-1", "pagar_fatura", { fatura_id: "f1", conta_id: "ct1" })
    );
    expect(h.calls.find((c) => c.table === "faturas")!.filters).toContainEqual(["neq", "status", "Paga"]);
  });

  it("convite ao portal usa o e-mail do cliente e permite trocar", async () => {
    montar("convidar_portal");
    await escolher("Cliente", "Lima Construtora");
    expect(screen.getByLabelText("E-mail do convite")).toHaveValue("contato@lima.test");
    await userEvent.clear(screen.getByLabelText("E-mail do convite"));
    await userEvent.type(screen.getByLabelText("E-mail do convite"), "dono@lima.test");
    await userEvent.click(screen.getByRole("button", { name: /Convidar/ }));
    await waitFor(() =>
      expect(onExecutar).toHaveBeenCalledWith("run-1", "convidar_portal", { cliente_id: "c1", email: "dono@lima.test" })
    );
  });

  it("cliente sem e-mail exige digitar um", async () => {
    montar("convidar_portal");
    await escolher("Cliente", "Sem Email");
    await userEvent.click(screen.getByRole("button", { name: /Convidar/ }));
    expect(toast.error).toHaveBeenCalledWith("Informe o e-mail do cliente");
    expect(onExecutar).not.toHaveBeenCalled();
  });

  it("quitar parcelas: quantidade é opcional", async () => {
    montar("quitar_parcela");
    await escolher("Parcelamento", "Parcelamento (despesa)");
    await userEvent.click(screen.getByRole("button", { name: /Quitar/ }));
    await waitFor(() => expect(onExecutar).toHaveBeenLastCalledWith("run-1", "quitar_parcela", { grupo_id: "g1" }));
    await userEvent.type(screen.getByLabelText(/Quantidade de parcelas/), "2");
    await userEvent.click(screen.getByRole("button", { name: /Quitar/ }));
    await waitFor(() =>
      expect(onExecutar).toHaveBeenLastCalledWith("run-1", "quitar_parcela", { grupo_id: "g1", quantidade: 2 })
    );
  });

  it("falha ao executar mostra o motivo", async () => {
    onExecutar.mockRejectedValue(new Error("Lead já convertido"));
    montar("converter_lead");
    await escolher("Lead", "Casa Ribeiro");
    await userEvent.click(screen.getByRole("button", { name: /Converter/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível concluir", { description: "Lead já convertido" })
    );
    expect(h.track).not.toHaveBeenCalled();
  });

  it("cancelar registra o descarte", async () => {
    montar("converter_lead");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(onCancelar).toHaveBeenCalledWith("run-1"));
    expect(h.track).toHaveBeenCalledWith("ia_acao_cancelada", { operacao: "converter_lead" });
  });

  it("feito e cancelado mostram o estado final sem consultar o banco", () => {
    const { unmount } = montar("marcar_pago", "feito");
    expect(screen.getByText(/Marcar despesa como paga: concluído/)).toBeInTheDocument();
    unmount();
    montar("marcar_pago", "cancelado");
    expect(screen.getByText("Ação cancelada.")).toBeInTheDocument();
    expect(h.calls).toHaveLength(0);
  });
});
