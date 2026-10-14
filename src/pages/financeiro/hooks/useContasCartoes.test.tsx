import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Builder encadeável do supabase-js: cada chamada registra o que foi pedido e o
// `await` resolve o resultado configurado para "tabela.operação".
type Resultado = { data?: unknown; error?: unknown; count?: number | null };
const resultados = new Map<string, Resultado>();
const chamadas: Array<{ tabela: string; metodo: string; args: unknown[] }> = [];

function builder(tabela: string) {
  let op = "";
  const b: Record<string, unknown> = {};
  for (const metodo of ["insert", "update", "select", "eq", "is", "or", "in"]) {
    b[metodo] = (...args: unknown[]) => {
      if (!op && ["insert", "update", "select"].includes(metodo)) op = metodo;
      chamadas.push({ tabela, metodo, args });
      return b;
    };
  }
  b.then = (resolve: (r: Resultado) => unknown) =>
    resolve(resultados.get(`${tabela}.${op}`) ?? { data: null, error: null });
  return b;
}

const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabela: string) => builder(tabela),
    rpc: (...a: unknown[]) => rpc(...a),
    auth: { getUser: () => getUser() },
  },
}));

const softDelete = vi.fn();
vi.mock("@/lib/softDelete", () => ({ softDelete: (...a: unknown[]) => softDelete(...a) }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

import { useContasCartoesMutations, type CartaoItem, type ContaItem } from "./useContasCartoes";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function setup() {
  return renderHook(() => useContasCartoesMutations(), { wrapper }).result;
}

function payloadDe(tabela: string, metodo: string) {
  return chamadas.find((c) => c.tabela === tabela && c.metodo === metodo)?.args[0];
}

const conta = { id: "conta-1" } as ContaItem;
const cartao = { id: "cartao-1" } as CartaoItem;

describe("useContasCartoesMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resultados.clear();
    chamadas.length = 0;
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpc.mockResolvedValue({ data: "empresa-1", error: null });
    softDelete.mockResolvedValue(null);
  });

  describe("saveConta", () => {
    it("cria conta com saldo em reais e o tipo da chave PIX detectado", async () => {
      const result = setup();
      result.current.saveConta.mutate({
        selected: null,
        nome: "Itaú PJ",
        banco: "Itaú",
        saldoInicial: "R$ 1.500,50",
        chavePix: "financeiro@escritorio.com.br",
      });

      await waitFor(() => expect(result.current.saveConta.isSuccess).toBe(true));
      expect(payloadDe("contas", "insert")).toMatchObject({
        empresa_id: "empresa-1",
        saldo_inicial: 1500.5,
        chave_pix: "financeiro@escritorio.com.br",
        tipo_chave_pix: "email",
      });
      expect(toastSuccess).toHaveBeenCalledWith("Conta criada");
    });

    it("sem chave PIX grava null nos dois campos", async () => {
      const result = setup();
      result.current.saveConta.mutate({ selected: null, nome: "Caixa", banco: "", saldoInicial: "", chavePix: "" });

      await waitFor(() => expect(result.current.saveConta.isSuccess).toBe(true));
      expect(payloadDe("contas", "insert")).toMatchObject({ saldo_inicial: 0, chave_pix: null, tipo_chave_pix: null });
    });

    it("edição que o RLS filtrou avisa erro em vez de confirmar", async () => {
      resultados.set("contas.update", { data: [], error: null });
      const result = setup();
      result.current.saveConta.mutate({ selected: conta, nome: "X", banco: "Y", saldoInicial: "10", chavePix: "" });

      await waitFor(() => expect(result.current.saveConta.isError).toBe(true));
      expect(toastSuccess).not.toHaveBeenCalled();
      expect(toastError).toHaveBeenCalledWith(
        "Erro ao atualizar conta",
        expect.objectContaining({ description: expect.stringContaining("Nada foi salvo") })
      );
    });

    it("edição gravada confirma", async () => {
      resultados.set("contas.update", { data: [{ id: "conta-1" }], error: null });
      const result = setup();
      result.current.saveConta.mutate({ selected: conta, nome: "X", banco: "Y", saldoInicial: "10", chavePix: "" });

      await waitFor(() => expect(result.current.saveConta.isSuccess).toBe(true));
      expect(toastSuccess).toHaveBeenCalledWith("Conta atualizada");
    });

    it("sem sessão não grava nada", async () => {
      getUser.mockResolvedValue({ data: { user: null } });
      const result = setup();
      result.current.saveConta.mutate({ selected: null, nome: "X", banco: "Y", saldoInicial: "", chavePix: "" });

      await waitFor(() => expect(result.current.saveConta.isError).toBe(true));
      expect(payloadDe("contas", "insert")).toBeUndefined();
      expect(toastError).toHaveBeenCalledWith("Erro", { description: "Usuário não autenticado" });
    });
  });

  describe("saveCartao", () => {
    it("cria cartão sem conta de pagamento quando a opção é 'nenhuma'", async () => {
      const result = setup();
      result.current.saveCartao.mutate({
        selected: null,
        nome: "Nubank",
        tipoCartao: "credito",
        diaFechamento: "5",
        diaVencimento: "12",
        limite: "10.000,00",
        contaPagamentoId: "__none__",
      });

      await waitFor(() => expect(result.current.saveCartao.isSuccess).toBe(true));
      expect(payloadDe("cartoes", "insert")).toMatchObject({
        dia_fechamento: 5,
        dia_vencimento: 12,
        limite: 10000,
        usado: 0,
        conta_pagamento_id: null,
      });
      expect(toastSuccess).toHaveBeenCalledWith("Cartão criado");
    });

    it("edição que o RLS filtrou avisa erro", async () => {
      resultados.set("cartoes.update", { data: [], error: null });
      const result = setup();
      result.current.saveCartao.mutate({
        selected: cartao,
        nome: "Nubank",
        tipoCartao: "credito",
        diaFechamento: "5",
        diaVencimento: "12",
        limite: "1000",
        contaPagamentoId: "conta-1",
      });

      await waitFor(() => expect(result.current.saveCartao.isError).toBe(true));
      expect(toastSuccess).not.toHaveBeenCalled();
    });
  });

  describe("deleteConta", () => {
    it("bloqueia conta com lançamentos e diz quantos", async () => {
      resultados.set("receitas.select", { count: 2, error: null });
      resultados.set("despesas.select", { count: 1, error: null });
      const result = setup();
      result.current.deleteConta.mutate("conta-1");

      await waitFor(() => expect(result.current.deleteConta.isError).toBe(true));
      expect(softDelete).not.toHaveBeenCalled();
      expect(toastError).toHaveBeenCalledWith("Conta com movimentações", {
        description: "Existem 3 lançamento(s) vinculados. Reatribua-os antes de excluir.",
      });
    });

    it("não exclui quando a contagem de vínculos falha", async () => {
      resultados.set("receitas.select", { count: null, error: { message: "timeout" } });
      resultados.set("despesas.select", { count: 0, error: null });
      const result = setup();
      result.current.deleteConta.mutate("conta-1");

      await waitFor(() => expect(result.current.deleteConta.isError).toBe(true));
      expect(softDelete).not.toHaveBeenCalled();
      expect(toastError).toHaveBeenCalledWith("Não foi possível conferir os vínculos", expect.anything());
    });

    it("conta sem vínculos é desativada por soft delete", async () => {
      resultados.set("receitas.select", { count: 0, error: null });
      resultados.set("despesas.select", { count: 0, error: null });
      const result = setup();
      result.current.deleteConta.mutate("conta-1");

      await waitFor(() => expect(result.current.deleteConta.isSuccess).toBe(true));
      expect(softDelete).toHaveBeenCalledWith("contas", "conta-1");
      expect(toastSuccess).toHaveBeenCalledWith("Conta desativada");
    });
  });

  describe("deleteCartao", () => {
    it("bloqueia cartão com fatura em uso", async () => {
      resultados.set("faturas.select", { count: 1, error: null });
      const result = setup();
      result.current.deleteCartao.mutate("cartao-1");

      await waitFor(() => expect(result.current.deleteCartao.isError).toBe(true));
      expect(softDelete).not.toHaveBeenCalled();
      expect(toastError).toHaveBeenCalledWith("Cartão com faturas", expect.anything());
    });

    it("não exclui quando a contagem de faturas falha", async () => {
      resultados.set("faturas.select", { count: null, error: { message: "timeout" } });
      const result = setup();
      result.current.deleteCartao.mutate("cartao-1");

      await waitFor(() => expect(result.current.deleteCartao.isError).toBe(true));
      expect(softDelete).not.toHaveBeenCalled();
    });
  });
});
