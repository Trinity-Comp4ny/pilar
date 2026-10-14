import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Builder encadeável do supabase-js: registra cada chamada e o `await` resolve o
// resultado configurado para "tabela.operação".
type Resultado = { data?: unknown; error?: unknown };
const resultados = new Map<string, Resultado>();
const chamadas: Array<{ tabela: string; op: string; metodo: string; args: unknown[] }> = [];

function builder(tabela: string) {
  let op = "";
  const b: Record<string, unknown> = {};
  for (const metodo of ["insert", "update", "delete", "select", "eq", "in", "is"]) {
    b[metodo] = (...args: unknown[]) => {
      if (!op && ["insert", "update", "delete", "select"].includes(metodo)) op = metodo;
      chamadas.push({ tabela, op, metodo, args });
      return b;
    };
  }
  b.then = (resolve: (r: Resultado) => unknown) =>
    resolve(resultados.get(`${tabela}.${op}`) ?? { data: [], error: null });
  return b;
}

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabela: string) => builder(tabela),
    rpc: vi.fn(async () => ({ data: "empresa-1", error: null })),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));

import { useImportFinanceiro, type AuxData, type ItemImport } from "./useImportFinanceiro";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function setup() {
  return renderHook(() => useImportFinanceiro(), { wrapper }).result;
}

const aux: AuxData = {
  categorias: [
    { id: "cat-material", nome: "Material", tipo: "despesa" },
    { id: "cat-material-receita", nome: "Material", tipo: "receita" },
  ],
  contas: [],
  projetos: [],
  pendentes: [{ id: "rec-pendente", valor: 2000, data: "2026-10-10", tipo: "receita" }],
};

function item(parcial: Partial<ItemImport>): ItemImport {
  return {
    id: crypto.randomUUID(),
    incluir: true,
    data: "2026-10-12",
    descricao: "x",
    valor: 0,
    tipo: "despesa",
    categoriaId: null,
    categoriaSugerida: null,
    parcelaNumero: null,
    parcelaTotal: null,
    confianca: 1,
    lineHash: "hash",
    duplicataId: null,
    acao: "criar",
    ...parcial,
  };
}

