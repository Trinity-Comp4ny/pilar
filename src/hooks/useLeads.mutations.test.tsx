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
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));

import {
  useCreateLead,
  useUpdateLeadStatus,
  useConvertLeadToClient,
  useDeleteLead,
  useCreatePropostaFromLead,
  useLeads,
  useLeadMembers,
  useLeadsPaginados,
  type Lead,
} from "./useLeads";

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseFake.reset();
  client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  supabaseFake.respondRpc("get_user_empresa_id", { data: "emp-1" });
});

describe("useCreateLead", () => {
  it("grava o lead como Novo, na empresa do usuário, e avisa sucesso", async () => {
    supabaseFake.respond("leads", "insert", { data: { id: "l1" } });
    const { result } = renderHook(() => useCreateLead(), { wrapper });

    result.current.mutate({
      nome: "Ana",
      email: "  ana@escritorio.com.br ",
      valor_estimado: 1500,
      responsavel_id: "u9",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [insert] = supabaseFake.callsTo("leads", "insert");
    expect(insert.payload).toMatchObject({
      nome: "Ana",
      email: "ana@escritorio.com.br",
      valor_estimado: 1500,
      responsavel_id: "u9",
      status: "Novo",
      empresa_id: "emp-1",
    });
    // Nunca pede todas as colunas: leads.valor_estimado não é legível pela API.
    expect(insert.chain).toContainEqual(["select", ["id, nome, status, empresa_id, created_at"]]);
    expect(toastSuccess).toHaveBeenCalledWith("Lead cadastrado", expect.anything());
  });

  it("sem responsável escolhido, o lead fica com quem criou", async () => {
    supabaseFake.setUser({ id: "criador" });
    supabaseFake.respond("leads", "insert", { data: { id: "l1" } });
    const { result } = renderHook(() => useCreateLead(), { wrapper });

    result.current.mutate({ nome: "Ana" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabaseFake.callsTo("leads", "insert")[0].payload).toMatchObject({ responsavel_id: "criador" });
  });

  it("e-mail vazio vira null (não colide no índice único por empresa)", async () => {
    supabaseFake.respond("leads", "insert", { data: { id: "l1" } });
    const { result } = renderHook(() => useCreateLead(), { wrapper });

    result.current.mutate({ nome: "Ana", email: "   " });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabaseFake.callsTo("leads", "insert")[0].payload).toMatchObject({ email: null, valor_estimado: null });
  });

  it("e-mail duplicado no banco (índice único) mostra a mensagem específica", async () => {
    supabaseFake.respond("leads", "insert", {
      error: { code: "23505", message: 'duplicate key value violates unique constraint "leads_empresa_email_uidx"' },
    });
    const { result } = renderHook(() => useCreateLead(), { wrapper });

    result.current.mutate({ nome: "Ana", email: "ana@x.com" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Erro ao salvar", {
      description: "Já existe um lead ativo com este email.",
    });
  });

  it("erro genérico do servidor vira mensagem segura, sem vazar detalhe do banco", async () => {
    supabaseFake.respond("leads", "insert", {
      error: { code: "42501", message: "new row violates row-level security" },
    });
    const { result } = renderHook(() => useCreateLead(), { wrapper });

    result.current.mutate({ nome: "Ana" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith("Erro ao salvar", {
      description: "Você não tem permissão para realizar esta ação.",
    });
  });
});

describe("useUpdateLeadStatus", () => {
  const leads: Lead[] = [
    { id: "l1", nome: "Ana", status: "Novo", etapa_id: "e-novo", motivo_perda: "antigo" },
    { id: "l2", nome: "Bia", status: "Novo", etapa_id: "e-novo" },
  ];

  it("move só a etapa e aplica os efeitos do bucket (Ganho carimba convertido_em)", async () => {
    client.setQueryData(["leads"], leads);
    supabaseFake.respond("leads", "update", { data: null });
    const { result } = renderHook(() => useUpdateLeadStatus(), { wrapper });

    result.current.mutate({ leadId: "l1", etapa: { id: "e-ganho", nome: "Fechado", bucket: "Ganho" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [upd] = supabaseFake.callsTo("leads", "update");
    expect(upd.payload).toMatchObject({ etapa_id: "e-ganho", motivo_perda: null });
    expect(typeof (upd.payload as { convertido_em: string }).convertido_em).toBe("string");
    expect(upd.payload).not.toHaveProperty("status");
    expect(upd.chain).toContainEqual(["eq", ["id", "l1"]]);
    expect(toastSuccess).toHaveBeenCalledWith("Lead movido", { description: "Lead movido para Fechado" });
  });

  it("Perdido grava o motivo informado", async () => {
    client.setQueryData(["leads"], leads);
    const { result } = renderHook(() => useUpdateLeadStatus(), { wrapper });

    result.current.mutate({
      leadId: "l2",
      etapa: { id: "e-perdido", nome: "Perdido", bucket: "Perdido" },
      extraFields: { motivo_perda: "Preço" },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabaseFake.callsTo("leads", "update")[0].payload).toEqual({
      etapa_id: "e-perdido",
      motivo_perda: "Preço",
    });
  });

  it("falha no servidor desfaz o movimento otimista e avisa", async () => {
    client.setQueryData(["leads"], leads);
    supabaseFake.respond("leads", "update", { error: { message: "boom" } });
    const { result } = renderHook(() => useUpdateLeadStatus(), { wrapper });

    result.current.mutate({ leadId: "l1", etapa: { id: "e-neg", nome: "Negociação", bucket: "Negociação" } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cache = client.getQueryData<Lead[]>(["leads"]);
    expect(cache?.find((l) => l.id === "l1")).toMatchObject({ etapa_id: "e-novo", status: "Novo" });
    expect(toastError).toHaveBeenCalledWith("Erro ao mover o lead", expect.anything());
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe("useConvertLeadToClient", () => {
  it("converte pelo RPC sem copiar o CNPJ cru e aplica o enriquecimento limpo no cliente", async () => {
    supabaseFake.respondRpc("rpc_converter_lead_cliente", { data: "cli-9" });
    const { result } = renderHook(() => useConvertLeadToClient(), { wrapper });

    result.current.mutate({
      leadId: "l1",
      etapaId: "e-ganho",
      enrichment: { cnpj: "11.222.333/0001-81", razao_social: "Alfa Engenharia", endereco: "Rua A, 1" },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabaseFake.rpcCalls).toContainEqual({
      fn: "rpc_converter_lead_cliente",
      args: { p_lead_id: "l1", p_omit_cnpj: true },
    });
    expect(supabaseFake.callsTo("leads", "update")[0].payload).toEqual({ etapa_id: "e-ganho" });
    const [cli] = supabaseFake.callsTo("clientes", "update");
    expect(cli.payload).toEqual({
      cpf_cnpj: "11222333000181",
      tipo_pessoa: "juridica",
      nome: "Alfa Engenharia",
      endereco: "Rua A, 1",
    });
    expect(cli.chain).toContainEqual(["eq", ["id", "cli-9"]]);
    expect(toastSuccess).toHaveBeenCalledWith("Lead convertido!", expect.anything());
  });

  it("sem enriquecimento nem etapa, só chama o RPC", async () => {
    supabaseFake.respondRpc("rpc_converter_lead_cliente", { data: "cli-9" });
    const { result } = renderHook(() => useConvertLeadToClient(), { wrapper });

    result.current.mutate({ leadId: "l1", enrichment: null });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabaseFake.calls).toHaveLength(0);
  });

  it("lead já convertido: avisa e não toca no cliente", async () => {
    supabaseFake.respondRpc("rpc_converter_lead_cliente", { error: { message: "Lead já foi convertido" } });
    const { result } = renderHook(() => useConvertLeadToClient(), { wrapper });

    result.current.mutate({ leadId: "l1", enrichment: { cnpj: "1", razao_social: "X", endereco: null } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(supabaseFake.callsTo("clientes")).toHaveLength(0);
    expect(toastError).toHaveBeenCalledWith("Erro na conversão", {
      description: "Este lead já foi convertido em cliente.",
    });
  });

  it("falha ao mover a etapa interrompe a conversão com erro", async () => {
    supabaseFake.respondRpc("rpc_converter_lead_cliente", { data: "cli-9" });
    supabaseFake.respond("leads", "update", { error: { message: "permission denied" } });
    const { result } = renderHook(() => useConvertLeadToClient(), { wrapper });

    result.current.mutate({ leadId: "l1", etapaId: "e-ganho" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe("useDeleteLead", () => {
  it("faz soft delete e oferece desfazer", async () => {
    const { result } = renderHook(() => useDeleteLead(), { wrapper });

    result.current.mutate("l1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [upd] = supabaseFake.callsTo("leads", "update");
    expect(typeof (upd.payload as { deleted_at: string }).deleted_at).toBe("string");
    expect(upd.chain).toContainEqual(["eq", ["id", "l1"]]);
    const [, opts] = toastSuccess.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => Promise<void> } },
    ];
    expect(opts.action.label).toBe("Desfazer");

    await opts.action.onClick();
    expect(supabaseFake.callsTo("leads", "update")[1].payload).toEqual({ deleted_at: null });
    expect(toastSuccess).toHaveBeenLastCalledWith("Exclusão desfeita");
  });

  it("erro ao excluir avisa e não mostra sucesso", async () => {
    supabaseFake.respond("leads", "update", { error: { message: "permission denied" } });
    const { result } = renderHook(() => useDeleteLead(), { wrapper });

    result.current.mutate("l1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith("Erro ao excluir", expect.anything());
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("erro ao desfazer a exclusão avisa", async () => {
    supabaseFake.respond("leads", "update", { data: null }, { error: { message: "x" } });
    const { result } = renderHook(() => useDeleteLead(), { wrapper });
    result.current.mutate("l1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [, opts] = toastSuccess.mock.calls[0] as [string, { action: { onClick: () => Promise<void> } }];
    await opts.action.onClick();
    expect(toastError).toHaveBeenCalledWith("Erro ao desfazer", expect.anything());
  });
});

describe("useCreatePropostaFromLead", () => {
  it("cria a proposta em rascunho e avança o lead que ainda está antes de Proposta", async () => {
    supabaseFake.respond("propostas", "insert", { data: { id: "p1" } });
    const { result } = renderHook(() => useCreatePropostaFromLead(), { wrapper });

    result.current.mutate({ id: "l1", nome: "Ana", status: "Em contato" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "p1" });
    expect(supabaseFake.callsTo("propostas", "insert")[0].payload).toMatchObject({
      empresa_id: "emp-1",
      lead_id: "l1",
      titulo: "Proposta — Ana",
      status: "rascunho",
    });
    expect(supabaseFake.callsTo("leads", "update")[0].payload).toEqual({ status: "Proposta" });
  });

  it("nunca retrocede lead que já está em Negociação", async () => {
    supabaseFake.respond("propostas", "insert", { data: { id: "p1" } });
    const { result } = renderHook(() => useCreatePropostaFromLead(), { wrapper });

    result.current.mutate({ id: "l1", nome: "Ana", status: "Negociação" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabaseFake.callsTo("leads", "update")).toHaveLength(0);
  });

  it("usuário sem empresa: erro e nada é gravado", async () => {
    supabaseFake.respondRpc("get_user_empresa_id", { data: null });
    const { result } = renderHook(() => useCreatePropostaFromLead(), { wrapper });

    result.current.mutate({ id: "l1", nome: "Ana", status: "Novo" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(supabaseFake.callsTo("propostas")).toHaveLength(0);
    expect(toastError).toHaveBeenCalledWith("Erro ao criar proposta", { description: "Empresa não encontrada" });
  });
});

describe("consultas de leads", () => {
  it("useLeads lê da view segura (leads_safe), nunca da tabela crua", async () => {
    supabaseFake.respond("leads_safe", "select", { data: [{ id: "l1", nome: "Ana", status: "Novo" }] });
    const { result } = renderHook(() => useLeads(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(supabaseFake.callsTo("leads")).toHaveLength(0);
  });

  it("useLeads propaga erro do servidor para a tela mostrar o estado de erro", async () => {
    supabaseFake.respond("leads_safe", "select", { error: { message: "boom" } });
    const { result } = renderHook(() => useLeads(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("useLeadsPaginados aplica busca, filtro de status e paginação", async () => {
    supabaseFake.respond("leads_safe", "select", { data: [{ id: "l1" }], count: 3 });
    const { result } = renderHook(() => useLeadsPaginados({ pageSize: 1, searchTerm: "ana", statusFilter: ["Novo"] }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [q] = supabaseFake.callsTo("leads_safe");
    expect(q.chain).toContainEqual(["ilike", ["nome", "%ana%"]]);
    expect(q.chain).toContainEqual(["in", ["status", ["Novo"]]]);
    expect(q.chain).toContainEqual(["range", [0, 0]]);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("useLeadMembers lista só membros ativos da empresa", async () => {
    supabaseFake.respond("profiles", "select", { data: [{ id: "u1", first_name: "A", last_name: "B" }] });
    const { result } = renderHook(() => useLeadMembers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [q] = supabaseFake.callsTo("profiles");
    expect(q.chain).toContainEqual(["eq", ["empresa_id", "emp-1"]]);
    expect(q.chain).toContainEqual(["is", ["desativado_em", null]]);
  });
});
