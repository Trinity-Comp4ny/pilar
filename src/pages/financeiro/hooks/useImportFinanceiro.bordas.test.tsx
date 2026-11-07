import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { sb } from "../testing/supabaseMock";

// Bordas da importação de extrato: dados auxiliares (pendentes sem data ficam de
// fora), abas e leitura de Excel/CSV, erros da edge de IA, falhas no meio da
// gravação e o desfazer completo (receitas criadas e despesas conciliadas).

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));

// SheetJS substituído: cada teste define as abas da "planilha".
const planilha = vi.hoisted(() => ({ SheetNames: [] as string[], Sheets: {} as Record<string, string> }));
vi.mock("xlsx", () => ({
  read: vi.fn(() => ({ SheetNames: planilha.SheetNames, Sheets: planilha.Sheets })),
  utils: { sheet_to_csv: vi.fn((aba: string) => aba) },
}));

import { analytics } from "@/lib/analytics";
import { useImportFinanceiro, type AuxData, type ItemImport } from "./useImportFinanceiro";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const setup = () => renderHook(() => useImportFinanceiro(), { wrapper }).result;

const auxVazio: AuxData = { categorias: [], contas: [], projetos: [], pendentes: [] };

function item(p: Partial<ItemImport>): ItemImport {
  return {
    id: crypto.randomUUID(),
    incluir: true,
    data: "2026-10-12",
    descricao: "x",
    valor: 100,
    tipo: "despesa",
    categoriaId: null,
    categoriaSugerida: null,
    parcelaNumero: null,
    parcelaTotal: null,
    confianca: 1,
    lineHash: "h",
    duplicataId: null,
    acao: "criar",
    ...p,
  };
}

function arquivo(nome: string, conteudo = "") {
  return new File([conteudo], nome);
}

const CSV = "Data;Descrição;Valor\n12/10/2026;Cimento;-150,00\n13/10/2026;Medição;2.000,00\n";

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  planilha.SheetNames = [];
  planilha.Sheets = {};
  sb.rpcResultado("get_user_empresa_id", { data: "emp-1", error: null });
});

describe("useImportFinanceiro: dados auxiliares", () => {
  it("carrega categorias, contas, projetos e pendentes (sem data ficam de fora)", async () => {
    sb.resultado("categorias_financeiras.select", { data: [{ id: "c1", nome: "Material", tipo: "despesa" }] });
    sb.resultado("contas.select", { data: [{ id: "k1", nome: "Itaú", banco: "341" }] });
    sb.resultado("projetos.select", { data: null });
    sb.resultado("despesas.select", {
      data: [
        { id: "d1", valor: "150", data_vencimento: "2026-10-12" },
        { id: "d2", valor: 10, data_vencimento: null },
      ],
    });
    sb.resultado("receitas.select", { data: [{ id: "r1", valor: 2000, data_vencimento: "2026-10-10" }] });
    const result = setup();
    await waitFor(() => expect(result.current.auxQuery.isSuccess).toBe(true));
    expect(result.current.auxQuery.data).toEqual({
      categorias: [{ id: "c1", nome: "Material", tipo: "despesa" }],
      contas: [{ id: "k1", nome: "Itaú", banco: "341" }],
      projetos: [],
      pendentes: [
        { id: "d1", valor: 150, data: "2026-10-12", tipo: "despesa" },
        { id: "r1", valor: 2000, data: "2026-10-10", tipo: "receita" },
      ],
    });
  });

  it("sem dados nas tabelas devolve listas vazias", async () => {
    for (const t of ["categorias_financeiras", "contas", "despesas", "receitas"]) {
      sb.resultado(`${t}.select`, { data: null });
    }
    const result = setup();
    await waitFor(() => expect(result.current.auxQuery.isSuccess).toBe(true));
    expect(result.current.auxQuery.data).toEqual({ categorias: [], contas: [], projetos: [], pendentes: [] });
  });
});

