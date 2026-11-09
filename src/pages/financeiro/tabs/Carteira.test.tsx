import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { campoInput, campoSelect } from "../testing/dom";
import type { CartaoItem, ContaItem } from "../hooks/useContasCartoes";

// Aba Carteira: cadastro de contas e cartões (campos obrigatórios, dias do
// cartão), exclusão com confirmação e o que some para quem só pode ver.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("@/components/ui/select", async () => await import("../testing/nativeSelect"));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const acesso = { canEdit: true };
vi.mock("@/hooks/useFeatureAccess", () => ({
  useFeatureAccess: () => ({
    canView: true,
    canEdit: acesso.canEdit,
    isViewerOnly: !acesso.canEdit,
    level: acesso.canEdit ? "editor" : "viewer",
    isAdmin: false,
  }),
}));

const contas: ContaItem[] = [
  {
    id: "conta-1",
    nome: "Itaú PJ",
    banco: "Itaú",
    cor: null,
    empresa_id: "emp-1",
    saldo_inicial: 1000,
    saldo_atual: 5250.75,
    total_entradas: 8000,
    total_saidas: 3749.25,
    chave_pix: null,
    tipo_chave_pix: null,
  },
];
const cartoes: CartaoItem[] = [
  {
    id: "cartao-1",
    nome: "Visa Empresa",
    tipo: "credito",
    dia_fechamento: 5,
    dia_vencimento: 15,
    limite: 10000,
    usado: 2500,
    disponivel: 7500,
    conta_pagamento_id: "conta-1",
  },
];

const mutations = {
  saveConta: { mutate: vi.fn(), isPending: false },
  saveCartao: { mutate: vi.fn(), isPending: false },
  deleteConta: { mutate: vi.fn(), isPending: false },
  deleteCartao: { mutate: vi.fn(), isPending: false },
};
const query = <T,>(data: T) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });
vi.mock("../hooks/useContasCartoes", () => ({
  useContasResumo: () => query(contas),
  useCartoesResumoDetalhado: () => query(cartoes),
  useContasCartoesMutations: () => mutations,
}));
vi.mock("../hooks/useFaturas", () => ({
  useContas: () => query(contas.map((c) => ({ id: c.id, nome: c.nome }))),
  useFaturasPendentes: () => query([]),
  useFaturas: () => query([]),
  useDespesasFatura: () => query([]),
  useInvalidateFaturas: () => vi.fn(),
  gerarFaturasCartao: vi.fn(async () => undefined),
}));

import { toast } from "sonner";
import Carteira from "./Carteira";

function setup() {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <Carteira />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  acesso.canEdit = true;
});

