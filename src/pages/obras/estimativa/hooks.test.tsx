import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";
import { CUB_FIXTURE, FICHA_SOBRADO, parametrosDaMigration, resultadoDoSobrado } from "@/test/estimativaFixtures";

// Hooks de dados da estimativa de obra: leitura com schema (jsonb inválido vira null),
// gravação, RLS que recusa em silêncio (zero linhas) e o agregado de insumos do motor.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));

import {
  useAjustesDaEmpresa,
  useAtualizarEstimativa,
  useCriarEstimativa,
  useEstimativa,
  useEstimativas,
  useExcluirEstimativa,
  useInsumosDaEstimativa,
  useLeadParaEstimar,
  useNomesDosUsuarios,
  useParametrosDoMotor,
  usePropostaParaEstimar,
  useSalvarAjusteEmpresa,
  useSalvarVersao,
  useVersoes,
} from "./hooks";

function hook<T>(fn: () => T) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidar = vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { invalidar, ...renderHook(fn, { wrapper }) };
}

const erro = (message: string) => ({ message });
type T = Record<string, { data: unknown; error: unknown } | undefined>;
function porTabela(t: T) {
  fake.responder((c) => t[`${c.tabela}:${c.op}`] ?? t[c.tabela]);
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  rpcComEmpresa();
});

