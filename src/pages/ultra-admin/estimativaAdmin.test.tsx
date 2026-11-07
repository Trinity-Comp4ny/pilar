import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createSupabaseFrom, type ChainQuery, type ChainResult } from "@/test/supabaseChain";
import { parametrosDaMigration } from "@/test/estimativaFixtures";
import type { LinhaCubLida } from "./estimativaCubImport";
import type { LinhaSinapiLida } from "./estimativaSinapiImport";

// Estimativa no ultra admin (SPEC 136/137): gravação em lotes que detecta recusa silenciosa
// da RLS (menos linhas de volta), leitura de arquivo por extensão/tamanho e validação do
// que vem do banco (regime/UF desconhecido falha claro, parâmetros fora do schema também).

const h = vi.hoisted(() => ({
  resolve: (() => ({ data: [] })) as (q: ChainQuery) => ChainResult | Promise<ChainResult>,
}));
const chain = vi.hoisted(() => ({ from: null as unknown as ReturnType<typeof createSupabaseFrom> }));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  chain.from = createSupabaseFrom((q) => h.resolve(q));
  return { supabase: { from: chain.from.from } };
});

const xlsx = vi.hoisted(() => ({
  read: vi.fn(),
  utils: { sheet_to_json: vi.fn() },
}));
vi.mock("xlsx", () => xlsx);

import {
  gravarCub,
  gravarSinapi,
  lerAbasSinapi,
  lerCelulas,
  useCubGravado,
  useParametrosEstimativa,
  useSinapiGravado,
  validarParametros,
} from "./estimativaAdmin";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/** Ecoa um id por linha enviada: o banco aceitou tudo. */
const aceitaTudo = (q: ChainQuery): ChainResult => ({
  data: Array.isArray(q.payload) ? (q.payload as unknown[]).map((_, i) => ({ id: i })) : [],
});

function arquivo(nome: string, conteudo = "x", tamanho?: number): File {
  const f = new File([conteudo], nome);
  if (tamanho !== undefined) Object.defineProperty(f, "size", { value: tamanho });
  return f;
}

const cub = (i: number): LinhaCubLida => ({
  linha: i,
  uf: "SP",
  subtipo: "R1",
  padrao: "normal",
  valor_m2: 2500 + i,
  mes_base: "2026-09-01",
  regime: "desonerado",
});

beforeEach(() => {
  vi.clearAllMocks();
  h.resolve = aceitaTudo;
  chain.from.calls.length = 0;
});

describe("gravarCub", () => {
  it("divide em lotes de 500 e grava a fonte, sem o número da linha", async () => {
    const linhas = Array.from({ length: 1001 }, (_, i) => cub(i + 1));
    await gravarCub(linhas, "Sinduscon-SP");
    const ups = chain.from.calls.filter((c) => c.op === "upsert");
    expect(ups.map((u) => (u.payload as unknown[]).length)).toEqual([500, 500, 1]);
    const primeira = (ups[0].payload as Record<string, unknown>[])[0];
    expect(primeira).toEqual({
      uf: "SP",
      subtipo: "R1",
      padrao: "normal",
      mes_base: "2026-09-01",
      regime: "desonerado",
      valor_m2: 2501,
      fonte: "Sinduscon-SP",
    });
    expect(primeira).not.toHaveProperty("linha");
  });

  it("lista vazia não chama o banco", async () => {
    await gravarCub([], "x");
    expect(chain.from.from).not.toHaveBeenCalled();
  });

  it("RLS recusando em silêncio (menos linhas) vira erro e para os lotes seguintes", async () => {
    h.resolve = (q) => ({ data: (q.payload as unknown[]).slice(1) });
    await expect(
      gravarCub(
        Array.from({ length: 600 }, (_, i) => cub(i)),
        "f"
      )
    ).rejects.toThrow(/não aceitou todas as linhas/);
    expect(chain.from.calls).toHaveLength(1);
  });

  it("resposta sem data também conta como recusa", async () => {
    h.resolve = () => ({ data: null });
    await expect(gravarCub([cub(1)], "f")).rejects.toThrow(/segundo fator/);
  });

  it("erro do banco propaga", async () => {
    h.resolve = () => ({ error: new Error("constraint") });
    await expect(gravarCub([cub(1)], "f")).rejects.toThrow("constraint");
  });
});

