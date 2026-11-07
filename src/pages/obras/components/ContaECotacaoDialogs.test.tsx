import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";
import type { ObraLancamentoRow } from "@/pages/obras/hooks/useObraConta";
import type { CotacaoRow } from "@/pages/obras/hooks/useObraCotacoes";

// Conta da obra (aporte e despesa) e cotação: campos obrigatórios, valores inválidos,
// payload que chega ao banco e erro do servidor sem perder o que foi digitado.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { LancamentoContaDialog } from "./LancamentoContaDialog";
import { CotacaoFormDialog } from "./CotacaoFormDialog";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const digitar = (rotulo: string | RegExp, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

describe("LancamentoContaDialog: aporte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
  });

  function montar() {
    const onOpenChange = vi.fn();
    render(<LancamentoContaDialog open onOpenChange={onOpenChange} obraId="obra-1" tipo="aporte" />, {
      wrapper: wrapper(),
    });
    return { onOpenChange };
  }
  const registrar = () => fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

  it("só descrição, sem valor: avisa e não grava", async () => {
    const { onOpenChange } = montar();
    digitar("Descrição", "Aporte inicial");
    registrar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Preencha descrição e um valor válido"));
    expect(fake.escritas()).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("só valor, sem descrição: avisa e não grava", async () => {
    montar();
    digitar("Valor (R$)", "5000");
    registrar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Preencha descrição e um valor válido"));
    expect(fake.escritas()).toHaveLength(0);
  });

  it("valor negativo é barrado pelo campo e não grava", async () => {
    montar();
    digitar("Descrição", "Aporte");
    digitar("Valor (R$)", "-10");
    registrar();
    await act(async () => {});
    expect(screen.getByLabelText("Valor (R$)")).toBeInvalid();
    expect(fake.escritas()).toHaveLength(0);
  });

  it("caminho feliz: grava o aporte com empresa, obra e data de hoje", async () => {
    const { onOpenChange } = montar();
    digitar("Descrição", "  Aporte inicial  ");
    digitar("Valor (R$)", "15000.50");
    registrar();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fake.escritas("obra_conta_lancamento")[0].payload).toEqual({
      empresa_id: "emp-1",
      obra_id: "obra-1",
      tipo: "aporte",
      data: new Date().toISOString().slice(0, 10),
      descricao: "Aporte inicial",
      valor: 15000.5,
    });
    expect(toast.success).toHaveBeenCalledWith("Aporte registrado");
  });

  it("erro do servidor: toast e diálogo aberto com os dados", async () => {
    fake.responder((c) => (c.op === "insert" ? { data: null, error: new Error("RLS") } : undefined));
    const { onOpenChange } = montar();
    digitar("Descrição", "Aporte");
    digitar("Valor (R$)", "100");
    registrar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "RLS" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Descrição")).toHaveValue("Aporte");
  });
});

