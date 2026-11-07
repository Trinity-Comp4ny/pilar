import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ analytics: { track: (...a: unknown[]) => track(...a) } }));

import { useClientes, useClientesPaginados, useOrigensClientes, type ClienteFormData } from "./useClientes";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const FORM: ClienteFormData = {
  nome: " Ana ",
  sobrenome: " ",
  tipo_pessoa: "PF",
  cpf_cnpj: "529.982.247-25",
  endereco: "",
  contato: "(14) 99999-8888",
  email: "",
  origem: "",
  contas_bancarias: [],
  chaves_pix: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  supabaseFake.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  supabaseFake.respondRpc("get_user_empresa_id", { data: "emp-1" });
});

describe("useClientes: upsert", () => {
  it("cria normalizando campos vazios para null e documento só com dígitos", async () => {
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });

    await result.current.upsertCliente({ data: FORM });

    expect(supabaseFake.callsTo("clientes", "insert")[0].payload).toEqual({
      nome: "Ana",
      sobrenome: null,
      tipo_pessoa: "PF",
      cpf_cnpj: "52998224725",
      endereco: null,
      contato: "(14) 99999-8888",
      email: null,
      origem: null,
      contas_bancarias: [],
      chaves_pix: [],
      empresa_id: "emp-1",
    });
    expect(track).toHaveBeenCalledWith("cliente_criado", { tipo_pessoa: "PF" });
    expect(toastSuccess).toHaveBeenCalledWith("Cliente cadastrado", expect.anything());
  });

  it("com id, atualiza em vez de inserir e não conta como cliente novo", async () => {
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });

    await result.current.upsertCliente({ id: "c1", data: FORM });

    expect(supabaseFake.callsTo("clientes", "insert")).toHaveLength(0);
    expect(supabaseFake.callsTo("clientes", "update")[0].chain).toContainEqual(["eq", ["id", "c1"]]);
    expect(track).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Cliente atualizado", expect.anything());
  });

  it("violação de unicidade em outro campo: mensagem genérica de duplicado", async () => {
    supabaseFake.respond("clientes", "insert", { error: { code: "23505", message: "duplicate key value (email)" } });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });

    await expect(result.current.upsertCliente({ data: FORM })).rejects.toBeTruthy();
    expect(toastError).toHaveBeenCalledWith("Registro duplicado", expect.anything());
  });

  it("falha de permissão: mensagem segura", async () => {
    supabaseFake.respond("clientes", "update", { error: { message: "permission denied for table clientes" } });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });

    await expect(result.current.upsertCliente({ id: "c1", data: FORM })).rejects.toBeTruthy();
    expect(toastError).toHaveBeenCalledWith("Erro ao salvar", {
      description: "Você não tem permissão para realizar esta ação.",
    });
  });
});

describe("useClientes: portal do cliente", () => {
  it("status do portal distingue convite pendente de acesso ativo", async () => {
    supabaseFake.respond("cliente_portal_accounts", "select", {
      data: [
        { cliente_id: "c1", senha_hash: null },
        { cliente_id: "c2", senha_hash: "x" },
      ],
    });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });

    await waitFor(() => expect(result.current.portalStatusPorCliente.size).toBe(2));
    expect(result.current.portalStatusPorCliente.get("c1")).toBe("convite_pendente");
    expect(result.current.portalStatusPorCliente.get("c2")).toBe("ativo");
  });

  it("convidar chama a edge function e devolve o e-mail", async () => {
    supabaseFake.respondInvoke("invite-cliente-portal", { data: { email: "ana@lima.com" } });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });

    await expect(result.current.invitePortal({ clienteId: "c1", email: "ana@lima.com" })).resolves.toEqual({
      email: "ana@lima.com",
    });
    expect(supabaseFake.invokeCalls[0]).toEqual({
      fn: "invite-cliente-portal",
      options: { body: { cliente_id: "c1", email: "ana@lima.com" } },
    });
  });

  it("erro devolvido no corpo da função vira toast de falha", async () => {
    supabaseFake.respondInvoke("invite-cliente-portal", { data: { error: "E-mail já usado" } });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });

    await expect(result.current.invitePortal({ clienteId: "c1", email: "x@y.com" })).rejects.toThrow("E-mail já usado");
    expect(toastError).toHaveBeenCalledWith("Não foi possível criar o acesso", expect.anything());
  });

  it("redefinir senha com erro HTTP lê a mensagem do corpo", async () => {
    supabaseFake.respondInvoke("reset-cliente-portal-password", {
      error: Object.assign(new Error("non-2xx"), { context: { json: async () => ({ error: "Conta inativa" }) } }),
    });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });

    await expect(result.current.resetPortalPassword({ clienteId: "c1", nomeCliente: "Ana" })).rejects.toThrow(
      "Conta inativa"
    );
    expect(toastError).toHaveBeenCalledWith("Não foi possível redefinir a senha", expect.anything());
  });

  it("revogar desativa a conta do portal", async () => {
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });

    await result.current.revokePortalAccess("c1");

    const [upd] = supabaseFake.callsTo("cliente_portal_accounts", "update");
    expect(upd.payload).toEqual({ ativo: false });
    expect(upd.chain).toContainEqual(["eq", ["cliente_id", "c1"]]);
    expect(toastSuccess).toHaveBeenCalledWith("Acesso ao portal revogado");
  });

  it("revogar com erro avisa", async () => {
    supabaseFake.respond("cliente_portal_accounts", "update", { error: { message: "x" } });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });
    await expect(result.current.revokePortalAccess("c1")).rejects.toBeTruthy();
    expect(toastError).toHaveBeenCalledWith("Não foi possível revogar o acesso", expect.anything());
  });

  it("checkPortalAccess e fetchPortalEmail consultam a conta ativa do cliente", async () => {
    supabaseFake.respond("cliente_portal_accounts", "select", { data: { id: "acc", email: "ana@lima.com" } });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });

    await expect(result.current.checkPortalAccess("c1")).resolves.toBe(true);
    await expect(result.current.fetchPortalEmail("c1")).resolves.toBe("ana@lima.com");
  });
});