describe("gravarSinapi", () => {
  const sinapi = (i: number) =>
    ({
      codigo: String(i),
      uf: "SP",
      regime: "onerado",
      mes_base: "2026-09-01",
      preco: 10,
    }) as unknown as LinhaSinapiLida;

  it("grava com a fonte e upsert por código/UF/regime/mês", async () => {
    await gravarSinapi([sinapi(1), sinapi(2)], "SINAPI 09/2026");
    const up = chain.from.calls[0];
    expect(up.table).toBe("sinapi_precos_insumo");
    expect((up.payload as Record<string, unknown>[])[1]).toMatchObject({ codigo: "2", fonte: "SINAPI 09/2026" });
  });

  it("recusa parcial e erro do banco viram erro", async () => {
    h.resolve = () => ({ data: [] });
    await expect(gravarSinapi([sinapi(1)], "f")).rejects.toThrow(/não aceitou/);
    h.resolve = () => ({ error: new Error("rls") });
    await expect(gravarSinapi([sinapi(1)], "f")).rejects.toThrow("rls");
  });
});

describe("lerCelulas", () => {
  it("arquivo acima de 5 MB é recusado antes de ler", async () => {
    await expect(lerCelulas(arquivo("cub.csv", "a", 5_000_001))).rejects.toThrow(/5 MB/);
  });

  it("extensão desconhecida é recusada", async () => {
    await expect(lerCelulas(arquivo("cub.pdf"))).rejects.toThrow(/Formato não suportado/);
    await expect(lerCelulas(arquivo("semextensao"))).rejects.toThrow(/Formato não suportado/);
  });

  it("CSV e TXT passam pelo leitor de CSV (com BOM e ;)", async () => {
    const r = await lerCelulas(arquivo("cub.CSV", "﻿UF;Valor\nSP;2500,10\n"));
    expect(r[0]).toEqual(["UF", "Valor"]);
    expect(r[1]).toEqual(["SP", "2500,10"]);
    const t = await lerCelulas(arquivo("cub.txt", "a\tb\n"));
    expect(t[0]).toEqual(["a", "b"]);
  });

  it("Excel: lê a primeira aba e arredonda número para 2 casas", async () => {
    xlsx.read.mockReturnValue({ SheetNames: ["CUB"], Sheets: { CUB: {} } });
    xlsx.utils.sheet_to_json.mockReturnValue([
      ["SP", 3350.4999999, null],
      [1, "R1", ""],
    ]);
    const r = await lerCelulas(arquivo("cub.xlsx"));
    expect(r).toEqual([
      ["SP", "3350.5", ""],
      ["1", "R1", ""],
    ]);
    expect(xlsx.utils.sheet_to_json).toHaveBeenCalledWith({}, { header: 1, raw: true, defval: "" });
  });

  it("Excel sem abas falha claro", async () => {
    xlsx.read.mockReturnValue({ SheetNames: [], Sheets: {} });
    await expect(lerCelulas(arquivo("cub.xls"))).rejects.toThrow(/não tem abas/);
  });
});

describe("lerAbasSinapi", () => {
  it("acima de 30 MB e formato diferente de xlsx são recusados", async () => {
    await expect(lerAbasSinapi(arquivo("s.xlsx", "x", 30_000_001))).rejects.toThrow(/30 MB/);
    await expect(lerAbasSinapi(arquivo("s.zip"))).rejects.toThrow(/Formato não suportado/);
    expect(xlsx.read).not.toHaveBeenCalled();
  });

  it("lê só ISD e ICD, ignorando aba ausente", async () => {
    xlsx.read.mockReturnValue({ Sheets: { ISD: { a: 1 } } });
    xlsx.utils.sheet_to_json.mockReturnValue([["codigo"]]);
    const abas = await lerAbasSinapi(arquivo("SINAPI_Referencia.XLSX"));
    expect(abas).toEqual([{ nome: "ISD", celulas: [["codigo"]] }]);
    expect(xlsx.read.mock.calls[0][1]).toMatchObject({ sheets: ["ISD", "ICD"] });
  });
});

