import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { OpsAcao, OpsAgente, OpsExecucao } from "./api";

// Resumo da Central do time: status de cada agente (pendências contadas por
// agente), a fila do dia com as ações de quem já rodou e o remetente dos
// rascunhos (primeiro nome do perfil ou "a equipe").

const dados = vi.hoisted(() => ({
  agentes: undefined as unknown,
  execucoes: undefined as unknown,
  pendentes: undefined as unknown,
  perfil: null as { first_name?: string | null } | null,
  diasReceita: [] as number[],
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: dados.perfil }) }));
vi.mock("./hooks", () => ({
  useAgentes: () => ({ data: dados.agentes }),
  useUltimasExecucoes: () => ({ data: dados.execucoes }),
  useAcoesPendentes: () => ({ data: dados.pendentes }),
  useReceita: (dias: number) => {
    dados.diasReceita.push(dias);
    return { data: undefined };
  },
  useSaudeEmpresas: () => ({ data: undefined }),
}));

import { useTimeResumo } from "./useTimeResumo";

const agente = (id: string, ativo = true) => ({ id, nome: id, ativo }) as unknown as OpsAgente;
const execucao = (agente_id: string, status: string) => ({ id: `x-${agente_id}`, agente_id, status }) as OpsExecucao;
const acao = (id: string, agente_id: string): OpsAcao => ({
  id,
  agente_id,
  tipo: "tarefa",
  titulo: `Ação ${id}`,
  prioridade: 2,
  prazo: null,
  empresa_id: null,
  created_at: "2026-10-15T10:00:00Z",
  rascunho: null,
});

beforeEach(() => {
  dados.agentes = undefined;
  dados.execucoes = undefined;
  dados.pendentes = undefined;
  dados.perfil = null;
  dados.diasReceita = [];
});

describe("useTimeResumo", () => {
  it("sem dados carregados: listas vazias, remetente genérico e janela de 30 dias", () => {
    const { result } = renderHook(() => useTimeResumo());
    expect(result.current.agentes).toEqual([]);
    expect(result.current.decisoes).toEqual([]);
    expect(result.current.remetente).toBe("a equipe");
    expect(dados.diasReceita).toContain(30);
  });

  it("monta status por agente e a fila só com ações de quem já rodou", () => {
    dados.perfil = { first_name: "  Matheus " };
    dados.agentes = [agente("receita"), agente("clientes"), agente("qualidade"), agente("produto", false)];
    dados.execucoes = new Map([
      ["receita", execucao("receita", "ok")],
      ["qualidade", execucao("qualidade", "falhou")],
    ]);
    dados.pendentes = [acao("a1", "receita"), acao("a2", "receita"), acao("a3", "clientes")];

    const { result } = renderHook(() => useTimeResumo(7));
    expect(dados.diasReceita).toContain(7);
    expect(result.current.remetente).toBe("Matheus");
    const porId = Object.fromEntries(result.current.agentes.map((a) => [a.agente.id, a]));
    expect(porId.receita).toMatchObject({ pendentes: 2, status: "atencao" });
    expect(porId.receita.ultima?.status).toBe("ok");
    expect(porId.clientes).toMatchObject({ pendentes: 1, status: "atencao", ultima: null });
    expect(porId.qualidade.status).toBe("falhou");
    expect(porId.produto.pendentes).toBe(0);
    // "clientes" nunca rodou: a ação dele não entra; as duas de "receita" sim.
    expect(result.current.decisoes.map((d) => d.titulo).sort()).toEqual(["Ação a1", "Ação a2"]);
  });
});
