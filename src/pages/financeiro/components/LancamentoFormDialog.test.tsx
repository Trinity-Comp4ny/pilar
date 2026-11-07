import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { sb } from "../testing/supabaseMock";
import { campoSelect } from "../testing/dom";
import type { Lancamento } from "../hooks/useLancamentosUnified";

// Formulário de receita/despesa: é por aqui que todo dinheiro entra no sistema.
// Cobre o caminho feliz (payload exato), cada campo obrigatório, valores
// inválidos, parcelamento (soma fecha no centavo), recorrência, rateio, erro do
// servidor (form continua aberto com os dados) e duplicata.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("@/components/ui/select", async () => await import("../testing/nativeSelect"));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));
vi.mock("./CentroCustoManager", () => ({ CentroCustoManager: () => null }));

const checkDuplicates = vi.fn();
vi.mock("@/lib/duplicateCheck", () => ({ checkDuplicates: (...a: unknown[]) => checkDuplicates(...a) }));

const aux = {
  categorias: [{ id: "cat-1", nome: "Honorários" }],
  projetos: [
    { id: "proj-1", nome: "Residencial Aurora", cliente_id: "cli-1" },
    { id: "proj-2", nome: "Galpão Norte", cliente_id: "cli-2" },
  ],
  contas: [
    { id: "conta-1", nome: "Itaú PJ" },
    { id: "conta-2", nome: "Nubank" },
  ],
  cartoes: [
    { id: "cartao-cred", nome: "Visa Empresa", tipo: "credito" },
    { id: "cartao-deb", nome: "Débito Itaú", tipo: "debito" },
  ],
  clientes: [
    { id: "cli-1", nome: "Construtora Alfa", chaves_pix: [] },
    { id: "cli-2", nome: "Beta Engenharia", chaves_pix: [] },
  ],
  fornecedores: [{ id: "forn-1", nome: "Papelaria Central" }],
  centrosCusto: [
    { id: "cc-1", nome: "Estrutural", codigo: "01" },
    { id: "cc-2", nome: "Hidráulica", codigo: "02" },
  ],
  loading: false,
};
vi.mock("../hooks/useFinanceAuxData", () => ({ useFinanceAuxData: () => aux }));

import { toast } from "sonner";
import { LancamentoFormDialog } from "./LancamentoFormDialog";

type Props = Partial<React.ComponentProps<typeof LancamentoFormDialog>>;

function setup(props: Props = {}) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  render(
    <LancamentoFormDialog
      open
      tipo="despesa"
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      lancamento={null}
      {...props}
    />
  );
  return { onOpenChange, onSaved };
}

const salvar = () => fireEvent.click(screen.getByRole("button", { name: /^(Salvar|Atualizar)$/ }));
const descricao = (v: string) =>
  fireEvent.change(screen.getByPlaceholderText("Ex: Honorários projeto A"), { target: { value: v } });
// MoneyInput: dígitos entram como centavos ("123456" → "R$ 1.234,56").
const valor = (digitos: string) =>
  fireEvent.change(screen.getByPlaceholderText("R$ 0,00"), { target: { value: digitos } });
const parcelas = (n: string) => fireEvent.change(screen.getByRole("spinbutton"), { target: { value: n } });
const escolher = (rotulo: string | RegExp, value: string) =>
  fireEvent.change(campoSelect(rotulo), { target: { value } });

type Row = Record<string, unknown>;
// Criação passa por rpc_lancamentos_criar (linhas + rateio numa transação só).
const chamadasCriar = (tabela = "despesas") =>
  sb.client.rpc.mock.calls.filter(
    (c) =>
      c[0] === "rpc_lancamentos_criar" &&
      (c[1] as { p_tipo: string }).p_tipo === (tabela === "receitas" ? "receita" : "despesa")
  );
const linhasInseridas = (tabela = "despesas") =>
  ((chamadasCriar(tabela)[0]?.[1] as { p_linhas?: Row[] } | undefined)?.p_linhas ?? []) as Row[];

