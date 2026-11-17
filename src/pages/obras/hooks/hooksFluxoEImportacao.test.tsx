import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";
import type { EstruturaFluxo } from "@/pages/obras/lib/fluxoObra";

// Hooks novos da obra contra o Supabase falso: fluxos, sincronização com obras e projetos,
// importação do cronograma, fornecedores e o orçado do portal.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const projetosMock = vi.hoisted(() => ({ aplicarPlanoFluxoNoProjeto: vi.fn() }));
vi.mock("@/hooks/useProjetoDisciplinas", () => ({
  aplicarPlanoFluxoNoProjeto: (...a: unknown[]) => projetosMock.aplicarPlanoFluxoNoProjeto(...a),
}));
const portal = vi.hoisted(() => ({ token: "tok" as string | null, rpc: vi.fn() }));
vi.mock("@/hooks/useClienteAuth", () => ({ getPortalToken: () => portal.token }));
vi.mock("@/lib/supabaseRpc", () => ({ callUntypedRpc: (...a: unknown[]) => portal.rpc(...a) }));

import { useExcluirFluxoObra, useFluxosObra, useSalvarFluxoObra } from "./useFluxosObra";
import { useFornecedoresLite } from "./useFornecedoresLite";
import { gravarPlanoDoCronograma, useImportarCronograma } from "./useImportarCronograma";
import {
  useAplicarSincronizacoesObra,
  useSincronizacoesDoFluxoObra,
  vincularObraAoFluxo,
} from "./useSincronizarFluxoObra";
import {
  useAplicarSincronizacoesProjetos,
  useSincronizacoesDoFluxoProjetos,
  vincularProjetoAoFluxo,
} from "@/pages/projetos/hooks/useSincronizarFluxoProjetos";
import { useClienteObraOrcamento } from "@/pages/portal/useClienteObraOrcamento";

function hook<T>(fn: () => T) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidar = vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { invalidar, ...renderHook(fn, { wrapper }) };
}

const estrutura: EstruturaFluxo = [
  {
    nome: "Fundação",
    etapas: [
      {
        nome: "Escavação",
        servicos: [
          { nome: "Locação", duracao_dias: 3, fornecedor_id: "f-1", paralelo: false, tarefas: ["Marcar eixos"] },
        ],
      },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  rpcComEmpresa();
  portal.token = "tok";
});

describe("useFluxosObra", () => {
  it("lista os fluxos e normaliza a estrutura", async () => {
    fake.responder((c) =>
      c.tabela === "fluxos_obra"
        ? { data: [{ id: "x-1", nome: "Casa", descricao: null, estrutura }], error: null }
        : undefined
    );
    const { result } = hook(() => useFluxosObra());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({ id: "x-1", nome: "Casa" });
    expect(result.current.data?.[0].estrutura[0].etapas[0].servicos[0].nome).toBe("Locação");
  });

  it("erro de leitura vira erro da query", async () => {
    fake.responder(() => ({ data: null, error: { message: "RLS" } }));
    const { result } = hook(() => useFluxosObra());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("cria, edita e exclui (soft delete)", async () => {
    fake.responder((c) => (c.op === "insert" ? { data: { id: "novo" }, error: null } : undefined));
    const { result, invalidar } = hook(() => ({ s: useSalvarFluxoObra(), e: useExcluirFluxoObra() }));
    let id = "";
    await act(async () => {
      id = await result.current.s.mutateAsync({ nome: "  Casa  ", descricao: "  ", estrutura });
      await result.current.s.mutateAsync({ id: "x-1", nome: "Casa 2", estrutura });
      await result.current.e.mutateAsync("x-1");
    });
    expect(id).toBe("novo");
    const escritas = fake.escritas("fluxos_obra");
    expect(escritas.map((e) => e.op)).toEqual(["insert", "update", "update"]);
    expect(escritas[0].payload).toMatchObject({ nome: "Casa", descricao: null, empresa_id: "emp-1" });
    expect(escritas[2].payload).toHaveProperty("deleted_at");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["fluxos-obra"] });
  });

  it("recusa criar sem empresa e propaga erro do banco", async () => {
    const { result } = hook(() => useSalvarFluxoObra());
    fake.rpc.mockResolvedValueOnce({ data: null, error: null });
    await act(async () => {
      await expect(result.current.mutateAsync({ nome: "x", estrutura })).rejects.toThrow("Usuário não vinculado");
    });
    fake.responder(() => ({ data: null, error: { message: "RLS" } }));
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "x-1", nome: "x", estrutura })).rejects.toBeTruthy();
    });
  });
});

