import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";
import type { CotacaoComPropostas, PropostaComFornecedor } from "@/pages/obras/hooks/useObraCotacoes";

// Detalhe da cotação: comparação de propostas, cadastro/edição de proposta, escolha da
// vencedora (com e sem permissão financeira), remoção, reabertura e import do orçamento por IA.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const perm = vi.hoisted(() => ({ financeiro: true }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (m: string) => (m === "financeiro" ? perm.financeiro : true) }),
}));

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { CotacaoDetailDialog } from "./CotacaoDetailDialog";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function proposta(p: Partial<PropostaComFornecedor> & { id: string }): PropostaComFornecedor {
  return {
    cotacao_id: "cot-1",
    empresa_id: "emp-1",
    fornecedor_id: null,
    fornecedor_nome: null,
    fornecedor: null,
    valor: 100,
    valor_parcelado: null,
    quantidade: null,
    unidade: null,
    desconto_pct: null,
    prazo_entrega_dias: null,
    condicao_pagamento: null,
    link_orcamento: null,
    observacoes: null,
    origem: "manual",
    deleted_at: null,
    itens: [],
    ...p,
  } as unknown as PropostaComFornecedor;
}

function cotacao(c: Partial<CotacaoComPropostas> = {}): CotacaoComPropostas {
  return {
    id: "cot-1",
    empresa_id: "emp-1",
    obra_id: "obra-1",
    descricao: "Cimento CP-II",
    tipo: "item",
    status: "aberta",
    quantidade: 50,
    unidade: "sc",
    prazo_necessidade: "2026-11-20",
    observacoes: "Entregar na portaria",
    obra_frente_id: "frente-1",
    proposta_vencedora_id: null,
    propostas: [],
    ...c,
  } as unknown as CotacaoComPropostas;
}

const propostasPadrao = [
  proposta({
    id: "p-1",
    fornecedor_id: "forn-1",
    fornecedor: { id: "forn-1", nome: "Depósito Norte" },
    valor: 1500,
    quantidade: 50,
    unidade: "sc",
    prazo_entrega_dias: 3,
    condicao_pagamento: "à vista",
    link_orcamento: "https://orc/1",
    origem: "link",
    desconto_pct: 5,
    valor_parcelado: 1600,
  }),
  proposta({
    id: "p-2",
    fornecedor_nome: "Casa do Construtor",
    valor: 1800,
    itens: [
      {
        id: "it-1",
        descricao: "Cimento",
        quantidade: 50,
        unidade: "sc",
        preco_unitario: 30,
        valor_total: 1500,
        ordem: 0,
      },
      {
        id: "it-2",
        descricao: "Frete",
        quantidade: null,
        unidade: null,
        preco_unitario: null,
        valor_total: 300,
        ordem: 1,
      },
    ] as unknown as PropostaComFornecedor["itens"],
  }),
];

function montar(c: CotacaoComPropostas, canEdit = true) {
  const onOpenChange = vi.fn();
  render(<CotacaoDetailDialog open onOpenChange={onOpenChange} obraId="obra-1" cotacao={c} canEdit={canEdit} />, {
    wrapper: wrapper(),
  });
  return { onOpenChange };
}

function linhaDe(nome: string) {
  return screen.getByText(nome).closest("tr") as HTMLElement;
}

async function escolherOpcao(combo: HTMLElement, opcao: string | RegExp) {
  fireEvent.keyDown(combo, { key: "Enter" });
  fireEvent.click(await within(screen.getByRole("listbox")).findByRole("option", { name: opcao }));
}

