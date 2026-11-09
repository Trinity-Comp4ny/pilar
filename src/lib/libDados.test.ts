import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseFrom, findCall, type ChainQuery, type ChainResult } from "@/test/supabaseChain";

const h = vi.hoisted(() => ({
  resolver: (() => ({})) as (q: ChainQuery) => ChainResult,
  rpc: vi.fn(),
  invoke: vi.fn(),
  capture: vi.fn(),
  sb: null as unknown as ReturnType<typeof createSupabaseFrom>,
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom: criar } = await import("@/test/supabaseChain");
  h.sb = criar((q) => h.resolver(q));
  return { supabase: { from: h.sb.from, rpc: h.rpc, functions: { invoke: h.invoke } } };
});
vi.mock("./monitoring", () => ({ monitoring: { captureException: h.capture } }));

import { detectTipoChavePix, normalizarChavePix, TIPO_CHAVE_PIX_LABEL } from "./pixUtils";
import { isValidCEP, isValidCNPJ, lookupCEP, lookupCNPJ } from "./brasilApi";
import { checkDuplicates } from "./duplicateCheck";
import { restaurar, softDelete, softDeleteGrupo } from "./softDelete";
import { reportError } from "./reportError";
import { fetchClientesLookup, fetchLeadsLookup, fetchPessoasLookup, fetchProjetosLookup } from "./supabaseQueries";
import {
  addBusinessDays,
  formatDateLocal,
  gerarDatasParcelasDiaFixo,
  getFeriadosBR,
  isBusinessDay,
  isFeriado,
  nextBusinessDay,
  parseDateLocal,
} from "./businessDays";

beforeEach(() => {
  vi.clearAllMocks();
  h.sb.calls.length = 0;
  h.resolver = () => ({});
  h.rpc.mockResolvedValue({ error: null });
});

describe("pixUtils", () => {
  it("detecta o tipo da chave", () => {
    expect(detectTipoChavePix("  ")).toBeNull();
    expect(detectTipoChavePix("+5511987654321")).toBe("telefone");
    expect(detectTipoChavePix("ana@seed.test")).toBe("email");
    expect(detectTipoChavePix("ana@seed")).toBeNull();
    expect(detectTipoChavePix("123e4567-e89b-12d3-a456-426614174000")).toBe("aleatoria");
    expect(detectTipoChavePix("529.982.247-25")).toBe("cpf_cnpj");
    expect(detectTipoChavePix("11987654321")).toBe("telefone");
    // 11 dígitos sem ser CPF nem celular: assume CPF (o validador do campo reclama)
    expect(detectTipoChavePix("11187654321")).toBe("cpf_cnpj");
    expect(detectTipoChavePix("11111111111")).toBe("cpf_cnpj");
    expect(detectTipoChavePix("11.222.333/0001-81")).toBe("cpf_cnpj");
    expect(detectTipoChavePix("11222333000180")).toBeNull();
    expect(detectTipoChavePix("11111111111111")).toBeNull();
    expect(detectTipoChavePix("1234567890")).toBeNull();
  });

  it("CPF com dígito verificador errado e sem cara de celular cai em CPF/CNPJ", () => {
    expect(detectTipoChavePix("12345678919")).toBe("cpf_cnpj");
    expect(detectTipoChavePix("12345678900")).toBe("cpf_cnpj");
  });

  it("normaliza telefone para E.164 e não mexe nos outros tipos", () => {
    expect(normalizarChavePix("ana@seed.test", "email")).toBe("ana@seed.test");
    expect(normalizarChavePix("+5511987654321", "telefone")).toBe("+5511987654321");
    expect(normalizarChavePix("5511987654321", "telefone")).toBe("+5511987654321");
    expect(normalizarChavePix("(11) 98765-4321", "telefone")).toBe("+5511987654321");
    expect(TIPO_CHAVE_PIX_LABEL.aleatoria).toBe("Aleatória");
  });
});