describe("useFornecedoresLite", () => {
  it("devolve id e nome e propaga erro", async () => {
    fake.responder(() => ({ data: [{ id: "f-1", nome: "Silva" }], error: null }));
    const { result } = hook(() => useFornecedoresLite());
    await waitFor(() => expect(result.current.data).toEqual([{ id: "f-1", nome: "Silva" }]));
    fake.responder(() => ({ data: null, error: { message: "x" } }));
    const outro = hook(() => useFornecedoresLite());
    await waitFor(() => expect(outro.result.current.isError).toBe(true));
  });
});

describe("importar cronograma", () => {
  const plano = {
    itens: [
      {
        chave: "f",
        nome: "Fundação",
        nivel: "fase" as const,
        paiChave: null,
        inicio: "2026-11-01",
        fim: "2026-11-10",
        fornecedorId: null,
      },
      {
        chave: "e",
        nome: "Escavação",
        nivel: "etapa" as const,
        paiChave: "f",
        inicio: "2026-11-01",
        fim: "2026-11-05",
        fornecedorId: null,
      },
      {
        chave: "s",
        nome: "Locação",
        nivel: "servico" as const,
        paiChave: "e",
        inicio: "2026-11-01",
        fim: "2026-11-03",
        fornecedorId: "f-1",
      },
    ],
    tarefas: [{ servicoChave: "s", titulo: "Marcar eixos", inicio: "2026-11-01", prazo: "2026-11-02" }],
    avisos: [] as string[],
    erro: null,
  };

  it("grava nível por nível, com o pai apontado e a ordem depois das fases que já existem", async () => {
    const r = await gravarPlanoDoCronograma("o-1", "p-1", 2, plano);
    expect(r).toEqual({ nos: 3, tarefas: 1 });
    const frentes = fake.escritas("obra_frente");
    expect(frentes).toHaveLength(3);
    const fase = (frentes[0].payload as Array<Record<string, unknown>>)[0];
    const etapa = (frentes[1].payload as Array<Record<string, unknown>>)[0];
    expect(fase.ordem).toBe(2);
    expect(etapa.parent_id).toBe(fase.id);
    expect((frentes[2].payload as Array<Record<string, unknown>>)[0].fornecedor_id).toBe("f-1");
    expect(fake.escritas("tarefas")[0].payload).toMatchObject([{ titulo: "Marcar eixos", projeto_id: "p-1" }]);
  });

  it("recusa sem empresa e para no primeiro erro de lote", async () => {
    fake.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(gravarPlanoDoCronograma("o-1", null, 0, plano)).rejects.toThrow("Usuário não vinculado");
    fake.responder(() => ({ data: null, error: { message: "RLS negou" } }));
    await expect(gravarPlanoDoCronograma("o-1", null, 0, plano)).rejects.toThrow("RLS negou");
  });

  it("o hook invalida frentes e tarefas", async () => {
    const { result, invalidar } = hook(() => useImportarCronograma("o-1", null, 0));
    await act(async () => {
      await result.current.mutateAsync(plano);
    });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["obra_frente", "o-1"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["tarefas"] });
  });
});