describe("useClientes: excluir e restaurar", () => {
  it("excluir com erro avisa e não mostra sucesso", async () => {
    supabaseFake.respondRpc("rpc_soft_delete", { error: { message: "não pode" } });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });

    await expect(result.current.deleteCliente("c1")).rejects.toBeTruthy();
    expect(toastError).toHaveBeenCalledWith("Erro ao excluir", expect.anything());
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("desfazer com erro avisa", async () => {
    supabaseFake.respondRpc("rpc_restaurar", { error: { message: "falhou" } });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });

    await result.current.deleteCliente("c1");
    const [, opts] = toastSuccess.mock.calls[0] as [string, { action: { onClick: () => void } }];
    opts.action.onClick();

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Erro ao restaurar", expect.anything()));
  });
});

describe("listagem paginada", () => {
  it("traduz filtros para o RPC e devolve total e linhas sem total_count", async () => {
    supabaseFake.respondRpc("listar_clientes_paginado", {
      data: [{ id: "c1", nome: "Ana", total_count: "41" }],
    });
    const { result } = renderHook(
      () =>
        useClientesPaginados({
          page: 2,
          pageSize: 20,
          search: "  ana ",
          origem: "Site",
          tipoPessoa: "PJ",
          portal: "com",
          projeto: "sem",
          sortField: "created_at",
          sortDir: "desc",
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.total).toBe(41));
    expect(result.current.clientes).toEqual([{ id: "c1", nome: "Ana" }]);
    expect(supabaseFake.rpcCalls.find((c) => c.fn === "listar_clientes_paginado")?.args).toEqual({
      p_search: "ana",
      p_origem: "Site",
      p_tipo_pessoa: "PJ",
      p_tem_portal: true,
      p_com_projeto: false,
      p_sort_field: "created_at",
      p_sort_dir: "desc",
      p_limit: 20,
      p_offset: 40,
    });
  });

  it("filtros em 'todos' viram null no RPC", async () => {
    const { result } = renderHook(() => useClientesPaginados(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(supabaseFake.rpcCalls.find((c) => c.fn === "listar_clientes_paginado")?.args).toMatchObject({
      p_search: null,
      p_origem: null,
      p_tipo_pessoa: null,
      p_tem_portal: null,
      p_com_projeto: null,
    });
    expect(result.current.total).toBe(0);
  });

  it("erro do RPC aparece como isError", async () => {
    supabaseFake.respondRpc("listar_clientes_paginado", { error: { message: "boom" } });
    const { result } = renderHook(() => useClientesPaginados(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("origens vêm do RPC dedicado", async () => {
    supabaseFake.respondRpc("listar_origens_clientes", { data: [{ origem: "Site" }, { origem: "Indicação" }] });
    const { result } = renderHook(() => useOrigensClientes(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(["Site", "Indicação"]));
  });
});

describe("useClientes: listas completas e bordas", () => {
  it("carrega clientes, status do portal e ids com projeto", async () => {
    supabaseFake.respond("clientes", "select", { data: [{ id: "c1", nome: "Ana" }] });
    supabaseFake.respond("cliente_portal_accounts", "select", {
      data: [
        { cliente_id: "c1", senha_hash: "h" },
        { cliente_id: "c2", senha_hash: null },
      ],
    });
    supabaseFake.respond("projetos", "select", { data: [{ cliente_id: "c1" }, { cliente_id: null }] });
    const { result } = renderHook(() => useClientes(), { wrapper });

    await waitFor(() => expect(result.current.clientes).toHaveLength(1));
    await waitFor(() => expect(result.current.portalStatusPorCliente.size).toBe(2));
    await waitFor(() => expect(result.current.clienteIdsComProjeto.size).toBe(1));
    expect(result.current.portalStatusPorCliente.get("c1")).toBe("ativo");
    expect(result.current.portalStatusPorCliente.get("c2")).toBe("convite_pendente");
    expect(result.current.clienteIdsComProjeto.has("c1")).toBe(true);
  });

  it("listas vazias quando o banco não devolve nada", async () => {
    supabaseFake.respond("clientes", "select", { data: null });
    supabaseFake.respond("cliente_portal_accounts", "select", { data: null });
    supabaseFake.respond("projetos", "select", { data: null });
    const { result } = renderHook(() => useClientes(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.clientes).toEqual([]);
    expect(result.current.portalStatusPorCliente.size).toBe(0);
    expect(result.current.clienteIdsComProjeto.size).toBe(0);
  });

  it("erro na lista completa aparece como isError", async () => {
    supabaseFake.respond("clientes", "select", { error: { message: "permission denied" } });
    const { result } = renderHook(() => useClientes(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("CPF/CNPJ duplicado tem mensagem própria", async () => {
    supabaseFake.respond("clientes", "insert", {
      error: { code: "23505", message: 'duplicate key value violates "clientes_cpf_cnpj_key"' },
    });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });
    await expect(result.current.upsertCliente({ data: FORM })).rejects.toBeTruthy();
    expect(toastError).toHaveBeenCalledWith("CPF/CNPJ já cadastrado", expect.anything());
  });

  it("campos opcionais vazios viram null", async () => {
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });
    await result.current.upsertCliente({
      data: { ...FORM, sobrenome: undefined as unknown as string, tipo_pessoa: "" as never, cpf_cnpj: "" },
    });
    expect(supabaseFake.callsTo("clientes", "insert")[0].payload).toMatchObject({
      sobrenome: null,
      tipo_pessoa: null,
      cpf_cnpj: null,
    });
  });

  it("erro na atualização avisa", async () => {
    supabaseFake.respond("clientes", "update", { error: { message: "x" } });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });
    await expect(result.current.upsertCliente({ id: "c1", data: FORM })).rejects.toBeTruthy();
    expect(toastError).toHaveBeenCalledWith("Erro ao salvar", expect.anything());
  });

  it("excluir com sucesso oferece desfazer que restaura", async () => {
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });
    await result.current.deleteCliente("c1");
    const [titulo, opts] = toastSuccess.mock.calls[0] as [string, { action: { onClick: () => void } }];
    expect(titulo).toBe("Cliente excluído");
    opts.action.onClick();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Cliente restaurado"));
  });

  it("sem conta no portal: sem acesso e sem e-mail", async () => {
    supabaseFake.respond("cliente_portal_accounts", "select", { data: null });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });
    await expect(result.current.checkPortalAccess("c1")).resolves.toBe(false);
    await expect(result.current.fetchPortalEmail("c1")).resolves.toBeNull();
  });

  it("erro HTTP sem corpo usa a mensagem do erro; sem mensagem, genérico", async () => {
    supabaseFake.respondInvoke("invite-cliente-portal", { error: new Error("Edge Function returned 500") });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });
    await expect(result.current.invitePortal({ clienteId: "c1", email: "a@b.c" })).rejects.toThrow(
      "Edge Function returned 500"
    );

    supabaseFake.respondInvoke("invite-cliente-portal", {
      error: { message: "", context: { json: () => Promise.reject(new Error("not json")) } },
    });
    await expect(result.current.invitePortal({ clienteId: "c1", email: "a@b.c" })).rejects.toThrow("Erro desconhecido");
  });

  it("redefinir senha: sucesso, erro no corpo e erro sem corpo", async () => {
    supabaseFake.respondInvoke("reset-cliente-portal-password", { data: { email: "ana@lima.com" } });
    const { result } = renderHook(() => useClientes({ enableListQueries: false }), { wrapper });
    await expect(result.current.resetPortalPassword({ clienteId: "c1", nomeCliente: "Ana" })).resolves.toEqual({
      email: "ana@lima.com",
    });

    supabaseFake.respondInvoke("reset-cliente-portal-password", { data: { error: "Conta não encontrada" } });
    await expect(result.current.resetPortalPassword({ clienteId: "c1", nomeCliente: "Ana" })).rejects.toThrow(
      "Conta não encontrada"
    );

    supabaseFake.respondInvoke("reset-cliente-portal-password", { error: { message: "" } });
    await expect(result.current.resetPortalPassword({ clienteId: "c1", nomeCliente: "Ana" })).rejects.toThrow(
      "Erro desconhecido"
    );
  });

  it("paginada vazia e origens nulas ou com erro", async () => {
    supabaseFake.respondRpc("listar_clientes_paginado", { data: null });
    const pag = renderHook(() => useClientesPaginados(), { wrapper });
    await waitFor(() => expect(pag.result.current.isLoading).toBe(false));
    expect(pag.result.current.clientes).toEqual([]);

    supabaseFake.respondRpc("listar_origens_clientes", { data: null });
    const vazio = renderHook(() => useOrigensClientes(), { wrapper });
    await waitFor(() => expect(vazio.result.current.data).toEqual([]));

    client.clear();
    supabaseFake.respondRpc("listar_origens_clientes", { error: { message: "boom" } });
    const erro = renderHook(() => useOrigensClientes(), { wrapper });
    await waitFor(() => expect(erro.result.current.isError).toBe(true));
  });
});