describe("validarParametros", () => {
  it("validar grava a data; desfazer limpa data e autor", async () => {
    h.resolve = () => ({ data: { id: "default" } });
    await validarParametros(true);
    const v = chain.from.calls[0];
    expect((v.payload as Record<string, unknown>).validado_em).toEqual(expect.any(String));
    expect(v.payload).not.toHaveProperty("validado_por");
    expect(v.filters).toContainEqual(["eq", "id", "default"]);

    await validarParametros(false);
    expect(chain.from.calls[1].payload).toEqual({ validado_em: null, validado_por: null });
  });

  it("nenhuma linha atualizada (RLS) vira erro; erro do banco propaga", async () => {
    h.resolve = () => ({ data: null });
    await expect(validarParametros(true)).rejects.toThrow(/não aceitou a alteração/);
    h.resolve = () => ({ error: new Error("x") });
    await expect(validarParametros(true)).rejects.toThrow("x");
  });
});

describe("leituras", () => {
  it("useCubGravado aceita regimes conhecidos", async () => {
    h.resolve = () => ({
      data: [{ uf: "SP", subtipo: "R1", padrao: "normal", mes_base: "m", regime: "onerado", created_at: "c" }],
    });
    const { result } = renderHook(() => useCubGravado(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("useCubGravado falha com regime desconhecido", async () => {
    h.resolve = () => ({ data: [{ uf: "SP", regime: "misto" }] });
    const { result } = renderHook(() => useCubGravado(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("Regime de CUB desconhecido: misto");
  });

  it("useCubGravado propaga erro do banco e trata data nula", async () => {
    h.resolve = () => ({ data: null });
    const a = renderHook(() => useCubGravado(), { wrapper });
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    expect(a.result.current.data).toEqual([]);
    h.resolve = () => ({ error: new Error("rls") });
    const b = renderHook(() => useCubGravado(), { wrapper });
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });

  it("useSinapiGravado recusa regime e UF fora do contrato", async () => {
    h.resolve = () => ({ data: [{ codigo: "1", uf: "SP", regime: "onerado", mes_base: "m", created_at: "c" }] });
    const ok = renderHook(() => useSinapiGravado(), { wrapper });
    await waitFor(() => expect(ok.result.current.isSuccess).toBe(true));

    h.resolve = () => ({ data: [{ codigo: "1", uf: "XX", regime: "onerado" }] });
    const uf = renderHook(() => useSinapiGravado(), { wrapper });
    await waitFor(() => expect(uf.result.current.isError).toBe(true));
    expect((uf.result.current.error as Error).message).toBe("UF do SINAPI desconhecida: XX");

    h.resolve = () => ({ data: [{ codigo: "1", uf: "SP", regime: "x" }] });
    const reg = renderHook(() => useSinapiGravado(), { wrapper });
    await waitFor(() => expect(reg.result.current.isError).toBe(true));
    expect((reg.result.current.error as Error).message).toBe("Regime do SINAPI desconhecido: x");

    h.resolve = () => ({ error: new Error("rls") });
    const erro = renderHook(() => useSinapiGravado(), { wrapper });
    await waitFor(() => expect(erro.result.current.isError).toBe(true));
  });

  it("useParametrosEstimativa devolve parâmetros válidos com datas", async () => {
    h.resolve = () => ({ data: { parametros: parametrosDaMigration(), validado_em: null, updated_at: "u" } });
    const { result } = renderHook(() => useParametrosEstimativa(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ validadoEm: null, atualizadoEm: "u" });
    expect(result.current.data!.parametros).toEqual(parametrosDaMigration());
  });

  it("useParametrosEstimativa falha com parâmetros fora do schema ou erro do banco", async () => {
    h.resolve = () => ({ data: { parametros: { lixo: true }, validado_em: null, updated_at: "u" } });
    const a = renderHook(() => useParametrosEstimativa(), { wrapper });
    await waitFor(() => expect(a.result.current.isError).toBe(true));
    expect((a.result.current.error as Error).message).toMatch(/Parâmetros da estimativa/);

    h.resolve = () => ({ error: new Error("sem linha") });
    const b = renderHook(() => useParametrosEstimativa(), { wrapper });
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });
});