describe("useImportFinanceiro: abas e leitura de arquivo", () => {
  it("listarAbas: CSV/PDF não têm abas; Excel com uma aba não pergunta; com várias, lista", async () => {
    const result = setup();
    expect(await result.current.listarAbas(arquivo("extrato.csv"))).toEqual([]);
    expect(await result.current.listarAbas(arquivo("sem-extensao"))).toEqual([]);
    planilha.SheetNames = ["Única"];
    expect(await result.current.listarAbas(arquivo("x.xlsx"))).toEqual([]);
    planilha.SheetNames = ["Jan", "Fev"];
    expect(await result.current.listarAbas(arquivo("x.XLS"))).toEqual(["Jan", "Fev"]);
  });

  it("extrairArquivo CSV: monta itens com confiança 1 e concilia com pendente", async () => {
    const result = setup();
    const aux: AuxData = {
      ...auxVazio,
      pendentes: [{ id: "r-pend", valor: 2000, data: "2026-10-13", tipo: "receita" }],
    };
    const { itens, avisos } = await result.current.extrairArquivo(arquivo("e.csv", CSV), aux);
    expect(avisos).toEqual([]);
    expect(itens).toEqual([
      expect.objectContaining({ descricao: "Cimento", valor: 150, tipo: "despesa", confianca: 1, acao: "criar" }),
      expect.objectContaining({ descricao: "Medição", tipo: "receita", acao: "conciliar", duplicataId: "r-pend" }),
    ]);
  });

  it("extrairArquivo Excel: usa a aba pedida, ou a primeira quando ela não existe", async () => {
    planilha.SheetNames = ["Resumo", "Lançamentos"];
    planilha.Sheets = { Resumo: "Data;Descrição;Valor\n", Lançamentos: CSV };
    const result = setup();
    const escolhida = await result.current.extrairArquivo(arquivo("e.xlsx"), auxVazio, "Lançamentos");
    expect(escolhida.itens).toHaveLength(2);
    const fallback = await result.current.extrairArquivo(arquivo("e.xlsx"), auxVazio, "Inexistente");
    expect(fallback.itens).toHaveLength(0);
  });

  it("Excel sem abas legíveis falha com mensagem clara", async () => {
    const result = setup();
    await expect(result.current.extrairArquivo(arquivo("e.xls"), auxVazio)).rejects.toThrow(
      "Planilha sem abas legíveis."
    );
  });
});

describe("useImportFinanceiro: erros da edge de IA", () => {
  it("erro genérico do invoke vira a mensagem do erro", async () => {
    vi.mocked(sb.client.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: "Edge Function returned a non-2xx status code" },
    } as never);
    const result = setup();
    await expect(result.current.extrairTextoIA("x", "extrato", auxVazio)).rejects.toThrow(
      "Edge Function returned a non-2xx status code"
    );
  });

  it("erro sem mensagem cai no texto padrão", async () => {
    vi.mocked(sb.client.functions.invoke).mockResolvedValueOnce({ data: null, error: {} } as never);
    const result = setup();
    await expect(result.current.extrairTextoIA("x", "fatura", auxVazio)).rejects.toThrow(
      "Falha ao extrair do documento"
    );
  });

  it("erro HTTP da função usa o motivo do corpo da resposta", async () => {
    const erro = new FunctionsHttpError(new Response(JSON.stringify({ error: "IA fora do ar" }), { status: 503 }));
    vi.mocked(sb.client.functions.invoke).mockResolvedValueOnce({ data: null, error: erro } as never);
    const result = setup();
    await expect(result.current.extrairTextoIA("x", "extrato", auxVazio)).rejects.toThrow("IA fora do ar");
  });

  it("erro HTTP com corpo ilegível mantém a mensagem do erro", async () => {
    const erro = new FunctionsHttpError(new Response("<html>", { status: 500 }));
    vi.mocked(sb.client.functions.invoke).mockResolvedValueOnce({ data: null, error: erro } as never);
    const result = setup();
    await expect(result.current.extrairTextoIA("x", "extrato", auxVazio)).rejects.toThrow(erro.message);
  });

  it("resposta sem lançamentos devolve lista vazia; parcelas e categoria sugerida passam adiante", async () => {
    vi.mocked(sb.client.functions.invoke)
      .mockResolvedValueOnce({ data: {}, error: null } as never)
      .mockResolvedValueOnce({
        data: {
          lancamentos: [
            {
              data: "2026-10-12",
              descricao: "Notebook",
              valor: 1000,
              tipo: "despesa",
              parcela_numero: "2",
              parcela_total: 10,
              categoria_sugerida: "Equipamentos",
            },
          ],
        },
        error: null,
      } as never);
    const result = setup();
    expect(await result.current.extrairTextoIA("x", "extrato", auxVazio)).toEqual({ itens: [], avisos: [] });
    const { itens } = await result.current.extrairTextoIA("x", "fatura", auxVazio);
    expect(itens[0]).toMatchObject({
      parcelaNumero: 2,
      parcelaTotal: 10,
      categoriaSugerida: "Equipamentos",
      categoriaId: null,
    });
  });
});