describe("useImportFinanceiro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resultados.clear();
    chamadas.length = 0;
  });

  describe("extrairTextoIA (resposta da IA validada na fronteira)", () => {
    it("aproveita o que é válido, descarta o resto com aviso e concilia com o pendente", async () => {
      invoke.mockResolvedValue({
        data: {
          avisos: ["Página 2 ilegível."],
          lancamentos: [
            { data: "12/10/2026", descricao: "Cimento", valor: -150, tipo: "despesa", categoria_sugerida: "material" },
            { data: "11/10/2026", descricao: "Medição 3", valor: "2000", tipo: "receita", confianca: 0.9 },
            { descricao: "sem data nem tipo" },
            { data: "32/13/2026", descricao: "Data impossível", valor: 10, tipo: "despesa" },
          ],
        },
        error: null,
      });
      const result = setup();

      const { itens, avisos } = await result.current.extrairTextoIA("texto do PDF", "extrato", aux);

      expect(itens).toHaveLength(2);
      const [cimento, medicao] = itens;
      // Valor negativo do extrato vira positivo: o tipo já diz o sentido.
      expect(cimento).toMatchObject({ valor: 150, data: "2026-10-12", acao: "criar", confianca: 0.5 });
      // Categoria casa por nome sem diferenciar maiúscula, e respeitando o tipo.
      expect(cimento.categoriaId).toBe("cat-material");
      // Mesmo valor e data a até 3 dias de um pendente: concilia em vez de duplicar.
      expect(medicao).toMatchObject({ valor: 2000, acao: "conciliar", duplicataId: "rec-pendente" });
      expect(avisos).toEqual([
        "Página 2 ilegível.",
        "Lançamento ignorado: formato inválido na resposta do documento.",
        "Lançamento ignorado: data inválida (Data impossível).",
      ]);
    });

    it("erro devolvido pela função vira a mensagem mostrada ao usuário", async () => {
      invoke.mockResolvedValue({ data: { error: "Documento grande demais" }, error: null });
      const result = setup();

      await expect(result.current.extrairTextoIA("x", "extrato", aux)).rejects.toThrow("Documento grande demais");
    });

    it("resposta fora do formato esperado é recusada", async () => {
      invoke.mockResolvedValue({ data: { lancamentos: "não é lista" }, error: null });
      const result = setup();

      await expect(result.current.extrairTextoIA("x", "extrato", aux)).rejects.toThrow(
        "Resposta do documento em formato inesperado"
      );
    });
  });

  describe("gravarLote e desfazer", () => {
    beforeEach(() => {
      resultados.set("despesas.insert", { data: [{ id: "desp-nova" }], error: null });
      resultados.set("receitas.select", {
        data: [{ id: "rec-pendente", valor: 2000, data_vencimento: "2026-10-10", conta_id: "conta-antiga" }],
        error: null,
      });
    });

    const itens = [
      item({ descricao: "Cimento", valor: 150, tipo: "despesa", categoriaId: "cat-material", lineHash: "h1" }),
      item({ valor: 2000, tipo: "receita", acao: "conciliar", duplicataId: "rec-pendente", data: "2026-10-11" }),
      item({ descricao: "Desmarcado", valor: 999, incluir: false }),
    ];

    it("cria o novo, concilia o pendente na conta escolhida e ignora o desmarcado", async () => {
      const result = setup();

      let resumo;
      await act(async () => {
        resumo = await result.current.gravarLote(itens, { contaId: "conta-1", projetoId: null });
      });

      expect(resumo).toEqual({ criados: 1, conciliados: 1, totalDespesa: 150, totalReceita: 2000 });

      const insert = chamadas.find((c) => c.tabela === "despesas" && c.metodo === "insert");
      expect(insert?.args[0]).toEqual([
        expect.objectContaining({
          empresa_id: "empresa-1",
          descricao: "Cimento",
          valor: 150,
          status: "Pendente",
          conta_id: "conta-1",
          categoria_id: "cat-material",
          import_batch_id: expect.any(String),
          import_line_hash: "h1",
        }),
      ]);
      const conciliacao = chamadas.find((c) => c.tabela === "receitas" && c.metodo === "update");
      expect(conciliacao?.args[0]).toEqual({ status: "Recebido", data_recebimento: "2026-10-11", conta_id: "conta-1" });
      expect(result.current.temDesfazer).toBe(true);
    });

    it("desfazer apaga o que criou e devolve o pendente à conta original", async () => {
      const result = setup();
      await act(async () => {
        await result.current.gravarLote(itens, { contaId: "conta-1", projetoId: null });
      });
      chamadas.length = 0;

      await act(async () => {
        await result.current.desfazer();
      });

      const apagou = chamadas.find((c) => c.tabela === "despesas" && c.op === "delete" && c.metodo === "in");
      expect(apagou?.args).toEqual(["id", ["desp-nova"]]);
      const restaurou = chamadas.find((c) => c.tabela === "receitas" && c.metodo === "update");
      expect(restaurou?.args[0]).toEqual({ status: "Pendente", data_recebimento: null, conta_id: "conta-antiga" });
      expect(result.current.temDesfazer).toBe(false);
    });

    it("sem conta escolhida, a conciliação não mexe na conta do pendente", async () => {
      const result = setup();
      await act(async () => {
        await result.current.gravarLote(itens, { contaId: null, projetoId: null });
      });

      const conciliacao = chamadas.find((c) => c.tabela === "receitas" && c.metodo === "update");
      expect(conciliacao?.args[0]).toEqual({ status: "Recebido", data_recebimento: "2026-10-11" });
    });
  });
});