describe("leituras de estimativa", () => {
  it("lista com lead, proposta e ficha/resultado válidos ou inválidos", async () => {
    const resultado = resultadoDoSobrado();
    porTabela({
      estimativas_obra: {
        data: [
          {
            id: "e-1",
            nome: "Sobrado",
            cliente_nome: "Ana",
            status: "rascunho",
            versao_atual: 2,
            ficha: FICHA_SOBRADO,
            resultado,
            updated_at: "2026-11-01",
            leads: { nome: "Ana", sobrenome: "Silva" },
            propostas: { titulo: "Proposta 1" },
          },
          {
            id: "e-2",
            nome: "Quebrada",
            cliente_nome: null,
            status: "enviada",
            versao_atual: 1,
            ficha: { lixo: true },
            resultado: "nada",
            updated_at: "2026-11-02",
            leads: null,
            propostas: null,
          },
        ],
        error: null,
      },
    });
    const { result } = hook(() => useEstimativas());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [a, b] = result.current.data!;
    expect(a).toMatchObject({ leadNome: "Ana Silva", propostaTitulo: "Proposta 1", versaoAtual: 2 });
    expect(a.ficha).not.toBeNull();
    expect(a.resultado).not.toBeNull();
    expect(b).toMatchObject({ leadNome: null, propostaTitulo: null, ficha: null, resultado: null });
  });

  it("erro na lista", async () => {
    porTabela({ estimativas_obra: { data: null, error: erro("x") } });
    const { result } = hook(() => useEstimativas());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("lead para estimar: empresa do lead tem prioridade sobre o nome", async () => {
    porTabela({
      leads: {
        data: { id: "l-1", nome: "Ana", sobrenome: null, empresa_lead: "Construtora X", cliente_id: "c-1" },
        error: null,
      },
    });
    const { result } = hook(() => useLeadParaEstimar("l-1"));
    await waitFor(() =>
      expect(result.current.data).toEqual({ id: "l-1", nomeCompleto: "Construtora X", clienteId: "c-1" })
    );
  });

  it("lead pessoa física, inexistente, erro e sem id", async () => {
    porTabela({
      leads: { data: { id: "l-2", nome: "Ana", sobrenome: "Lima", empresa_lead: null, cliente_id: null }, error: null },
    });
    const a = hook(() => useLeadParaEstimar("l-2"));
    await waitFor(() => expect(a.result.current.data?.nomeCompleto).toBe("Ana Lima"));

    porTabela({});
    const b = hook(() => useLeadParaEstimar("l-x"));
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
    expect(b.result.current.data).toBeNull();

    porTabela({ leads: { data: null, error: erro("RLS") } });
    const c = hook(() => useLeadParaEstimar("l-3"));
    await waitFor(() => expect(c.result.current.isError).toBe(true));

    const d = hook(() => useLeadParaEstimar(null));
    expect(d.result.current.fetchStatus).toBe("idle");
  });

  it("proposta para estimar: cliente, lead e sem nenhum", async () => {
    porTabela({
      propostas: {
        data: {
          id: "p-1",
          titulo: "Casa",
          area_m2: 200,
          lead_id: "l",
          cliente_id: "c",
          clientes: { nome: "Cliente SA" },
          leads: null,
        },
        error: null,
      },
    });
    const a = hook(() => usePropostaParaEstimar("p-1"));
    await waitFor(() =>
      expect(a.result.current.data).toEqual({
        id: "p-1",
        titulo: "Casa",
        nomeCliente: "Cliente SA",
        leadId: "l",
        clienteId: "c",
        areaM2: 200,
      })
    );

    porTabela({
      propostas: {
        data: {
          id: "p-2",
          titulo: "Galpão",
          area_m2: null,
          lead_id: "l",
          cliente_id: null,
          clientes: null,
          leads: { nome: "Bia", sobrenome: "Souza", empresa_lead: null },
        },
        error: null,
      },
    });
    const b = hook(() => usePropostaParaEstimar("p-2"));
    await waitFor(() => expect(b.result.current.data?.nomeCliente).toBe("Bia Souza"));

    porTabela({
      propostas: {
        data: { id: "p-3", titulo: "x", area_m2: null, lead_id: null, cliente_id: null, clientes: null, leads: null },
        error: null,
      },
    });
    const c = hook(() => usePropostaParaEstimar("p-3"));
    await waitFor(() => expect(c.result.current.data?.nomeCliente).toBe(""));

    porTabela({});
    const d = hook(() => usePropostaParaEstimar("p-x"));
    await waitFor(() => expect(d.result.current.isSuccess).toBe(true));
    expect(d.result.current.data).toBeNull();

    porTabela({ propostas: { data: null, error: erro("x") } });
    const e = hook(() => usePropostaParaEstimar("p-4"));
    await waitFor(() => expect(e.result.current.isError).toBe(true));
  });

  it("estimativa completa, inexistente e erro", async () => {
    porTabela({
      estimativas_obra: {
        data: {
          id: "e-1",
          nome: "Sobrado",
          cliente_nome: null,
          status: "virou_obra",
          versao_atual: 3,
          ficha: FICHA_SOBRADO,
          premissas: "inválida",
          resultado: null,
          obra_id: "o-1",
          created_at: "c",
          updated_at: "u",
        },
        error: null,
      },
    });
    const a = hook(() => useEstimativa("e-1"));
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    expect(a.result.current.data).toMatchObject({
      obraId: "o-1",
      premissas: {},
      resultado: null,
      status: "virou_obra",
    });

    porTabela({});
    const b = hook(() => useEstimativa("e-x"));
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
    expect(b.result.current.data).toBeNull();

    porTabela({ estimativas_obra: { data: null, error: erro("x") } });
    const c = hook(() => useEstimativa("e-2"));
    await waitFor(() => expect(c.result.current.isError).toBe(true));
  });

  it("versões, com resultado inválido virando null", async () => {
    porTabela({
      estimativa_obra_versoes: {
        data: [{ id: "v-1", versao: 2, nota: "ajuste", resultado: {}, parametros_validados: true, created_at: "c" }],
        error: null,
      },
    });
    const a = hook(() => useVersoes("e-1"));
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    expect(a.result.current.data).toEqual([
      { id: "v-1", versao: 2, nota: "ajuste", resultado: null, parametrosValidados: true, criadoEm: "c" },
    ]);

    porTabela({ estimativa_obra_versoes: { data: null, error: erro("x") } });
    const b = hook(() => useVersoes("e-2"));
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });

  it("nomes dos usuários: junta nome e sobrenome, cai em 'Usuário' e não busca sem ids", async () => {
    porTabela({
      profiles: {
        data: [
          { id: "u-1", first_name: "Ana", last_name: "Lima" },
          { id: "u-2", first_name: null, last_name: null },
        ],
        error: null,
      },
    });
    const a = hook(() => useNomesDosUsuarios(["u-2", "u-1", "u-1"]));
    await waitFor(() => expect(a.result.current.data).toEqual({ "u-1": "Ana Lima", "u-2": "Usuário" }));
    expect(fake.chamadas[0].filtros).toContainEqual(["in", "id", ["u-1", "u-2"]]);

    const b = hook(() => useNomesDosUsuarios([]));
    expect(b.result.current.fetchStatus).toBe("idle");

    porTabela({ profiles: { data: null, error: erro("x") } });
    const c = hook(() => useNomesDosUsuarios(["u-9"]));
    await waitFor(() => expect(c.result.current.isError).toBe(true));
  });
});

describe("escritas de estimativa", () => {
  it("criar grava com a empresa e devolve o id", async () => {
    porTabela({ "estimativas_obra:insert": { data: { id: "e-novo" }, error: null } });
    const { result, invalidar } = hook(() => useCriarEstimativa());
    let id: string | undefined;
    await act(async () => {
      id = await result.current.mutateAsync({
        nome: "Sobrado",
        clienteNome: null,
        leadId: "l-1",
        ficha: FICHA_SOBRADO,
        premissas: {},
        resultado: null,
      });
    });
    expect(id).toBe("e-novo");
    expect(fake.escritas("estimativas_obra")[0].payload).toMatchObject({
      empresa_id: "emp-1",
      lead_id: "l-1",
      proposta_id: null,
      cliente_id: null,
    });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["estimativas-obra"] });
  });

  it("criar sem empresa ou com erro do banco falha", async () => {
    const { result } = hook(() => useCriarEstimativa());
    const nova = { nome: "x", clienteNome: null, ficha: FICHA_SOBRADO, premissas: {}, resultado: null };
    fake.rpc.mockResolvedValueOnce({ data: null, error: null });
    await act(async () => {
      await expect(result.current.mutateAsync(nova)).rejects.toThrow("Usuário não vinculado a uma empresa");
    });
    porTabela({ "estimativas_obra:insert": { data: null, error: erro("RLS") } });
    await act(async () => {
      await expect(result.current.mutateAsync(nova)).rejects.toMatchObject({ message: "RLS" });
    });
  });

  it("atualizar manda só os campos alterados", async () => {
    porTabela({ "estimativas_obra:update": { data: [{ id: "e-1" }], error: null } });
    const { result, invalidar } = hook(() => useAtualizarEstimativa());
    await act(async () => {
      await result.current.mutateAsync({ id: "e-1", nome: "Novo", clienteNome: null });
    });
    expect(fake.escritas("estimativas_obra")[0].payload).toEqual({ nome: "Novo", cliente_nome: null });
    await act(async () => {
      await result.current.mutateAsync({ id: "e-1", ficha: FICHA_SOBRADO, premissas: {}, resultado: null });
    });
    expect(Object.keys(fake.escritas("estimativas_obra")[1].payload as object).sort()).toEqual([
      "ficha",
      "premissas",
      "resultado",
    ]);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["estimativas-obra", "e-1"] });
  });

  it("atualizar recusado pela RLS (zero linhas) vira erro claro", async () => {
    porTabela({ "estimativas_obra:update": { data: [], error: null } });
    const { result } = hook(() => useAtualizarEstimativa());
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "e-1", nome: "x" })).rejects.toThrow(
        "Não foi possível salvar a estimativa"
      );
    });
    porTabela({ "estimativas_obra:update": { data: null, error: erro("timeout") } });
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "e-1", nome: "x" })).rejects.toMatchObject({ message: "timeout" });
    });
  });

  it("excluir e erro ao excluir", async () => {
    const { result } = hook(() => useExcluirEstimativa());
    await act(async () => {
      await result.current.mutateAsync("e-1");
    });
    expect(fake.escritas("estimativas_obra")[0].op).toBe("delete");
    porTabela({ "estimativas_obra:delete": { data: null, error: erro("RLS") } });
    await act(async () => {
      await expect(result.current.mutateAsync("e-1")).rejects.toBeTruthy();
    });
  });

  it("salvar versão grava o snapshot com a flag de validação", async () => {
    const resultado = resultadoDoSobrado(true);
    const { result } = hook(() => useSalvarVersao());
    await act(async () => {
      await result.current.mutateAsync({
        estimativaId: "e-1",
        nota: null,
        ficha: FICHA_SOBRADO,
        premissas: {},
        resultado,
      });
    });
    expect(fake.escritas("estimativa_obra_versoes")[0].payload).toMatchObject({
      empresa_id: "emp-1",
      estimativa_id: "e-1",
      parametros_validados: true,
    });
    porTabela({ "estimativa_obra_versoes:insert": { data: null, error: erro("x") } });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ estimativaId: "e-1", nota: null, ficha: FICHA_SOBRADO, premissas: {}, resultado })
      ).rejects.toBeTruthy();
    });
  });
});

