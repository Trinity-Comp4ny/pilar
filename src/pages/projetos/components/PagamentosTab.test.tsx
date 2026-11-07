import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Aba Pagamentos do projeto: resumo do contrato, parcelas e o "marcar como recebido"
// com confirmação. Sem permissão de edição, nenhuma ação aparece.

type Resultado = { data: unknown; error: unknown };
const tabelas: Record<string, Resultado> = {};
const updates: Array<{ tabela: string; payload: unknown; eq: unknown[] }> = [];
let erroNoUpdate: unknown = null;

function builder(tabela: string) {
  let payload: unknown;
  const alvo: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(alvo, {
    get(_t, prop) {
      if (prop === "then") {
        const r =
          payload !== undefined ? { data: null, error: erroNoUpdate } : (tabelas[tabela] ?? { data: [], error: null });
        return (ok: (v: Resultado) => unknown, err?: (e: unknown) => unknown) => Promise.resolve(r).then(ok, err);
      }
      if (prop === "update") {
        return (p: unknown) => {
          payload = p;
          return proxy;
        };
      }
      if (prop === "eq") {
        return (...a: unknown[]) => {
          if (payload !== undefined) updates.push({ tabela, payload, eq: a });
          return proxy;
        };
      }
      if (prop === "single") {
        return () => Promise.resolve(tabelas[`${tabela}:single`] ?? { data: null, error: null });
      }
      return () => proxy;
    },
  });
  return proxy;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => builder(t) } }));