describe("useImportFinanceiro: gravar lote", () => {
  it("sem empresa identificada não grava e libera o estado de gravação", async () => {
    sb.rpcResultado("get_user_empresa_id", { data: null, error: null });
    const result = setup();
    await act(async () => {
      await expect(result.current.gravarLote([item({})], { contaId: null, projetoId: null })).rejects.toThrow(
        "Empresa não identificada"
      );
    });
    expect(result.current.gravando).toBe(false);
    expect(sb.de("despesas", "insert")).toHaveLength(0);
  });

  it("cria receitas, concilia despesas na conta escolhida e registra só contagens no analytics", async () => {
    sb.resultado("receitas.insert", { data: [{ id: "r-nova" }] });
    sb.resultado("despesas.select", { data: [{ id: "d-pend", conta_id: null }] });
    const result = setup();
    let resumo;
    await act(async () => {
      resumo = await result.current.gravarLote(
        [
          item({ tipo: "receita", descricao: "Honorários", valor: 5000, parcelaNumero: 1, parcelaTotal: 2 }),
          item({ tipo: "despesa", valor: 300, acao: "conciliar", duplicataId: "d-pend", data: "2026-10-15" }),
        ],
        { contaId: "conta-1", projetoId: "proj-1" }
      );
    });
    expect(resumo).toEqual({ criados: 1, conciliados: 1, totalDespesa: 300, totalReceita: 5000 });
    expect(sb.de("receitas", "insert")[0].args[0]).toEqual([
      expect.objectContaining({
        descricao: "Honorários",
        projeto_id: "proj-1",
        conta_id: "conta-1",
        parcela_numero: 1,
        parcela_total: 2,
      }),
    ]);
    expect(sb.de("despesas", "update")[0].args[0]).toEqual({
      status: "Pago",
      data_pagamento: "2026-10-15",
      conta_id: "conta-1",
    });
    expect(analytics.track).toHaveBeenCalledWith("importacao_financeira_concluida", {
      criados: 1,
      conciliados: 1,
      com_conta: true,
    });

    // Desfazer: apaga a receita criada e devolve a despesa à conta original (nenhuma).
    sb.chamadas.length = 0;
    await act(async () => {
      await result.current.desfazer();
    });
    expect(sb.de("receitas", "in")[0].args).toEqual(["id", ["r-nova"]]);
    expect(sb.de("receitas", "delete")).toHaveLength(1);
    expect(sb.de("despesas", "update")[0].args[0]).toEqual({
      status: "Pendente",
      data_pagamento: null,
      conta_id: null,
    });
    expect(result.current.temDesfazer).toBe(false);
  });

  it.each([
    ["despesas.select", "conciliar despesa"],
    ["receitas.select", "conciliar receita"],
  ])("erro ao ler a conta original (%s) interrompe a gravação", async (chave) => {
    sb.resultado(chave, { data: null, error: { message: "rls" } });
    const tipo = chave.startsWith("despesas") ? "despesa" : "receita";
    const result = setup();
    await act(async () => {
      await expect(
        result.current.gravarLote([item({ tipo, acao: "conciliar", duplicataId: "x" })], {
          contaId: "conta-1",
          projetoId: null,
        })
      ).rejects.toEqual({ message: "rls" });
    });
    expect(result.current.temDesfazer).toBe(false);
  });

  it.each([
    ["despesas.insert", item({ tipo: "despesa" })],
    ["receitas.insert", item({ tipo: "receita" })],
    ["despesas.update", item({ tipo: "despesa", acao: "conciliar", duplicataId: "d" })],
    ["receitas.update", item({ tipo: "receita", acao: "conciliar", duplicataId: "r" })],
  ])("erro em %s interrompe a gravação sem habilitar o desfazer", async (chave, it_) => {
    sb.resultado(chave, { data: null, error: { message: "falhou" } });
    const result = setup();
    await act(async () => {
      await expect(result.current.gravarLote([it_], { contaId: null, projetoId: null })).rejects.toEqual({
        message: "falhou",
      });
    });
    expect(result.current.temDesfazer).toBe(false);
    expect(result.current.gravando).toBe(false);
  });

  it("insert sem retorno de ids não quebra o resumo", async () => {
    sb.resultado("despesas.insert", { data: null });
    sb.resultado("receitas.insert", { data: null });
    const result = setup();
    let resumo;
    await act(async () => {
      resumo = await result.current.gravarLote([item({}), item({ tipo: "receita" })], {
        contaId: null,
        projetoId: null,
      });
    });
    expect(resumo).toEqual({ criados: 0, conciliados: 0, totalDespesa: 100, totalReceita: 100 });
  });
});