describe("LancamentoContaDialog: despesa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
  });

  function montar(lancamento: ObraLancamentoRow | null = null) {
    const onOpenChange = vi.fn();
    render(
      <LancamentoContaDialog open onOpenChange={onOpenChange} obraId="obra-1" tipo="despesa" lancamento={lancamento} />,
      { wrapper: wrapper() }
    );
    return { onOpenChange };
  }

  it("despesa sem valor não chama o RPC", async () => {
    montar();
    digitar("Descrição", "Concreto");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Preencha descrição e um valor válido"));
    expect(fake.rpc).not.toHaveBeenCalledWith("rpc_obra_despesa_salvar", expect.anything());
  });

  it("caminho feliz: RPC transacional com padrões (cliente paga, visível no portal)", async () => {
    const { onOpenChange } = montar();
    digitar("Descrição", "Concreto usinado");
    digitar("Valor (R$)", "3200");
    digitar(/Comprovante/, "  https://drive.google.com/x  ");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fake.rpc).toHaveBeenCalledWith(
      "rpc_obra_despesa_salvar",
      expect.objectContaining({
        p_obra_id: "obra-1",
        p_descricao: "Concreto usinado",
        p_valor: 3200,
        p_pago_por: "cliente",
        p_comprovante_url: "https://drive.google.com/x",
        p_confirmada_portal: true,
        p_obra_frente_id: undefined,
        p_fornecedor_id: undefined,
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Despesa registrada");
  });

  it("segurar do portal grava confirmada_portal=false", async () => {
    montar();
    digitar("Descrição", "Em conferência");
    digitar("Valor (R$)", "10");
    fireEvent.click(screen.getByLabelText("Segurar do portal"));
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() =>
      expect(fake.rpc).toHaveBeenCalledWith(
        "rpc_obra_despesa_salvar",
        expect.objectContaining({ p_confirmada_portal: false })
      )
    );
  });

  it("edição carrega o lançamento e regrava pelo id", async () => {
    montar({
      id: "lanc-9",
      data: "2026-10-01",
      descricao: "Areia",
      valor: 450,
      obra_frente_id: null,
      fornecedor_id: null,
      pago_por: "cliente",
      comprovante_url: null,
      confirmada_portal: false,
    } as unknown as ObraLancamentoRow);
    expect(screen.getByText("Editar despesa")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor (R$)")).toHaveValue(450);
    expect(screen.getByLabelText("Segurar do portal")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(fake.rpc).toHaveBeenCalledWith(
        "rpc_obra_despesa_salvar",
        expect.objectContaining({ p_id: "lanc-9", p_valor: 450, p_data: "2026-10-01", p_confirmada_portal: false })
      )
    );
  });

  it("erro do RPC mantém aberto", async () => {
    fake.rpc.mockResolvedValue({ data: null, error: new Error("obra concluída") });
    const { onOpenChange } = montar();
    digitar("Descrição", "Cimento");
    digitar("Valor (R$)", "90");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "obra concluída" })
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("CotacaoFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
  });

  function montar(cotacao: CotacaoRow | null = null) {
    const onOpenChange = vi.fn();
    render(<CotacaoFormDialog open onOpenChange={onOpenChange} obraId="obra-1" cotacao={cotacao} />, {
      wrapper: wrapper(),
    });
    return { onOpenChange };
  }

  it("sem descrição avisa e não grava", async () => {
    montar();
    digitar("Quantidade", "10");
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Descreva o que vai cotar"));
    expect(fake.escritas()).toHaveLength(0);
  });

  it("descrição só com espaços também é recusada", async () => {
    montar();
    digitar("O que cotar", "   ");
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Descreva o que vai cotar"));
  });

  it("quantidade negativa é barrada pelo campo", async () => {
    montar();
    digitar("O que cotar", "Tábuas");
    digitar("Quantidade", "-3");
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await act(async () => {});
    expect(screen.getByLabelText("Quantidade")).toBeInvalid();
    expect(fake.escritas()).toHaveLength(0);
  });

  it("caminho feliz só com a descrição: opcionais vão nulos", async () => {
    const { onOpenChange } = montar();
    digitar("O que cotar", "  Material elétrico ");
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const [insert] = fake.escritas("obra_cotacao");
    expect(insert.op).toBe("insert");
    expect(insert.payload).toEqual(
      expect.objectContaining({
        descricao: "Material elétrico",
        quantidade: null,
        unidade: null,
        obra_frente_id: null,
        prazo_necessidade: null,
        observacoes: null,
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Cotação criada");
  });

  it("edição atualiza pelo id", async () => {
    montar({ id: "cot-1", descricao: "Areia", quantidade: 5, unidade: "m³" } as unknown as CotacaoRow);
    expect(screen.getByLabelText("Quantidade")).toHaveValue(5);
    digitar("Quantidade", "8");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cotação atualizada"));
    const [update] = fake.escritas("obra_cotacao");
    expect(update.op).toBe("update");
    expect(update.filtros).toContainEqual(["eq", "id", "cot-1"]);
    expect(update.payload).toEqual(expect.objectContaining({ quantidade: 8, unidade: "m³" }));
  });

  it("erro do servidor mantém aberto", async () => {
    fake.responder((c) => (c.op !== "select" ? { data: null, error: new Error("falhou") } : undefined));
    const { onOpenChange } = montar();
    digitar("O que cotar", "Cimento");
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "falhou" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("O que cotar")).toHaveValue("Cimento");
  });
});