describe("brasilApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("valida CEP e CNPJ", () => {
    expect(isValidCEP("01310-100")).toBe(true);
    expect(isValidCEP("0131")).toBe(false);
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11.222.333/0001-82")).toBe(false);
    expect(isValidCNPJ("00000000000000")).toBe(false);
    expect(isValidCNPJ("123")).toBe(false);
  });

  it("lookupCEP usa a edge function e trata ausência e erro", async () => {
    expect(await lookupCEP("123")).toBeNull();
    expect(h.invoke).not.toHaveBeenCalled();

    h.invoke.mockResolvedValueOnce({
      data: {
        found: true,
        cep: "01310100",
        street: "Av. Paulista",
        neighborhood: "Bela Vista",
        city: "SP",
        state: "SP",
      },
      error: null,
    });
    expect(await lookupCEP("01310-100")).toEqual({
      cep: "01310100",
      street: "Av. Paulista",
      neighborhood: "Bela Vista",
      city: "SP",
      state: "SP",
    });
    expect(h.invoke).toHaveBeenCalledWith("lookup-cep", { body: { cep: "01310100" } });

    h.invoke.mockResolvedValueOnce({ data: { found: false }, error: null });
    expect(await lookupCEP("01310100")).toBeNull();
    h.invoke.mockResolvedValueOnce({ data: null, error: new Error("x") });
    expect(await lookupCEP("01310100")).toBeNull();
    h.invoke.mockRejectedValueOnce(new Error("rede"));
    expect(await lookupCEP("01310100")).toBeNull();
  });

  it("lookupCNPJ mapeia a resposta e cai em nulo nos erros", async () => {
    expect(await lookupCNPJ("123")).toBeNull();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ razao_social: "Seed Engenharia" }) });
    expect(await lookupCNPJ("11.222.333/0001-81")).toEqual({
      cnpj: "11222333000181",
      razao_social: "Seed Engenharia",
      nome_fantasia: "",
      email: null,
      telefone: null,
      logradouro: "",
      numero: "",
      bairro: "",
      municipio: "",
      uf: "",
      cep: "",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://brasilapi.com.br/api/cnpj/v1/11222333000181");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        cnpj: "11222333000181",
        razao_social: "Seed",
        nome_fantasia: "Seed",
        email: "a@b.c",
        ddd_telefone_1: "1133334444",
        logradouro: "Rua",
        numero: "1",
        bairro: "B",
        municipio: "M",
        uf: "SP",
        cep: "01310100",
      }),
    });
    expect(await lookupCNPJ("11222333000181")).toMatchObject({ telefone: "1133334444", uf: "SP" });

    fetchMock.mockResolvedValueOnce({ ok: false });
    expect(await lookupCNPJ("11222333000181")).toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    expect(await lookupCNPJ("11222333000181")).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error("rede"));
    expect(await lookupCNPJ("11222333000181")).toBeNull();
  });
});

describe("checkDuplicates", () => {
  it("filtra por janela de data e valor e compara descrição sem sufixo de parcela", async () => {
    h.resolver = () => ({
      data: [
        { id: "1", descricao: "Aluguel (2/12)", valor: 1000 },
        { id: "2", descricao: "ALUGUEL", valor: 1005 },
        { id: "3", descricao: "Luz", valor: 1000 },
      ],
    });
    const r = await checkDuplicates({
      table: "despesas",
      descricao: "Aluguel (1/12)",
      valor: 1000,
      dataVencimento: new Date(2026, 10, 10),
      excludeId: "9",
    });
    expect(r.map((x) => x.id)).toEqual(["1", "2"]);
    const q = findCall(h.sb.calls, "despesas")!;
    expect(q.filters).toContainEqual(["gte", "data_vencimento", "2026-11-05"]);
    expect(q.filters).toContainEqual(["lte", "data_vencimento", "2026-11-15"]);
    expect(q.filters).toContainEqual(["gte", "valor", 990]);
    expect(q.filters).toContainEqual(["neq", "id", "9"]);
  });

  it("erro ou sem dados devolve lista vazia", async () => {
    h.resolver = () => ({ error: { message: "x" } });
    const base = { table: "receitas" as const, descricao: "a", valor: 1, dataVencimento: new Date() };
    expect(await checkDuplicates(base)).toEqual([]);
    expect(findCall(h.sb.calls, "receitas")!.filters.some((f) => f[0] === "neq")).toBe(false);
  });
});

describe("softDelete", () => {
  it("tabelas da allowlist usam as RPCs", async () => {
    await softDelete("clientes", "c1");
    expect(h.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "clientes", p_id: "c1" });
    await softDeleteGrupo("receitas", "g1");
    expect(h.rpc).toHaveBeenCalledWith("rpc_soft_delete_grupo", { p_tabela: "receitas", p_grupo: "g1" });
    h.rpc.mockResolvedValueOnce({ error: { message: "negado" } });
    expect(await restaurar("despesas", "d1")).toEqual({ message: "negado" });
    expect(h.sb.from).not.toHaveBeenCalled();
  });

  it("outras tabelas fazem UPDATE direto de deleted_at", async () => {
    h.resolver = (q) => (q.filters.some((f) => f[2] === "falha") ? { error: { message: "rls" } } : {});
    expect(await softDelete("leads", "l1")).toBeNull();
    const del = h.sb.calls[0];
    expect(del).toMatchObject({ table: "leads", op: "update" });
    expect((del.payload as { deleted_at: string }).deleted_at).toMatch(/^\d{4}-/);

    expect(await softDeleteGrupo("transferencias", "falha")).toEqual({ message: "rls" });
    expect(h.sb.calls[1].filters).toEqual([
      ["eq", "grupo_parcela", "falha"],
      ["is", "deleted_at", null],
    ]);

    await restaurar("propostas", "p1");
    expect(h.sb.calls[2].payload).toEqual({ deleted_at: null });
  });
});