describe("parâmetros e ajustes da empresa", () => {
  it("parâmetros válidos e se foram validados", async () => {
    porTabela({
      estimativa_parametros: { data: { parametros: parametrosDaMigration(), validado_em: "2026-11-01" }, error: null },
    });
    const { result } = hook(() => useParametrosDoMotor());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.validado).toBe(true);
  });

  it("parâmetros fora do schema viram erro", async () => {
    porTabela({ estimativa_parametros: { data: { parametros: { ruim: 1 }, validado_em: null }, error: null } });
    const { result } = hook(() => useParametrosDoMotor());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/Parâmetros da estimativa/);
  });

  it("ajustes: inexistente é null, válido volta, inválido e erro falham", async () => {
    porTabela({});
    const a = hook(() => useAjustesDaEmpresa());
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    expect(a.result.current.data).toBeNull();

    porTabela({ estimativa_ajustes_empresa: { data: { adicionais: { piscina: { valor: 1 } } }, error: null } });
    const b = hook(() => useAjustesDaEmpresa());
    await waitFor(() => expect(b.result.current.data).toEqual({ adicionais: { piscina: { valor: 1 } } }));

    porTabela({ estimativa_ajustes_empresa: { data: { adicionais: "ruim" }, error: null } });
    const c = hook(() => useAjustesDaEmpresa());
    await waitFor(() => expect(c.result.current.isError).toBe(true));

    porTabela({ estimativa_ajustes_empresa: { data: null, error: erro("x") } });
    const d = hook(() => useAjustesDaEmpresa());
    await waitFor(() => expect(d.result.current.isError).toBe(true));
  });

  it("salvar ajuste mescla com o que está no banco; nulo remove o item", async () => {
    porTabela({
      "estimativa_ajustes_empresa:select": {
        data: { adicionais: { piscina: { valor: 1 }, gourmet: { valor: 2 } } },
        error: null,
      },
      "estimativa_ajustes_empresa:upsert": { data: [{ empresa_id: "emp-1" }], error: null },
    });
    const { result } = hook(() => useSalvarAjusteEmpresa());
    await act(async () => {
      await result.current.mutateAsync({ id: "piscina" as never, ajuste: { valor: 9 } });
      await result.current.mutateAsync({ id: "gourmet" as never, ajuste: null });
    });
    const [primeiro, segundo] = fake.escritas("estimativa_ajustes_empresa");
    expect(primeiro.payload).toEqual({
      empresa_id: "emp-1",
      adicionais: { piscina: { valor: 9 }, gourmet: { valor: 2 } },
    });
    expect(segundo.payload).toEqual({ empresa_id: "emp-1", adicionais: { piscina: { valor: 1 } } });
  });

  it("salvar ajuste sem permissão de admin (zero linhas) explica o motivo", async () => {
    porTabela({ "estimativa_ajustes_empresa:upsert": { data: [], error: null } });
    const { result } = hook(() => useSalvarAjusteEmpresa());
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "piscina" as never, ajuste: { valor: 1 } })).rejects.toThrow(
        "Só quem administra a empresa pode mudar a tabela de preços"
      );
    });
  });

  it("salvar ajuste: erro de leitura, tabela corrompida e erro do upsert", async () => {
    const { result } = hook(() => useSalvarAjusteEmpresa());
    porTabela({ "estimativa_ajustes_empresa:select": { data: null, error: erro("leitura") } });
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "a" as never, ajuste: null })).rejects.toMatchObject({
        message: "leitura",
      });
    });
    porTabela({ "estimativa_ajustes_empresa:select": { data: { adicionais: [1, 2] }, error: null } });
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "a" as never, ajuste: null })).rejects.toThrow();
    });
    porTabela({ "estimativa_ajustes_empresa:upsert": { data: null, error: erro("upsert") } });
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "a" as never, ajuste: null })).rejects.toMatchObject({
        message: "upsert",
      });
    });
    expect(fake.escritas()).toHaveLength(1);
  });
});