describe("useImportFinanceiro: desfazer", () => {
  it("sem lote gravado não faz nada", async () => {
    const result = setup();
    await act(async () => {
      await result.current.desfazer();
    });
    expect(sb.chamadas.filter((c) => c.op === "delete" || c.op === "update")).toHaveLength(0);
  });

  async function gravarTudo(result: ReturnType<typeof setup>) {
    sb.resultado("despesas.insert", { data: [{ id: "d-nova" }] });
    sb.resultado("receitas.insert", { data: [{ id: "r-nova" }] });
    await act(async () => {
      await result.current.gravarLote(
        [
          item({}),
          item({ tipo: "receita" }),
          item({ acao: "conciliar", duplicataId: "d-pend" }),
          item({ tipo: "receita", acao: "conciliar", duplicataId: "r-pend" }),
        ],
        { contaId: null, projetoId: null }
      );
    });
  }

  it("sem conta sobrescrita, restaura só status e data das conciliadas", async () => {
    const result = setup();
    await gravarTudo(result);
    sb.chamadas.length = 0;
    await act(async () => {
      await result.current.desfazer();
    });
    expect(sb.de("despesas", "update")[0].args[0]).toEqual({ status: "Pendente", data_pagamento: null });
    expect(sb.de("receitas", "update")[0].args[0]).toEqual({ status: "Pendente", data_recebimento: null });
  });

  it.each(["despesas.delete", "receitas.delete", "despesas.update", "receitas.update"])(
    "erro em %s no desfazer é propagado e mantém o desfazer disponível",
    async (chave) => {
      const result = setup();
      await gravarTudo(result);
      sb.resultado(chave, { data: null, error: { message: "nao" } });
      await act(async () => {
        await expect(result.current.desfazer()).rejects.toEqual({ message: "nao" });
      });
      expect(result.current.temDesfazer).toBe(true);
    }
  );
});
