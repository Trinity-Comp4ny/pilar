import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// Detalhe do cliente: cadastro, projetos com o progresso de disciplinas (duas
// leituras, porque a view mascarada não embeda disciplinas), propostas e conta
// ativa do portal. Erros viram estado vazio do hook, não crash.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));

import { useClienteDetalhe } from "./useClienteDetalhe";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const setup = (id = "cli-1") => renderHook(() => useClienteDetalhe(id), { wrapper }).result;

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
});

describe("useClienteDetalhe", () => {
  it("carrega cliente, projetos com disciplinas concluídas, propostas e portal ativo", async () => {
    sb.resultado("clientes.select", { data: { id: "cli-1", nome: "Construtora X" }, error: null });
    sb.resultado("projetos_safe.select", {
      data: [
        { id: "p1", codigo_projeto: "P-01", nome: "Torre", status: "Em andamento", valor_contrato: 1000 },
        { id: "p2", codigo_projeto: null, nome: "Casa", status: "Concluído", valor_contrato: null },
        { id: null, codigo_projeto: null, nome: "Sem id", status: "x", valor_contrato: null },
      ],
      error: null,
    });
    sb.resultado("projeto_disciplinas.select", {
      data: [
        { projeto_id: "p1", status: "Concluído" },
        { projeto_id: "p1", status: "Em andamento" },
        { projeto_id: "p1", status: null },
      ],
      error: null,
    });
    sb.resultado("propostas.select", { data: [{ id: "pr1", titulo: "Proposta A" }], error: null });
    sb.resultado("cliente_portal_accounts.select", { data: { id: "acc", email: "c@x.com" }, error: null });

    const result = setup();
    await waitFor(() => expect(result.current.isLoadingProjetos).toBe(false));
    await waitFor(() => expect(result.current.isLoadingPortal).toBe(false));
    await waitFor(() => expect(result.current.cliente).not.toBeNull());

    expect(result.current.cliente).toEqual({ id: "cli-1", nome: "Construtora X" });
    expect(result.current.projetos.map((p) => [p.id, p.total_disciplinas, p.disciplinas_concluidas])).toEqual([
      ["p1", 3, 1],
      ["p2", 0, 0],
      [null, 0, 0],
    ]);
    expect(sb.de("projeto_disciplinas", "in")[0].args).toEqual(["projeto_id", ["p1", "p2"]]);
    await waitFor(() => expect(result.current.propostas).toHaveLength(1));
    expect(sb.de("propostas", "is")[0].args).toEqual(["deleted_at", null]);
    expect(result.current.portalStatus).toEqual({ exists: true, email: "c@x.com" });
    expect(sb.de("cliente_portal_accounts", "eq").map((c) => c.args)).toEqual([
      ["cliente_id", "cli-1"],
      ["ativo", true],
    ]);
  });

  it("cliente sem projetos não consulta disciplinas; sem conta no portal fica 'não existe'", async () => {
    sb.resultado("clientes.select", { data: null, error: null });
    sb.resultado("projetos_safe.select", { data: null, error: null });
    sb.resultado("propostas.select", { data: null, error: null });
    sb.resultado("cliente_portal_accounts.select", { data: null, error: null });
    const result = setup();
    await waitFor(() => expect(result.current.portalStatus).toBeDefined());
    await waitFor(() => expect(result.current.isLoadingProjetos).toBe(false));
    await waitFor(() => expect(result.current.isLoadingPropostas).toBe(false));
    expect(result.current.cliente).toBeNull();
    expect(result.current.projetos).toEqual([]);
    expect(result.current.propostas).toEqual([]);
    expect(result.current.portalStatus).toEqual({ exists: false, email: null });
    expect(sb.de("projeto_disciplinas", "select")).toHaveLength(0);
  });

  it("erros de leitura deixam listas vazias e cliente nulo", async () => {
    sb.resultado("clientes.select", { data: null, error: { message: "rls" } });
    sb.resultado("projetos_safe.select", { data: null, error: { message: "rls" } });
    sb.resultado("propostas.select", { data: null, error: { message: "rls" } });
    const result = setup();
    await waitFor(() => expect(result.current.isLoadingCliente).toBe(false));
    await waitFor(() => expect(result.current.isLoadingProjetos).toBe(false));
    await waitFor(() => expect(result.current.isLoadingPropostas).toBe(false));
    expect(result.current.cliente).toBeNull();
    expect(result.current.projetos).toEqual([]);
    expect(result.current.propostas).toEqual([]);
  });

  it("erro nas disciplinas derruba a lista de projetos", async () => {
    sb.resultado("projetos_safe.select", { data: [{ id: "p1", nome: "Torre" }], error: null });
    sb.resultado("projeto_disciplinas.select", { data: null, error: { message: "rls" } });
    const result = setup();
    await waitFor(() => expect(result.current.isLoadingProjetos).toBe(false));
    expect(result.current.projetos).toEqual([]);
  });

  it("sem id não consulta nada", () => {
    const result = setup("");
    expect(sb.client.from).not.toHaveBeenCalled();
    expect(result.current.cliente).toBeNull();
    expect(result.current.portalStatus).toBeUndefined();
  });
});