describe("reportError", () => {
  it("captura com contexto e traduz RLS para mensagem de permissão", () => {
    h.capture.mockReturnValue("evt-9");
    expect(
      reportError({ code: "42501", message: "new row violates" }, { context: "x:criar", extra: { a: 1 } })
    ).toEqual({
      message: "Você não tem permissão para esta ação nesta empresa.",
      eventId: "evt-9",
    });
    expect(h.capture).toHaveBeenCalledWith(
      { code: "42501", message: "new row violates" },
      { context: "x:criar", a: 1 }
    );
    expect(reportError({ code: "PGRST301" }, { context: "y" }).message).toMatch(/permissão/);
  });

  it("outros erros usam a mensagem segura ou o fallback", () => {
    h.capture.mockReturnValue(undefined);
    const r = reportError(null, { context: "z", fallback: "Tente de novo." });
    expect(r).toEqual({ message: "Tente de novo.", eventId: undefined });
  });
});

describe("supabaseQueries", () => {
  it("lookups ignoram removidos e ordenam por nome", async () => {
    h.resolver = (q) => ({ data: [{ id: q.table, nome: "x" }] });
    expect(await fetchClientesLookup()).toEqual([{ id: "clientes", nome: "x" }]);
    expect(await fetchPessoasLookup()).toEqual([{ id: "pessoas", nome: "x" }]);
    expect(await fetchLeadsLookup()).toEqual([{ id: "leads", nome: "x" }]);
    expect(await fetchProjetosLookup()).toEqual([{ id: "projetos", nome: "x" }]);
    expect(findCall(h.sb.calls, "projetos")?.columns).toBe("id, nome, codigo_projeto");
    for (const c of h.sb.calls)
      expect(c.filters).toEqual([
        ["is", "deleted_at", null],
        ["order", "nome"],
      ]);
  });

  it("sem dados devolve lista vazia", async () => {
    h.resolver = () => ({ data: null });
    expect(await fetchClientesLookup()).toEqual([]);
    expect(await fetchPessoasLookup()).toEqual([]);
    expect(await fetchLeadsLookup()).toEqual([]);
    expect(await fetchProjetosLookup()).toEqual([]);
  });
});

describe("businessDays", () => {
  it("feriados nacionais fixos e móveis (2026: Páscoa em 5/4)", () => {
    const f = getFeriadosBR(2026).map(formatDateLocal);
    expect(f).toContain("2026-02-16"); // Carnaval segunda
    expect(f).toContain("2026-04-03"); // Sexta-feira Santa
    expect(f).toContain("2026-06-04"); // Corpus Christi
    expect(getFeriadosBR(2026)).toBe(getFeriadosBR(2026)); // cache
    expect(isFeriado(new Date(2026, 11, 25))).toBe(true);
    expect(isBusinessDay(new Date(2026, 10, 14))).toBe(false); // sábado
  });

  it("soma dias úteis e acha o próximo dia útil", () => {
    // sexta 13/11/2026 + 1 útil: pula fim de semana e feriado de 15/11 (domingo) → segunda 16
    expect(formatDateLocal(addBusinessDays(new Date(2026, 10, 13), 1))).toBe("2026-11-16");
    expect(formatDateLocal(nextBusinessDay(new Date(2026, 3, 3)))).toBe("2026-04-06");
    expect(formatDateLocal(nextBusinessDay(new Date(2026, 3, 6)))).toBe("2026-04-06");
    expect(formatDateLocal(parseDateLocal("2026-01-02"))).toBe("2026-01-02");
  });

  it("parcelas em dia fixo pulam fim de semana e respeitam o fim do mês", () => {
    const datas = gerarDatasParcelasDiaFixo(3, 31, new Date(2026, 0, 10)).map(formatDateLocal);
    // 31/01 é sábado → 02/02; fevereiro tem 28 dias (sábado) → 02/03; 31/03 terça
    expect(datas).toEqual(["2026-02-02", "2026-03-02", "2026-03-31"]);
    // hoje depois do dia fixo: começa no mês seguinte, virando o ano
    expect(gerarDatasParcelasDiaFixo(1, 5, new Date(2026, 11, 20)).map(formatDateLocal)).toEqual(["2027-01-05"]);
    expect(() => gerarDatasParcelasDiaFixo(1, 0)).toThrow(/entre 1 e 31/);
    expect(() => gerarDatasParcelasDiaFixo(1, 32)).toThrow();
  });
});