beforeAll(() => {
  // Checkbox do Radix mede o tamanho com ResizeObserver; o jsdom não tem.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Intl usa espaço não separável depois do "R$".
const valorDoCampo = () => (screen.getByPlaceholderText("R$ 0,00") as HTMLInputElement).value.replace(/\s/g, " ");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 9, 0)); // 10/11/2026
  vi.clearAllMocks();
  sb.reset();
  sb.rpcResultado("rpc_lancamentos_criar", { data: ["d-1"], error: null });
  checkDuplicates.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LancamentoFormDialog: validação (nada é gravado)", () => {
  it("form vazio mostra erro de descrição e de valor", async () => {
    setup();
    salvar();
    expect(await screen.findByText("Descrição obrigatória")).toBeInTheDocument();
    expect(screen.getByText("Valor obrigatório")).toBeInTheDocument();
    expect(sb.client.from).not.toHaveBeenCalled();
    expect(sb.client.rpc).not.toHaveBeenCalled();
  });

  it("só a descrição preenchida e valor vazio: erro no valor e não salva", async () => {
    const { onOpenChange, onSaved } = setup();
    descricao("Aluguel escritório");
    salvar();
    expect(await screen.findByText("Valor obrigatório")).toBeInTheDocument();
    expect(screen.queryByText("Descrição obrigatória")).not.toBeInTheDocument();
    expect(chamadasCriar("despesas")).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("só o valor preenchido e descrição vazia: erro na descrição", async () => {
    setup();
    valor("15000");
    salvar();
    expect(await screen.findByText("Descrição obrigatória")).toBeInTheDocument();
    expect(chamadasCriar("despesas")).toHaveLength(0);
  });

  it("valor zero (R$ 0,00) é recusado", async () => {
    setup();
    descricao("Taxa");
    valor("000");
    salvar();
    expect(await screen.findByText("Valor deve ser maior que zero")).toBeInTheDocument();
    expect(chamadasCriar("despesas")).toHaveLength(0);
  });

  it.each(["0", "61", "-3"])("parcelas = %s é recusado com mensagem visível", async (n) => {
    setup();
    descricao("Notebook");
    valor("500000");
    parcelas(n);
    // O navegador já barra pelo min/max nativo; o submit direto cobre o caso em
    // que a validação nativa não roda e confere a mensagem do próprio form.
    expect(screen.getByRole("spinbutton")).toHaveAttribute("min", "1");
    expect(screen.getByRole("spinbutton")).toHaveAttribute("max", "60");
    fireEvent.submit(screen.getByRole("spinbutton").closest("form") as HTMLFormElement);
    expect(await screen.findByText("Parcelas deve ser entre 1 e 60")).toBeInTheDocument();
    expect(chamadasCriar("despesas")).toHaveLength(0);
  });

  it("despesa marcada como Pago sem conta exige a conta", async () => {
    setup();
    descricao("Energia");
    valor("32000");
    escolher("Status", "Pago");
    salvar();
    expect(await screen.findByText("Conta obrigatória para lançamentos efetivados")).toBeInTheDocument();
    expect(chamadasCriar("despesas")).toHaveLength(0);
  });

  it("receita Recebida sem conta exige a conta", async () => {
    setup({ tipo: "receita" });
    descricao("Honorários");
    valor("1000000");
    escolher("Status", "Recebida");
    salvar();
    expect(await screen.findByText("Conta obrigatória para lançamentos efetivados")).toBeInTheDocument();
    expect(chamadasCriar("receitas")).toHaveLength(0);
  });

  it("pago no cartão de crédito sem escolher o cartão mostra o motivo (o campo conta some nesse modo)", async () => {
    setup();
    descricao("Passagem aérea");
    valor("89000");
    escolher("Forma de pagamento", "Cartão de Crédito");
    escolher("Status", "Pago");
    salvar();
    expect(await screen.findByText("Conta obrigatória para lançamentos efetivados")).toBeInTheDocument();
    expect(chamadasCriar("despesas")).toHaveLength(0);
  });

  it("cartão de crédito mostra só cartões de crédito; débito só de débito", () => {
    setup();
    escolher("Forma de pagamento", "Cartão de Crédito");
    const opcoesCredito = Array.from(campoSelect("Cartão de Crédito").options).map((o) => o.textContent);
    expect(opcoesCredito).toContain("Visa Empresa");
    expect(opcoesCredito).not.toContain("Débito Itaú");

    escolher("Forma de pagamento", "Cartão de Débito");
    const opcoesDebito = Array.from(campoSelect("Cartão de Débito").options).map((o) => o.textContent);
    expect(opcoesDebito).toContain("Débito Itaú");
    expect(opcoesDebito).not.toContain("Visa Empresa");
  });
});