describe("useInsumosDaEstimativa", () => {
  const ok = {
    cub_valores: { data: CUB_FIXTURE, error: null },
    estimativa_parametros: { data: { parametros: parametrosDaMigration(), validado_em: null }, error: null },
    estimativa_ajustes_empresa: { data: null, error: null },
    sinapi_precos_insumo: { data: [], error: null },
  };

  it("carregando e depois pronto com tudo", async () => {
    porTabela(ok);
    const { result } = hook(() => useInsumosDaEstimativa());
    expect(result.current.estado).toBe("carregando");
    await waitFor(() => expect(result.current.estado).toBe("ok"));
    expect(result.current).toMatchObject({ ajustes: null, precosSinapi: [], validado: false });
  });

  it.each([
    ["CUB", { cub_valores: { data: null, error: erro("cub fora") } }, "cub fora"],
    ["CUB inválido", { cub_valores: { data: [{ uf: "ZZ" }], error: null } }, "Linhas do CUB"],
    ["SINAPI", { sinapi_precos_insumo: { data: null, error: erro("sinapi fora") } }, "sinapi fora"],
    ["SINAPI inválido", { sinapi_precos_insumo: { data: [{ codigo: 1 }], error: null } }, "Preços do SINAPI"],
  ])("erro em %s vira um erro só, com a causa", async (_n, quebra, msg) => {
    porTabela({ ...ok, ...quebra });
    const { result } = hook(() => useInsumosDaEstimativa());
    await waitFor(() => expect(result.current.estado).toBe("erro"));
    expect((result.current as { mensagem: string }).mensagem).toContain(msg);
  });
});