vi.mock("@/hooks/useMoneyMask", () => ({
  useMoneyMask: () => (v: number) => `R$ ${v.toFixed(2)}`,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { PagamentosTab } from "./PagamentosTab";
import { getDiasStatus, type PagamentoProjeto } from "../hooks/usePagamentosProjeto";

function isoDia(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const receita = (over: Partial<PagamentoProjeto> & { id: string }) => ({
  descricao: `Parcela ${over.id}`,
  valor: 1000,
  data_vencimento: isoDia(10),
  data_recebimento: null,
  status: "Pendente",
  cliente_id: "c1",
  clientes: { nome: "Cliente Seed" },
  nota_fiscal: null,
  forma_pagamento: null,
  parcela_numero: null,
  parcela_total: null,
  grupo_parcela: null,
  observacao: null,
  created_at: "2026-01-01",
  ...over,
});

function montar(canEdit = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<PagamentosTab projetoId="proj-1" canEdit={canEdit} />, { wrapper: Wrapper });
}

describe("PagamentosTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(tabelas)) delete tabelas[k];
    updates.length = 0;
    erroNoUpdate = null;
    tabelas["projetos_safe:single"] = { data: { valor_contrato: 4000 }, error: null };
  });

  it("estado vazio quando o projeto não tem pagamentos", async () => {
    tabelas.receitas = { data: [], error: null };
    montar();
    expect(await screen.findByText("Nenhum pagamento registrado para este projeto.")).toBeInTheDocument();
  });

  it("resumo soma recebido, pendente e atrasado, ignorando cancelados", async () => {
    tabelas.receitas = {
      data: [
        receita({ id: "a", status: "Recebido", valor: 1000, data_recebimento: isoDia(-5) }),
        receita({ id: "b", status: "Pendente", valor: 500, data_vencimento: isoDia(-3) }),
        receita({
          id: "c",
          status: "Pendente",
          valor: 700,
          data_vencimento: isoDia(3),
          parcela_numero: 3,
          parcela_total: 4,
        }),
        receita({ id: "d", status: "Cancelado", valor: 9999 }),
      ],
      error: null,
    };
    montar();
    expect(await screen.findByText("Parcela a")).toBeInTheDocument();
    expect(screen.getByText("R$ 4000.00")).toBeInTheDocument();
    expect(screen.getByText("25% do contrato")).toBeInTheDocument();
    expect(screen.getByText("R$ 1200.00")).toBeInTheDocument();
    expect(screen.getByText("2 pagamento(s)")).toBeInTheDocument();
    expect(screen.getByText("1 pagamento(s)")).toBeInTheDocument();
    expect(screen.getByText("3d atrasado")).toBeInTheDocument();
    expect(screen.getByText("vence em 3d")).toBeInTheDocument();
    expect(screen.getByText("3/4")).toBeInTheDocument();
    expect(screen.getByText(/Próximo vencimento/)).toBeInTheDocument();
  });

  it("sem permissão de edição não mostra ações nas parcelas", async () => {
    tabelas.receitas = { data: [receita({ id: "a" })], error: null };
    montar(false);
    expect(await screen.findByText("Parcela a")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ações do pagamento" })).not.toBeInTheDocument();
  });

  it("parcela recebida não oferece marcar como recebido", async () => {
    tabelas.receitas = { data: [receita({ id: "a", status: "Recebido" })], error: null };
    montar();
    expect(await screen.findByText("Parcela a")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ações do pagamento" })).not.toBeInTheDocument();
  });

  it("marcar como recebido pede confirmação e grava com a data de hoje", async () => {
    const user = userEvent.setup();
    tabelas.receitas = { data: [receita({ id: "rec-1" })], error: null };
    montar();
    await user.click(await screen.findByRole("button", { name: "Ações do pagamento" }));
    await user.click(await screen.findByRole("menuitem", { name: /Marcar como recebido/ }));

    expect(screen.getByText("Confirmar recebimento")).toBeInTheDocument();
    expect(updates).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pagamento marcado como recebido"));
    expect(updates[0]).toEqual({
      tabela: "receitas",
      payload: { status: "Recebido", data_recebimento: new Date().toISOString().split("T")[0] },
      eq: ["id", "rec-1"],
    });
  });

  it("cancelar a confirmação não grava nada", async () => {
    const user = userEvent.setup();
    tabelas.receitas = { data: [receita({ id: "rec-1" })], error: null };
    montar();
    await user.click(await screen.findByRole("button", { name: "Ações do pagamento" }));
    await user.click(await screen.findByRole("menuitem", { name: /Marcar como recebido/ }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(updates).toHaveLength(0);
    expect(screen.queryByText("Confirmar recebimento")).not.toBeInTheDocument();
  });

  it("erro ao gravar mostra toast de erro", async () => {
    const user = userEvent.setup();
    erroNoUpdate = { message: "rls" };
    tabelas.receitas = { data: [receita({ id: "rec-1" })], error: null };
    montar();
    await user.click(await screen.findByRole("button", { name: "Ações do pagamento" }));
    await user.click(await screen.findByRole("menuitem", { name: /Marcar como recebido/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao atualizar pagamento"));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("getDiasStatus", () => {
  const base = receita({ id: "x" }) as unknown as PagamentoProjeto;
  it("recebido, pago e cancelado não contam dias", () => {
    for (const status of ["Recebido", "Pago", "Cancelado"] as const) {
      expect(getDiasStatus({ ...base, status, data_vencimento: isoDia(-30) })).toEqual({ dias: 0, tipo: status });
    }
  });
  it("vencido é atrasado; até 7 dias é próximo; depois, no prazo", () => {
    expect(getDiasStatus({ ...base, data_vencimento: isoDia(-2) })).toEqual({ dias: 2, tipo: "atrasado" });
    expect(getDiasStatus({ ...base, data_vencimento: isoDia(0) })).toEqual({ dias: 0, tipo: "proximo" });
    expect(getDiasStatus({ ...base, data_vencimento: isoDia(7) })).toEqual({ dias: 7, tipo: "proximo" });
    expect(getDiasStatus({ ...base, data_vencimento: isoDia(8) })).toEqual({ dias: 8, tipo: "no_prazo" });
  });
  it("sem vencimento fica como próximo de 0 dias", () => {
    expect(getDiasStatus({ ...base, data_vencimento: null })).toEqual({ dias: 0, tipo: "proximo" });
  });
});