describe("CotacaoDetailDialog: comparação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
    perm.financeiro = true;
  });

  it("sem propostas mostra o estado vazio e o subtítulo da necessidade", () => {
    montar(cotacao());
    expect(screen.getByText("Nenhuma proposta ainda")).toBeInTheDocument();
    expect(screen.getByText(/50 sc · precisa até/)).toBeInTheDocument();
    expect(screen.getByText("Entregar na portaria")).toBeInTheDocument();
  });

  it("destaca a menor proposta e mostra preço unitário, desconto e parcelado", () => {
    montar(cotacao({ propostas: propostasPadrao }));
    const linha = linhaDe("Depósito Norte");
    expect(within(linha).getByText("menor")).toBeInTheDocument();
    expect(within(linha).getByText("com 5% de desconto")).toBeInTheDocument();
    expect(within(linha).getByText(/parc\./)).toBeInTheDocument();
    expect(within(linha).getByText("Preenchido pelo fornecedor")).toBeInTheDocument();
    expect(within(linha).getByText("3 d")).toBeInTheDocument();
    expect(within(linhaDe("Casa do Construtor")).getByText("2 itens")).toBeInTheDocument();
  });

  it("expande e recolhe os itens da cesta", () => {
    montar(cotacao({ propostas: propostasPadrao }));
    fireEvent.click(screen.getByTitle("Ver 2 itens"));
    expect(screen.getByText("Frete")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Ocultar itens"));
    expect(screen.queryByText("Frete")).not.toBeInTheDocument();
  });

  it("sem permissão de edição não mostra ações", () => {
    montar(cotacao({ propostas: propostasPadrao }), false);
    expect(screen.queryByRole("button", { name: /Adicionar proposta/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Escolher" })).not.toBeInTheDocument();
    expect(screen.queryByText("Links para fornecedores")).not.toBeInTheDocument();
  });

  it("Fechar fecha o diálogo", () => {
    const { onOpenChange } = montar(cotacao());
    fireEvent.click(screen.getAllByRole("button", { name: "Fechar" })[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cotação decidida mostra a vencedora e permite reabrir", async () => {
    montar(cotacao({ status: "decidida", proposta_vencedora_id: "p-1", propostas: propostasPadrao }));
    expect(screen.queryByRole("button", { name: "Escolher" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Avaliar fornecedor" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reabrir para comparar de novo" }));
    await waitFor(() => expect(fake.escritas("obra_cotacao")).toHaveLength(1));
    expect(fake.escritas("obra_cotacao")[0].payload).toEqual({ status: "aberta", proposta_vencedora_id: null });
  });

  it("remover proposta passa pelo ConfirmDialog e chama o soft delete", async () => {
    montar(cotacao({ propostas: propostasPadrao }));
    const botoes = within(linhaDe("Casa do Construtor")).getAllByRole("button");
    fireEvent.click(botoes[botoes.length - 1]);
    expect(await screen.findByText("Remover proposta?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    await waitFor(() =>
      expect(fake.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "obra_cotacao_proposta", p_id: "p-2" })
    );
  });
});

describe("CotacaoDetailDialog: escolher vencedora", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
    perm.financeiro = true;
  });

  it("marcar e lançar despesa chama a RPC financeira com a descrição e o fornecedor", async () => {
    const { onOpenChange } = montar(cotacao({ propostas: propostasPadrao }));
    fireEvent.click(within(linhaDe("Depósito Norte")).getByRole("button", { name: "Escolher" }));
    expect(await screen.findByText("Escolher vencedora")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Marcar e lançar despesa" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Vencedora escolhida e despesa lançada"));
    expect(fake.escritas("obra_cotacao")[0].payload).toEqual({ status: "decidida", proposta_vencedora_id: "p-1" });
    expect(fake.rpc).toHaveBeenCalledWith(
      "rpc_obra_despesa_salvar",
      expect.objectContaining({
        p_obra_id: "obra-1",
        p_descricao: "Cimento CP-II — Depósito Norte",
        p_valor: 1500,
        p_obra_frente_id: "frente-1",
        p_fornecedor_id: "forn-1",
        p_pago_por: "cliente",
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sem acesso ao financeiro só marca a vencedora, sem lançar despesa", async () => {
    perm.financeiro = false;
    montar(cotacao({ propostas: propostasPadrao }));
    fireEvent.click(within(linhaDe("Casa do Construtor")).getByRole("button", { name: "Escolher" }));
    expect(await screen.findByText(/feito por quem tem acesso ao financeiro/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar e lançar despesa" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Só marcar vencedora" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Vencedora escolhida"));
    expect(fake.rpc).not.toHaveBeenCalledWith("rpc_obra_despesa_salvar", expect.anything());
  });

  it("erro do servidor ao decidir mostra o toast e mantém o diálogo", async () => {
    fake.responder((c) =>
      c.tabela === "obra_cotacao" && c.op === "update" ? { data: null, error: new Error("RLS negou") } : undefined
    );
    const { onOpenChange } = montar(cotacao({ propostas: propostasPadrao }));
    fireEvent.click(within(linhaDe("Depósito Norte")).getByRole("button", { name: "Escolher" }));
    fireEvent.click(await screen.findByRole("button", { name: "Só marcar vencedora" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível decidir", { description: "RLS negou" })
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("falha ao lançar a despesa reporta o erro", async () => {
    rpcComEmpresa({ rpc_obra_despesa_salvar: { data: null, error: new Error("sem saldo de permissão") } });
    montar(cotacao({ propostas: propostasPadrao }));
    fireEvent.click(within(linhaDe("Depósito Norte")).getByRole("button", { name: "Escolher" }));
    fireEvent.click(await screen.findByRole("button", { name: "Marcar e lançar despesa" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível decidir", { description: "sem saldo de permissão" })
    );
  });
});

describe("CotacaoDetailDialog: formulário de proposta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
    fake.responder((c) => {
      if (c.tabela === "fornecedores" && c.op === "select") {
        return { data: [{ id: "forn-1", nome: "Depósito Norte" }], error: null };
      }
      if (c.tabela === "fornecedores" && c.op === "insert") return { data: { id: "forn-novo" }, error: null };
      if (c.tabela === "obra_cotacao_proposta" && c.op === "insert") return { data: { id: "p-nova" }, error: null };
      return undefined;
    });
  });

  const abrirNova = () => fireEvent.click(screen.getByRole("button", { name: /Adicionar proposta/ }));
  const confirmar = () => fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

  it("sem fornecedor escolhido avisa e não grava", async () => {
    montar(cotacao());
    abrirNova();
    expect(await screen.findByText("Nova proposta")).toBeInTheDocument();
    confirmar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Selecione um fornecedor"));
    expect(fake.escritas()).toHaveLength(0);
  });

  it("fornecedor livre sem nome é recusado", async () => {
    montar(cotacao());
    abrirNova();
    await escolherOpcao(await screen.findByRole("combobox"), "Outro (só nesta cotação)");
    confirmar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Informe o nome do fornecedor"));
    expect(fake.escritas()).toHaveLength(0);
  });

  it("valor negativo é recusado", async () => {
    montar(cotacao());
    abrirNova();
    await escolherOpcao(await screen.findByRole("combobox"), "Outro (só nesta cotação)");
    fireEvent.change(screen.getByLabelText("Nome do fornecedor"), { target: { value: "Loja X" } });
    fireEvent.change(screen.getByLabelText("Valor total (R$)"), { target: { value: "-1" } });
    confirmar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Informe um valor válido"));
    expect(fake.escritas()).toHaveLength(0);
  });

  it("nome livre grava proposta sem fornecedor_id", async () => {
    montar(cotacao());
    abrirNova();
    await escolherOpcao(await screen.findByRole("combobox"), "Outro (só nesta cotação)");
    fireEvent.change(screen.getByLabelText("Nome do fornecedor"), { target: { value: "  Loja X " } });
    fireEvent.change(screen.getByLabelText("Valor total (R$)"), { target: { value: "250.5" } });
    fireEvent.change(screen.getByLabelText("Prazo de entrega (dias)"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Condição de pagamento"), { target: { value: " 30 dias " } });
    fireEvent.change(screen.getByLabelText("Link do orçamento"), { target: { value: "https://x" } });
    confirmar();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Proposta adicionada"));
    expect(fake.escritas("obra_cotacao_proposta")[0].payload).toEqual(
      expect.objectContaining({
        fornecedor_id: null,
        fornecedor_nome: "Loja X",
        valor: 250.5,
        prazo_entrega_dias: 4,
        condicao_pagamento: "30 dias",
        link_orcamento: "https://x",
        empresa_id: "emp-1",
        cotacao_id: "cot-1",
      })
    );
  });

  it("fornecedor do cadastro com cesta de itens soma o total e grava os itens", async () => {
    montar(cotacao());
    abrirNova();
    await escolherOpcao(await screen.findByRole("combobox"), "Depósito Norte");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item" }));
    fireEvent.change(screen.getByPlaceholderText("Material"), { target: { value: "Areia" } });
    const numeros = screen.getAllByRole("spinbutton");
    // qtd, unit., total do item; depois prazo
    fireEvent.change(numeros[0], { target: { value: "2" } });
    fireEvent.change(numeros[1], { target: { value: "45.5" } });
    expect((numeros[2] as HTMLInputElement).value).toBe("91");
    expect(screen.queryByLabelText("Valor total (R$)")).not.toBeInTheDocument();
    confirmar();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Proposta adicionada"));
    expect(fake.escritas("obra_cotacao_proposta")[0].payload).toEqual(
      expect.objectContaining({ fornecedor_id: "forn-1", fornecedor_nome: null, valor: 91 })
    );
    expect(fake.escritas("obra_cotacao_proposta_item")[1].payload).toEqual([
      expect.objectContaining({ descricao: "Areia", quantidade: 2, preco_unitario: 45.5, valor_total: 91, ordem: 0 }),
    ]);
  });

  it("item sem descrição é recusado", async () => {
    montar(cotacao());
    abrirNova();
    await escolherOpcao(await screen.findByRole("combobox"), "Depósito Norte");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item" }));
    confirmar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Todo item precisa de descrição"));
  });

  it("remover a única linha da cesta volta ao valor manual", async () => {
    montar(cotacao());
    abrirNova();
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar item" }));
    expect(screen.queryByLabelText("Valor total (R$)")).not.toBeInTheDocument();
    const linhaItem = screen.getByPlaceholderText("Material").closest("tr") as HTMLElement;
    fireEvent.click(within(linhaItem).getByRole("button"));
    expect(screen.getByLabelText("Valor total (R$)")).toBeInTheDocument();
  });

  it("cadastrar novo fornecedor cria o cadastro e vincula a proposta", async () => {
    montar(cotacao());
    abrirNova();
    await escolherOpcao(await screen.findByRole("combobox"), "+ Cadastrar novo fornecedor");
    expect(screen.getByText(/Fica salvo no cadastro/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome do novo fornecedor"), { target: { value: "Ferragens Sul" } });
    fireEvent.change(screen.getByLabelText("Valor total (R$)"), { target: { value: "90" } });
    confirmar();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Proposta adicionada"));
    expect(fake.escritas("fornecedores")[0].payload).toEqual({ nome: "Ferragens Sul", empresa_id: "emp-1" });
    expect(fake.escritas("obra_cotacao_proposta")[0].payload).toEqual(
      expect.objectContaining({ fornecedor_id: "forn-novo", fornecedor_nome: null })
    );
  });

  it("falha ao cadastrar o fornecedor não grava a proposta", async () => {
    fake.responder((c) =>
      c.tabela === "fornecedores" && c.op === "insert" ? { data: null, error: new Error("duplicado") } : undefined
    );
    montar(cotacao());
    abrirNova();
    await escolherOpcao(await screen.findByRole("combobox"), "+ Cadastrar novo fornecedor");
    fireEvent.change(screen.getByLabelText("Nome do novo fornecedor"), { target: { value: "Ferragens Sul" } });
    fireEvent.change(screen.getByLabelText("Valor total (R$)"), { target: { value: "90" } });
    confirmar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível cadastrar o fornecedor", { description: "duplicado" })
    );
    expect(fake.escritas("obra_cotacao_proposta")).toHaveLength(0);
  });

  it("editar proposta com cesta e esvaziar os itens apaga os itens antigos", async () => {
    montar(cotacao({ propostas: propostasPadrao }));
    const botoes = within(linhaDe("Casa do Construtor")).getAllByRole("button");
    fireEvent.click(botoes[botoes.length - 2]);
    expect(await screen.findByText("Editar proposta")).toBeInTheDocument();
    while (screen.queryAllByPlaceholderText("Material").length > 0) {
      const linha = screen.getAllByPlaceholderText("Material")[0].closest("tr") as HTMLElement;
      fireEvent.click(within(linha).getByRole("button"));
    }
    fireEvent.change(screen.getByLabelText("Valor total (R$)"), { target: { value: "1700" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Proposta atualizada"));
    const upd = fake.escritas("obra_cotacao_proposta")[0];
    expect(upd.op).toBe("update");
    expect(upd.payload).toEqual(expect.objectContaining({ fornecedor_nome: "Casa do Construtor", valor: 1700 }));
    const itens = fake.escritas("obra_cotacao_proposta_item");
    expect(itens).toHaveLength(1);
    expect(itens[0].op).toBe("delete");
  });

  it("erro ao salvar mantém o formulário aberto", async () => {
    fake.responder((c) => {
      if (c.tabela === "fornecedores") return { data: [], error: null };
      if (c.tabela === "obra_cotacao_proposta") return { data: null, error: new Error("timeout") };
      return undefined;
    });
    montar(cotacao());
    abrirNova();
    await escolherOpcao(await screen.findByRole("combobox"), "Outro (só nesta cotação)");
    fireEvent.change(screen.getByLabelText("Nome do fornecedor"), { target: { value: "Loja" } });
    fireEvent.change(screen.getByLabelText("Valor total (R$)"), { target: { value: "10" } });
    confirmar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "timeout" })
    );
    expect(screen.getByText("Nova proposta")).toBeInTheDocument();
  });
});

describe("CotacaoDetailDialog: analisar orçamento com IA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
  });

  function subir(file = new File(["%PDF"], "orc.pdf", { type: "application/pdf" })) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
  }

  it("formato não suportado avisa sem chamar a IA", async () => {
    montar(cotacao());
    subir(new File(["x"], "orc.docx", { type: "application/msword" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível ler o orçamento", {
        description: "Formato não suportado. Envie PDF, PNG, JPG ou WebP.",
      })
    );
    expect(fake.invoke).not.toHaveBeenCalled();
  });

  it("erro da edge function vira toast", async () => {
    fake.invoke.mockResolvedValue({ data: null, error: new Error("timeout do Gemini") });
    montar(cotacao());
    subir();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível ler o orçamento", {
        description: "timeout do Gemini",
      })
    );
  });

  it("cesta sem itens avisa para adicionar à mão", async () => {
    fake.invoke.mockResolvedValue({ data: { modo: "cesta", itens: [] }, error: null });
    montar(cotacao());
    subir();
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith("Nenhum item reconhecido no orçamento", expect.anything())
    );
  });

  it("comparativo sem lojas avisa", async () => {
    fake.invoke.mockResolvedValue({ data: { modo: "comparativo", propostas: [] }, error: null });
    montar(cotacao());
    subir();
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith("Nenhuma loja reconhecida no comparativo", expect.anything())
    );
  });

  it("comparativo gera uma proposta por loja, marcando as duvidosas", async () => {
    fake.invoke.mockResolvedValue({
      data: {
        modo: "comparativo",
        classificacao: { tipo: "comparativo", confianca: 0.9, motivo: "duas lojas" },
        propostas: [
          {
            fornecedor_nome: "Loja A",
            quantidade: 10,
            unidade: "sc",
            valor_a_vista: 300,
            valor_parcelado: 320,
            confianca: 0.9,
          },
          { fornecedor_nome: "Loja B", valor_a_vista: 280, confianca: 0.4, condicao_pagamento: "10x" },
          { fornecedor_nome: "", valor_a_vista: 1 },
        ],
      },
      error: null,
    });
    montar(cotacao());
    subir();
    expect(await screen.findByText(/comparação entre lojas/)).toBeInTheDocument();
    expect(screen.getByText(/duas lojas/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Loja B").closest("tr")).toHaveClass("bg-warning/5");
    fireEvent.change(screen.getByDisplayValue("Loja A"), { target: { value: "Loja A1" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar propostas" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("2 propostas adicionadas"));
    expect(fake.escritas("obra_cotacao_proposta")[0].payload).toEqual([
      expect.objectContaining({ fornecedor_nome: "Loja A1", valor: 300, valor_parcelado: 320, quantidade: 10 }),
      expect.objectContaining({ fornecedor_nome: "Loja B", valor: 280, condicao_pagamento: "10x" }),
    ]);
  });

  it("comparativo sem nenhum fornecedor preenchido é recusado", async () => {
    fake.invoke.mockResolvedValue({
      data: { modo: "comparativo", propostas: [{ fornecedor_nome: "Loja A", valor_a_vista: 10 }] },
      error: null,
    });
    montar(cotacao());
    subir();
    fireEvent.change(await screen.findByDisplayValue("Loja A"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar propostas" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Informe ao menos um fornecedor"));
    expect(fake.escritas()).toHaveLength(0);
  });

  it("item único vira uma linha de comparativo", async () => {
    fake.invoke.mockResolvedValue({
      data: { modo: "item", fornecedor_nome: "Loja C", valor_total: 77, condicao_pagamento: "pix" },
      error: null,
    });
    montar(cotacao());
    subir();
    expect(await screen.findByDisplayValue("Loja C")).toBeInTheDocument();
    expect(screen.getByDisplayValue("77")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByText("Analisar orçamento com IA")).not.toBeInTheDocument());
  });

  it("cesta: exige fornecedor e grava os itens reconhecidos", async () => {
    fake.responder((c) =>
      c.tabela === "obra_cotacao_proposta" && c.op === "insert" ? { data: { id: "p-nova" }, error: null } : undefined
    );
    fake.invoke.mockResolvedValue({
      data: {
        modo: "cesta",
        fornecedor_nome: "",
        itens: [
          { descricao: "Tijolo", quantidade: 1000, unidade: "un", preco_unitario: 0.8, valor_total: 800 },
          { descricao: "Argamassa", valor_total: 200 },
        ],
      },
      error: null,
    });
    montar(cotacao());
    subir();
    expect(await screen.findByDisplayValue("Tijolo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar proposta" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Informe o nome do fornecedor"));

    fireEvent.change(screen.getByLabelText("Fornecedor"), { target: { value: "Cerâmica Boa" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar proposta" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Proposta adicionada"));
    expect(fake.escritas("obra_cotacao_proposta")[0].payload).toEqual(
      expect.objectContaining({ fornecedor_nome: "Cerâmica Boa", valor: 1000 })
    );
    expect(fake.escritas("obra_cotacao_proposta_item")[1].payload).toHaveLength(2);
  });

  it("cesta com todos os itens sem descrição é recusada", async () => {
    fake.invoke.mockResolvedValue({
      data: { modo: "cesta", fornecedor_nome: "Loja", itens: [{ descricao: "Tijolo", valor_total: 10 }] },
      error: null,
    });
    montar(cotacao());
    subir();
    fireEvent.change(await screen.findByDisplayValue("Tijolo"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar proposta" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A cesta precisa de ao menos um item"));
  });

  it("erro ao gravar o lote mostra o toast", async () => {
    fake.responder((c) => (c.tabela === "obra_cotacao_proposta" ? { data: null, error: new Error("RLS") } : undefined));
    fake.invoke.mockResolvedValue({
      data: { modo: "comparativo", propostas: [{ fornecedor_nome: "Loja A", valor_a_vista: 10 }] },
      error: null,
    });
    montar(cotacao());
    subir();
    await screen.findByDisplayValue("Loja A");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar propostas" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "RLS" }));
  });
});