describe("sincronizar obras com o fluxo", () => {
  const obra = { id: "o-1", nome: "Casa Azul", projeto_id: "p-1", data_inicio_prevista: "2026-11-01" };

  it("vincula a obra ao fluxo (e propaga erro)", async () => {
    await vincularObraAoFluxo("o-1", "x-1");
    expect(fake.escritas("obras")[0].payload).toEqual({ fluxo_obra_id: "x-1" });
    fake.responder(() => ({ data: null, error: { message: "RLS" } }));
    await expect(vincularObraAoFluxo("o-1", null)).rejects.toBeTruthy();
  });

  it("monta o que entraria em cada obra que segue o fluxo", async () => {
    fake.responder((c) => (c.tabela === "obras" ? { data: [obra], error: null } : undefined));
    const { result } = hook(() => useSincronizacoesDoFluxoObra("x-1", estrutura, true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].obra.nome).toBe("Casa Azul");
    expect(result.current.data?.[0].temAlgo).toBe(true);
    expect(result.current.data?.[0].plano.nos.length).toBeGreaterThan(0);
  });

  it("usa o menor início das frentes quando a obra não tem data prevista", async () => {
    fake.responder((c) => {
      if (c.tabela === "obras") return { data: [{ ...obra, data_inicio_prevista: null }], error: null };
      if (c.tabela === "obra_frente") return { data: [], error: null };
      return undefined;
    });
    const { result } = hook(() => useSincronizacoesDoFluxoObra("x-1", estrutura, true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("erro ao ler frentes vira erro da query", async () => {
    fake.responder((c) => {
      if (c.tabela === "obras") return { data: [obra], error: null };
      if (c.tabela === "obra_frente") return { data: null, error: { message: "boom" } };
      return undefined;
    });
    const { result } = hook(() => useSincronizacoesDoFluxoObra("x-1", estrutura, true));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("não consulta sem fluxo ou desligada", () => {
    const { result } = hook(() => useSincronizacoesDoFluxoObra(null, estrutura, true));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("aplica nas obras escolhidas e conta as que falharam", async () => {
    fake.responder((c) => (c.tabela === "obras" ? { data: [obra], error: null } : undefined));
    const lista = hook(() => useSincronizacoesDoFluxoObra("x-1", estrutura, true));
    await waitFor(() => expect(lista.result.current.isSuccess).toBe(true));
    const itens = lista.result.current.data!;

    fake.responder(() => undefined);
    const { result, invalidar } = hook(() => useAplicarSincronizacoesObra());
    let r = { ok: 0, falhas: [] as string[] };
    await act(async () => {
      r = await result.current.mutateAsync(itens);
    });
    expect(r).toEqual({ ok: 1, falhas: [] });
    expect(fake.escritas("obra_frente").length).toBeGreaterThan(0);
    expect(fake.escritas("tarefas")).toHaveLength(1);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["fluxo-obra-sincronizacoes"] });

    fake.responder(() => ({ data: null, error: { message: "RLS" } }));
    await act(async () => {
      r = await result.current.mutateAsync(itens);
    });
    expect(r).toEqual({ ok: 0, falhas: ["Casa Azul"] });
  });
});

describe("sincronizar projetos com o fluxo", () => {
  it("vincula o projeto ao fluxo (e propaga erro)", async () => {
    await vincularProjetoAoFluxo("p-1", "x-1");
    expect(fake.escritas("projetos")[0].payload).toEqual({ fluxo_id: "x-1" });
    fake.responder(() => ({ data: null, error: { message: "RLS" } }));
    await expect(vincularProjetoAoFluxo("p-1", null)).rejects.toBeTruthy();
  });

  it("lista os projetos que seguem o fluxo", async () => {
    fake.responder((c) =>
      c.tabela === "projetos"
        ? { data: [{ id: "p-1", nome: "Residência", data_inicio: "2026-11-01" }], error: null }
        : undefined
    );
    const { result } = hook(() => useSincronizacoesDoFluxoProjetos("x-1", [], true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].projeto).toEqual({ id: "p-1", nome: "Residência" });
    expect(result.current.data?.[0].temAlgo).toBe(false);
  });

  it("erro ao ler as disciplinas vira erro da query", async () => {
    fake.responder((c) => {
      if (c.tabela === "projetos") return { data: [{ id: "p-1", nome: "R", data_inicio: null }], error: null };
      if (c.tabela === "projeto_disciplinas") return { data: null, error: { message: "boom" } };
      return undefined;
    });
    const { result } = hook(() => useSincronizacoesDoFluxoProjetos("x-1", [], true));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("aplica nos escolhidos e conta quem falhou", async () => {
    projetosMock.aplicarPlanoFluxoNoProjeto.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("x"));
    const plano = { novas: [], encaixadas: [] };
    const itens = [
      { projeto: { id: "p-1", nome: "A" }, plano, mudamDeColuna: 0, temAlgo: true },
      { projeto: { id: "p-2", nome: "B" }, plano, mudamDeColuna: 0, temAlgo: true },
    ];
    const { result, invalidar } = hook(() => useAplicarSincronizacoesProjetos());
    let r = { ok: 0, falhas: [] as string[] };
    await act(async () => {
      r = await result.current.mutateAsync(itens);
    });
    expect(r).toEqual({ ok: 1, falhas: ["B"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["projetos"] });
  });
});

describe("useClienteObraOrcamento", () => {
  it("carrega o orçado do portal com o token", async () => {
    portal.rpc.mockResolvedValue({ data: { linhas: [], sem_frente: 2 }, error: null });
    const { result } = renderHook(() => useClienteObraOrcamento("o-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dados).toEqual({ linhas: [], sem_frente: 2 });
    expect(portal.rpc).toHaveBeenCalledWith("get_cliente_obra_orcamento", { p_token: "tok", p_obra_id: "o-1" });
  });

  it("sem token ou com erro da RPC mostra a mensagem", async () => {
    portal.token = null;
    const a = renderHook(() => useClienteObraOrcamento("o-1"));
    await waitFor(() => expect(a.result.current.error).toBe("Não autenticado"));
    portal.token = "tok";
    portal.rpc.mockResolvedValue({ data: null, error: { message: "sem acesso" } });
    const b = renderHook(() => useClienteObraOrcamento("o-1"));
    await waitFor(() => expect(b.result.current.error).toBe("sem acesso"));
  });

  it("sem obra não chama nada", () => {
    renderHook(() => useClienteObraOrcamento(undefined));
    expect(portal.rpc).not.toHaveBeenCalled();
  });
});