describe("Carteira: nova conta", () => {
  const abrir = () => fireEvent.click(screen.getByRole("button", { name: "Adicionar conta" }));
  const salvar = () => fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));

  it("vazia: aponta nome e banco obrigatórios e não grava", () => {
    setup();
    abrir();
    salvar();
    expect(toast.error).toHaveBeenCalledWith("Campos obrigatórios", {
      description: "Preencha todos os campos marcados com *",
    });
    expect(screen.getAllByText("Campo obrigatório")).toHaveLength(2);
    expect(mutations.saveConta.mutate).not.toHaveBeenCalled();
  });

  it("só o nome: falta o banco", () => {
    setup();
    abrir();
    fireEvent.change(screen.getByPlaceholderText("Ex: Nubank Conta Corrente"), { target: { value: "Caixa" } });
    salvar();
    expect(screen.getAllByText("Campo obrigatório")).toHaveLength(1);
    expect(mutations.saveConta.mutate).not.toHaveBeenCalled();
  });

  it("digitar no campo limpa o erro dele", () => {
    setup();
    abrir();
    salvar();
    fireEvent.change(screen.getByPlaceholderText("Ex: Nubank Conta Corrente"), { target: { value: "C" } });
    expect(screen.getAllByText("Campo obrigatório")).toHaveLength(1);
  });

  it("completa: envia nome, banco, saldo mascarado e PIX", () => {
    setup();
    abrir();
    fireEvent.change(screen.getByPlaceholderText("Ex: Nubank Conta Corrente"), { target: { value: "Inter PJ" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: Nubank, Itaú, Bradesco..."), { target: { value: "Inter" } });
    fireEvent.change(screen.getByPlaceholderText("R$ 5.000,00"), { target: { value: "1234567" } });
    fireEvent.change(screen.getByPlaceholderText("CPF, CNPJ, e-mail, celular ou chave aleatória"), {
      target: { value: "financeiro@escritorio.com.br" },
    });
    salvar();
    expect(mutations.saveConta.mutate).toHaveBeenCalledTimes(1);
    const [args] = mutations.saveConta.mutate.mock.calls[0];
    expect(args).toMatchObject({
      selected: null,
      nome: "Inter PJ",
      banco: "Inter",
      chavePix: "financeiro@escritorio.com.br",
    });
    expect(args.saldoInicial.replace(/\s/g, " ")).toBe("R$ 12.345,67");
  });

  it("editar conta carrega os dados e envia a conta selecionada", () => {
    setup();
    fireEvent.click(screen.getByText("Itaú PJ"));
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    expect(screen.getByPlaceholderText("Ex: Nubank Conta Corrente")).toHaveValue("Itaú PJ");
    fireEvent.click(screen.getByRole("button", { name: "Atualizar conta" }));
    expect(mutations.saveConta.mutate.mock.calls[0][0]).toMatchObject({ selected: contas[0], banco: "Itaú" });
  });
});

describe("Carteira: novo cartão (a partir da conta)", () => {
  function abrir() {
    setup();
    fireEvent.click(screen.getByText("Itaú PJ"));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar cartão/ }));
  }
  const nome = (v: string) =>
    fireEvent.change(screen.getByPlaceholderText("Ex: Nubank Platinum"), { target: { value: v } });
  const fechamento = (v: string) => fireEvent.change(campoInput(/Dia de Fechamento/), { target: { value: v } });
  const vencimento = (v: string) => fireEvent.change(campoInput(/Dia de Vencimento/), { target: { value: v } });
  const salvar = () => fireEvent.click(screen.getByRole("button", { name: "Salvar cartão" }));

  it("já vem com a conta de pagamento preenchida", () => {
    abrir();
    expect(campoSelect("Conta para Pagamento de Faturas")).toHaveValue("conta-1");
  });

  it("sem fechamento/vencimento não grava", () => {
    abrir();
    nome("Master Black");
    salvar();
    expect(toast.error).toHaveBeenCalledWith("Campos obrigatórios", {
      description: "Preencha nome, fechamento e vencimento",
    });
    expect(mutations.saveCartao.mutate).not.toHaveBeenCalled();
  });

  it("sem nome não grava", () => {
    abrir();
    fechamento("5");
    vencimento("15");
    salvar();
    expect(toast.error).toHaveBeenCalledWith("Campos obrigatórios", expect.anything());
    expect(mutations.saveCartao.mutate).not.toHaveBeenCalled();
  });

  it.each([
    ["0", "15"],
    ["32", "15"],
    ["5", "45"],
    ["5", "-1"],
    ["5.5", "15"],
  ])("dia de fechamento %s / vencimento %s é barrado pela validação nativa (1 a 31)", (f, v) => {
    abrir();
    expect(campoInput(/Dia de Fechamento/)).toHaveAttribute("min", "1");
    expect(campoInput(/Dia de Fechamento/)).toHaveAttribute("max", "31");
    expect(campoInput(/Dia de Vencimento/)).toHaveAttribute("min", "1");
    expect(campoInput(/Dia de Vencimento/)).toHaveAttribute("max", "31");
    nome("Master Black");
    fechamento(f);
    vencimento(v);
    salvar();
    expect(mutations.saveCartao.mutate).not.toHaveBeenCalled();
  });

  it("completo: envia tipo, dias, limite mascarado e conta", () => {
    abrir();
    fireEvent.change(campoSelect("Tipo de Cartão"), { target: { value: "debito" } });
    nome("Master Black");
    fechamento("1");
    vencimento("31");
    fireEvent.change(screen.getByPlaceholderText("R$ 10.000,00"), { target: { value: "1500000" } });
    salvar();
    expect(mutations.saveCartao.mutate).toHaveBeenCalledTimes(1);
    const [args] = mutations.saveCartao.mutate.mock.calls[0];
    expect(args).toMatchObject({
      selected: null,
      nome: "Master Black",
      tipoCartao: "debito",
      diaFechamento: "1",
      diaVencimento: "31",
      contaPagamentoId: "conta-1",
    });
    expect(args.limite.replace(/\s/g, " ")).toBe("R$ 15.000,00");
  });
});

describe("Carteira: exclusão", () => {
  it("excluir conta pede confirmação e só então chama a exclusão", () => {
    setup();
    fireEvent.click(screen.getByText("Itaú PJ"));
    fireEvent.click(screen.getByRole("button", { name: /Excluir/ }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Excluir conta?")).toBeInTheDocument();
    expect(mutations.deleteConta.mutate).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect(mutations.deleteConta.mutate).toHaveBeenCalledWith("conta-1", expect.anything());
  });

  it("cancelar a confirmação não exclui", () => {
    setup();
    fireEvent.click(screen.getByText("Itaú PJ"));
    fireEvent.click(screen.getByRole("button", { name: /Excluir/ }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(mutations.deleteConta.mutate).not.toHaveBeenCalled();
  });

  it("excluir cartão chama a exclusão do cartão", () => {
    setup();
    fireEvent.click(screen.getAllByText("Visa Empresa")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Excluir/ }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    expect(mutations.deleteCartao.mutate).toHaveBeenCalledWith("cartao-1", expect.anything());
  });
});

describe("Carteira: sem permissão de edição", () => {
  it("não oferece criar, editar nem excluir conta ou cartão", () => {
    acesso.canEdit = false;
    setup();
    expect(screen.queryByRole("button", { name: "Adicionar conta" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Itaú PJ"));
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adicionar cartão/ })).not.toBeInTheDocument();
  });
});