describe("LancamentoFormDialog: criação", () => {
  it("despesa simples grava o payload exato e fecha", async () => {
    const { onOpenChange, onSaved } = setup();
    descricao("Aluguel escritório");
    valor("123456");
    escolher("Conta", "conta-1");
    escolher("Forma de pagamento", "Boleto");
    salvar();

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const rows = linhasInseridas();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      data_vencimento: "2026-11-10",
      data_pagamento: null,
      data_competencia: "2026-11-10",
      descricao: "Aluguel escritório",
      valor: 1234.56,
      status: "Pendente",
      forma_pagamento: "Boleto",
      categoria_id: null,
      projeto_id: null,
      conta_id: "conta-1",
      cartao_id: null,
      fornecedor_id: null,
      centro_custo_id: null,
      nota_fiscal: null,
      observacao: null,
      grupo_parcela: null,
      parcela_numero: null,
      parcela_total: null,
      recorrente: false,
      periodicidade: null,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith("Despesa cadastrada", { description: "1 registro(s) criado(s)" });
  });

  it("despesa paga grava data de pagamento = vencimento", async () => {
    const { onSaved } = setup();
    descricao("Energia");
    valor("32000");
    escolher("Status", "Pago");
    escolher("Conta", "conta-2");
    salvar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(linhasInseridas()[0]).toMatchObject({ status: "Pago", data_pagamento: "2026-11-10", conta_id: "conta-2" });
  });

  it("receita recebida vai para a tabela receitas com status Recebido e cliente", async () => {
    const { onSaved } = setup({ tipo: "receita" });
    descricao("Honorários projeto A");
    valor("1500000");
    escolher("Status", "Recebida");
    escolher("Conta", "conta-1");
    escolher("Cliente (pagante)", "cli-1");
    salvar();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(chamadasCriar("despesas")).toHaveLength(0);
    const [row] = linhasInseridas("receitas");
    expect(row).toMatchObject({
      valor: 15000,
      status: "Recebido",
      data_recebimento: "2026-11-10",
      cliente_id: "cli-1",
      conta_id: "conta-1",
    });
    expect(row).not.toHaveProperty("recorrente");
    expect(row).not.toHaveProperty("cartao_id");
    expect(toast.success).toHaveBeenCalledWith("Receita cadastrada", expect.anything());
  });

  it("receita: escolher projeto preenche o cliente dono do projeto", async () => {
    const { onSaved } = setup({ tipo: "receita" });
    descricao("Medição 1");
    valor("100000");
    fireEvent.click(screen.getByRole("button", { name: /Mais opções/ }));
    escolher("Projeto", "proj-2");
    salvar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(linhasInseridas("receitas")[0]).toMatchObject({ projeto_id: "proj-2", cliente_id: "cli-2" });
  });

  it("parcelado em 3x de R$ 100,00 fecha no centavo (33,33 + 33,33 + 33,34)", async () => {
    const { onSaved } = setup();
    descricao("Software");
    valor("10000");
    parcelas("3");
    escolher("Status", "Pago");
    escolher("Conta", "conta-1");
    salvar();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const rows = linhasInseridas();
    expect(rows.map((r) => r.valor)).toEqual([33.33, 33.33, 33.34]);
    expect(Math.round(rows.reduce((a, r) => a + (r.valor as number), 0) * 100)).toBe(10000);
    expect(rows.map((r) => r.descricao)).toEqual(["Software (1/3)", "Software (2/3)", "Software (3/3)"]);
    expect(rows.map((r) => r.data_vencimento)).toEqual(["2026-11-10", "2026-12-10", "2027-01-10"]);
    expect(rows.map((r) => r.parcela_numero)).toEqual([1, 2, 3]);
    expect(rows.every((r) => r.parcela_total === 3)).toBe(true);
    const grupo = rows[0].grupo_parcela;
    expect(typeof grupo).toBe("string");
    expect(rows.every((r) => r.grupo_parcela === grupo)).toBe(true);
    // Só a primeira parcela fica paga; as futuras nascem pendentes.
    expect(rows.map((r) => r.status)).toEqual(["Pago", "Pendente", "Pendente"]);
    expect(rows.map((r) => r.data_pagamento)).toEqual(["2026-11-10", null, null]);
    // Competência de todas = vencimento da primeira (regra atual do form).
    expect(rows.every((r) => r.data_competencia === "2026-11-10")).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Despesa cadastrada", { description: "3 registro(s) criado(s)" });
  });

  it.each([
    ["100000", 12, 100000],
    ["99999", 7, 99999],
    ["1", 2, 1],
    ["123456789", 60, 123456789],
  ])("parcelamento de %s centavos em %ix soma exatamente o total", async (digitos, n, centavos) => {
    const { onSaved } = setup();
    descricao("Equipamento");
    valor(digitos);
    parcelas(String(n));
    salvar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const rows = linhasInseridas();
    expect(rows).toHaveLength(n);
    const soma = rows.reduce((a, r) => a + Math.round((r.valor as number) * 100), 0);
    expect(soma).toBe(centavos);
    // Nenhuma parcela com mais de 2 casas decimais.
    expect(rows.every((r) => Math.abs((r.valor as number) * 100 - Math.round((r.valor as number) * 100)) < 1e-6)).toBe(
      true
    );
  });

  it("parcela com vencimento dia 31 cai no último dia dos meses curtos", async () => {
    vi.setSystemTime(new Date(2027, 0, 31, 9, 0)); // 31/01/2027
    const { onSaved } = setup();
    descricao("Seguro");
    valor("30000");
    parcelas("3");
    salvar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(linhasInseridas().map((r) => r.data_vencimento)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("despesa recorrente trimestral grava recorrente e periodicidade", async () => {
    const { onSaved } = setup();
    descricao("Contador");
    valor("80000");
    fireEvent.click(screen.getByRole("button", { name: /Mais opções/ }));
    fireEvent.click(screen.getByRole("checkbox"));
    escolher("Recorrência", "trimestral");
    salvar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(linhasInseridas()[0]).toMatchObject({ recorrente: true, periodicidade: "trimestral" });
  });

  it("receita não oferece recorrência", () => {
    setup({ tipo: "receita" });
    fireEvent.click(screen.getByRole("button", { name: /Mais opções/ }));
    expect(screen.queryByText("Despesa recorrente")).not.toBeInTheDocument();
  });

  it("vínculo com projeto, categoria e fornecedor vai no payload", async () => {
    const { onSaved } = setup();
    descricao("Plotagem");
    valor("4590");
    escolher("Fornecedor", "forn-1");
    fireEvent.click(screen.getByRole("button", { name: /Mais opções/ }));
    escolher("Projeto", "proj-1");
    escolher("Categoria", "cat-1");
    salvar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(linhasInseridas()[0]).toMatchObject({
      valor: 45.9,
      fornecedor_id: "forn-1",
      projeto_id: "proj-1",
      categoria_id: "cat-1",
    });
  });
});

describe("LancamentoFormDialog: rateio entre centros de custo", () => {
  function ligarRateio(p1: string, p2: string) {
    fireEvent.click(screen.getByRole("button", { name: /Mais opções/ }));
    fireEvent.click(screen.getByRole("button", { name: "OFF" }));
    const selects = Array.from(document.querySelectorAll("select")).filter((s) =>
      Array.from(s.options).some((o) => o.value === "cc-1")
    );
    // [0] = Centro de custo (desabilitado com rateio), [1..] = linhas do rateio
    fireEvent.change(selects[1], { target: { value: "cc-1" } });
    fireEvent.change(selects[2], { target: { value: "cc-2" } });
    const pcts = screen.getAllByPlaceholderText("%");
    fireEvent.change(pcts[0], { target: { value: p1 } });
    fireEvent.change(pcts[1], { target: { value: p2 } });
  }

  it("rateio somando 100% vai junto com as parcelas na mesma chamada (tudo-ou-nada)", async () => {
    const { onSaved } = setup();
    descricao("Topografia");
    valor("200000");
    parcelas("2");
    ligarRateio("60", "40");
    expect(screen.getByText("Soma: 100.00%")).toBeInTheDocument();
    salvar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [chamada] = chamadasCriar();
    expect((chamada[1] as { p_linhas: Row[] }).p_linhas).toHaveLength(2);
    expect((chamada[1] as { p_rateios: unknown }).p_rateios).toEqual([
      { centro_custo_id: "cc-1", percentual: 60 },
      { centro_custo_id: "cc-2", percentual: 40 },
    ]);
    // O rateio não é mais gravado em chamadas soltas depois do insert.
    expect(sb.client.rpc.mock.calls.filter((c) => c[0] === "rpc_lancamento_set_rateio")).toHaveLength(0);
  });

  it("rateio que não soma 100% bloqueia ANTES de gravar o lançamento", async () => {
    const { onSaved, onOpenChange } = setup();
    descricao("Topografia");
    valor("200000");
    ligarRateio("60", "30");
    expect(screen.getByText("Soma: 90.00%")).toBeInTheDocument();
    salvar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Erro ao salvar", {
        description: "Soma dos percentuais do rateio deve ser 100 (atual: 90)",
      })
    );
    // Antes da correção a despesa era inserida e só depois o rateio falhava:
    // o form ficava aberto e um novo "Salvar" duplicava o lançamento.
    expect(chamadasCriar("despesas")).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("LancamentoFormDialog: falhas do servidor", () => {
  it("erro no insert mantém o form aberto com os dados e avisa", async () => {
    sb.rpcResultado("rpc_lancamentos_criar", {
      data: null,
      error: { message: "violates check constraint", details: "valor" },
    });
    const { onOpenChange, onSaved } = setup();
    descricao("Aluguel");
    valor("500000");
    salvar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Erro ao salvar", { description: "violates check constraint (valor)" })
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Ex: Honorários projeto A")).toHaveValue("Aluguel");
    expect(valorDoCampo()).toBe("R$ 5.000,00");
    // botão volta a ficar disponível para nova tentativa
    expect(screen.getByRole("button", { name: "Salvar" })).not.toBeDisabled();
  });

  it("usuário sem empresa: o servidor recusa e o form avisa", async () => {
    sb.rpcResultado("rpc_lancamentos_criar", { data: null, error: { message: "Usuário sem empresa" } });
    const { onSaved } = setup();
    descricao("Aluguel");
    valor("500000");
    salvar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Erro ao salvar", { description: "Usuário sem empresa" })
    );
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("LancamentoFormDialog: duplicata", () => {
  it("possível duplicata pede confirmação antes de gravar; confirmar grava", async () => {
    checkDuplicates.mockResolvedValue([
      {
        id: "dup-1",
        descricao: "Aluguel",
        valor: 5000,
        data_vencimento: "2026-11-09",
        status: "Pendente",
        contraparte_nome: "Imobiliária Exemplo",
        nota_fiscal: null,
        confianca: "media",
        motivo: "Descrição parecida, mesmo valor e vencimento próximo",
      },
    ]);
    const { onSaved } = setup();
    descricao("Aluguel");
    valor("500000");
    salvar();

    expect(await screen.findByText("Possível duplicata")).toBeInTheDocument();
    expect(screen.getByText("Descrição parecida, mesmo valor e vencimento próximo")).toBeInTheDocument();
    expect(screen.getByText("Você está lançando")).toBeInTheDocument();
    expect(checkDuplicates).toHaveBeenCalledWith(
      expect.objectContaining({ table: "despesas", descricao: "Aluguel", valor: 5000 })
    );
    expect(chamadasCriar("despesas")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Salvar mesmo assim" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(chamadasCriar("despesas")).toHaveLength(1);
  });

  it("parcelado confere duplicata pelo valor da parcela", async () => {
    setup();
    descricao("Notebook");
    valor("300000");
    parcelas("3");
    salvar();
    await waitFor(() => expect(checkDuplicates).toHaveBeenCalled());
    expect(checkDuplicates.mock.calls[0][0]).toMatchObject({ valor: 1000 });
  });

  it("envia fornecedor e nota fiscal para o motor (sinais mais fortes que a descrição)", async () => {
    setup();
    descricao("Material");
    valor("48000");
    fireEvent.click(screen.getByRole("button", { name: /Mais opções/ }));
    escolher("Fornecedor", "forn-1");
    fireEvent.change(screen.getByLabelText("Nº da nota fiscal"), { target: { value: "NF 1234" } });
    salvar();
    await waitFor(() => expect(checkDuplicates).toHaveBeenCalled());
    expect(checkDuplicates.mock.calls[0][0]).toMatchObject({ contraparteId: "forn-1", notaFiscal: "NF 1234" });
  });

  it("mesma nota fiscal aparece como quase certo", async () => {
    checkDuplicates.mockResolvedValue([
      {
        id: "dup-2",
        descricao: "Material de escritório",
        valor: 480,
        data_vencimento: "2026-11-09",
        status: "Pago",
        contraparte_nome: "Papelaria Central",
        nota_fiscal: "NF 1234",
        confianca: "certeza",
        motivo: "Mesma nota fiscal",
      },
    ]);
    setup();
    descricao("Material");
    valor("48000");
    salvar();
    expect(await screen.findByText("Este lançamento parece já existir")).toBeInTheDocument();
    expect(screen.getByText("Quase certo")).toBeInTheDocument();
    expect(screen.getByText("Mesma nota fiscal")).toBeInTheDocument();
  });

  it("cancelar a duplicata não grava", async () => {
    checkDuplicates.mockResolvedValue([
      {
        id: "dup-1",
        descricao: "Aluguel",
        valor: 5000,
        data_vencimento: "2026-11-09",
        status: "Pendente",
        contraparte_nome: "Imobiliária Exemplo",
        nota_fiscal: null,
        confianca: "media",
        motivo: "Descrição parecida, mesmo valor e vencimento próximo",
      },
    ]);
    const { onSaved } = setup();
    descricao("Aluguel");
    valor("500000");
    salvar();
    const alerta = await screen.findByRole("alertdialog");
    fireEvent.click(within(alerta).getByRole("button", { name: "Não salvar" }));
    await waitFor(() => expect(screen.queryByText("Possível duplicata")).not.toBeInTheDocument());
    expect(chamadasCriar("despesas")).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
  });
});

const lancamentoBase: Lancamento = {
  id: "d-9",
  tipo: "despesa",
  data_vencimento: "2026-10-05",
  data_efetivacao: "2026-10-03",
  data_competencia: "2026-09-30",
  descricao: "Internet",
  valor: 199.9,
  status: "Pago",
  categoria_id: "cat-1",
  categoria_nome: "Honorários",
  projeto_id: null,
  projeto_nome: null,
  centro_custo_id: null,
  conta_id: "conta-1",
  conta_nome: "Itaú PJ",
  contraparte_id: "forn-1",
  contraparte_tipo: "fornecedor",
  contraparte_nome: "Papelaria Central",
  forma_pagamento: "PIX",
  cartao_id: null,
  parcela_numero: null,
  parcela_total: null,
  grupo_parcela: null,
  grupo_tipo: null,
  grupo_status: null,
  grupo_total_original: null,
  tags: null,
  transferencia_par_id: null,
  nota_fiscal: null,
  observacao: null,
  recorrente: true,
  periodicidade: "mensal",
};

describe("LancamentoFormDialog: edição", () => {
  beforeEach(() => {
    sb.resultado("lancamento_rateios.select", { data: [], error: null });
    sb.resultado("despesas.update", { data: null, error: null });
  });

  it("carrega os dados, não oferece parcelas e atualiza preservando a data real de pagamento", async () => {
    const { onSaved } = setup({ lancamento: lancamentoBase });
    expect(screen.getByRole("heading", { name: "Editar Despesa" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: Honorários projeto A")).toHaveValue("Internet");
    expect(valorDoCampo()).toBe("R$ 199,90");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    valor("24990");
    salvar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(checkDuplicates).not.toHaveBeenCalled();
    const [update] = sb.de("despesas", "update");
    expect(update.args[0]).toMatchObject({
      valor: 249.9,
      status: "Pago",
      data_vencimento: "2026-10-05",
      data_pagamento: "2026-10-03",
      data_competencia: "2026-09-30",
      fornecedor_id: "forn-1",
      conta_id: "conta-1",
      recorrente: true,
      periodicidade: "mensal",
    });
    expect(sb.de("despesas", "eq")[0].args).toEqual(["id", "d-9"]);
    expect(toast.success).toHaveBeenCalledWith("Lançamento atualizado");
  });

  it("lançamento sem a coluna recorrente não sobrescreve a recorrência", async () => {
    const semRecorrencia = { ...lancamentoBase, recorrente: undefined, periodicidade: undefined };
    const { onSaved } = setup({ lancamento: semRecorrencia });
    salvar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const payload = sb.de("despesas", "update")[0].args[0] as Row;
    expect(payload).not.toHaveProperty("recorrente");
    expect(payload).not.toHaveProperty("periodicidade");
  });

  it("voltar a despesa vencida para em aberto limpa a data de pagamento e grava Atrasado", async () => {
    const { onSaved } = setup({ lancamento: lancamentoBase });
    escolher("Status", "Pendente");
    salvar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    // Vencimento 05/10 < hoje (10/11): em aberto e vencido é Atrasado.
    expect(sb.de("despesas", "update")[0].args[0]).toMatchObject({ status: "Atrasado", data_pagamento: null });
  });

  it("lançamento Atrasado carrega como Pendente no select (opção que existe)", () => {
    setup({ lancamento: { ...lancamentoBase, status: "Atrasado", data_efetivacao: null } });
    expect(campoSelect("Status")).toHaveValue("Pendente");
  });

  it("adiar o vencimento de um Atrasado para o futuro volta a Pendente", async () => {
    const atrasado = { ...lancamentoBase, status: "Atrasado", data_efetivacao: null, data_vencimento: "2026-12-20" };
    const { onSaved } = setup({ lancamento: atrasado });
    salvar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sb.de("despesas", "update")[0].args[0]).toMatchObject({ status: "Pendente", data_vencimento: "2026-12-20" });
  });

  it("receita Recebido carrega como Recebida e grava de volta como Recebido", async () => {
    sb.resultado("receitas.update", { data: null, error: null });
    const receita: Lancamento = {
      ...lancamentoBase,
      id: "r-9",
      tipo: "receita",
      status: "Recebido",
      contraparte_id: "cli-1",
      contraparte_tipo: "cliente",
    };
    const { onSaved } = setup({ tipo: "receita", lancamento: receita });
    expect(campoSelect("Status")).toHaveValue("Recebida");
    salvar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sb.de("receitas", "update")[0].args[0]).toMatchObject({
      status: "Recebido",
      // Data real do recebimento (data_efetivacao), não o vencimento (B3).
      data_recebimento: "2026-10-03",
      cliente_id: "cli-1",
    });
  });

  it("erro do servidor na edição mantém aberto e avisa", async () => {
    sb.resultado("despesas.update", { data: null, error: { message: "permission denied" } });
    const { onOpenChange, onSaved } = setup({ lancamento: lancamentoBase });
    salvar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Erro ao salvar", { description: "permission denied" })
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("edição também exige valor > 0", async () => {
    setup({ lancamento: lancamentoBase });
    valor("0");
    salvar();
    expect(await screen.findByText("Valor deve ser maior que zero")).toBeInTheDocument();
    expect(sb.de("despesas", "update")).toHaveLength(0);
  });
});
