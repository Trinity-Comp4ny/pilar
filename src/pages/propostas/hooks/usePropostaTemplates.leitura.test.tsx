import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// Modelos de proposta/contrato: listagem (filtro por tipo, tipo padrão), exclusão
// lógica, download do arquivo e as recusas do upload antes de ler o Word
// (extensão, tipo MIME e usuário sem empresa).

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));

import {
  downloadTemplateFile,
  useDeleteTemplate,
  usePropostaTemplates,
  useUploadTemplate,
} from "./usePropostaTemplates";

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

describe("usePropostaTemplates", () => {
  it("lista todos, com tipo 'proposta' quando o registro não tem tipo", async () => {
    sb.resultado("proposta_templates.select", {
      data: [
        { id: "t1", nome: "A", tipo: null },
        { id: "t2", nome: "B", tipo: "contrato" },
      ],
      error: null,
    });
    const { result } = renderHook(() => usePropostaTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((t) => t.tipo)).toEqual(["proposta", "contrato"]);
    expect(sb.de("proposta_templates", "eq")).toHaveLength(0);
  });

  it("filtra por tipo; sem dados devolve vazio", async () => {
    sb.resultado("proposta_templates.select", { data: null, error: null });
    const { result } = renderHook(() => usePropostaTemplates("contrato"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(sb.de("proposta_templates", "eq")[0].args).toEqual(["tipo", "contrato"]);
  });

  it("erro do banco vira erro da query", async () => {
    sb.resultado("proposta_templates.select", { data: null, error: { message: "rls" } });
    const { result } = renderHook(() => usePropostaTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useDeleteTemplate", () => {
  it("marca deleted_at e invalida a lista", async () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteTemplate(), { wrapper });
    await act(() => result.current.mutateAsync("t1"));
    expect(sb.de("proposta_templates", "update")[0].args[0]).toEqual({ deleted_at: expect.any(String) });
    expect(sb.de("proposta_templates", "eq")[0].args).toEqual(["id", "t1"]);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["proposta-templates"] });
  });

  it("erro na exclusão propaga", async () => {
    sb.resultado("proposta_templates.update", { data: null, error: { message: "rls" } });
    const { result } = renderHook(() => useDeleteTemplate(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync("t1")).rejects.toEqual({ message: "rls" });
    });
  });
});

describe("useUploadTemplate: recusas antes de ler o Word", () => {
  const word = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  it.each([
    [new File(["x"], "modelo.pdf", { type: "application/pdf" }), "Envie um arquivo Word (.docx)."],
    [new File(["x"], "modelo.docx", { type: "application/msword" }), "Envie um arquivo Word (.docx)."],
  ])("arquivo que não é Word: %s", async (file, msg) => {
    const { result } = renderHook(() => useUploadTemplate(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ file, nome: "x" })).rejects.toThrow(msg);
    });
    expect(sb.client.rpc).not.toHaveBeenCalled();
  });

  it("usuário sem empresa não sobe nada", async () => {
    sb.rpcResultado("get_user_empresa_id", { data: null, error: null });
    const { result } = renderHook(() => useUploadTemplate(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ file: new File(["x"], "modelo.docx", { type: word }), nome: "x" })
      ).rejects.toThrow("Usuário não vinculado a uma empresa");
    });
    expect(sb.client.storage.from).not.toHaveBeenCalled();
  });
});

describe("downloadTemplateFile", () => {
  it("baixa o arquivo do storage como ArrayBuffer", async () => {
    const buffer = new ArrayBuffer(4);
    const download = vi.fn(async () => ({ data: { arrayBuffer: async () => buffer }, error: null }));
    vi.mocked(sb.client.storage.from).mockReturnValueOnce({ download } as never);
    await expect(downloadTemplateFile("e1/modelo.docx")).resolves.toBe(buffer);
    expect(sb.client.storage.from).toHaveBeenCalledWith("proposta-templates");
    expect(download).toHaveBeenCalledWith("e1/modelo.docx");
  });

  it("erro no download vira mensagem com o motivo", async () => {
    const download = vi.fn(async () => ({ data: null, error: { message: "not found" } }));
    vi.mocked(sb.client.storage.from).mockReturnValueOnce({ download } as never);
    await expect(downloadTemplateFile("x")).rejects.toThrow("Erro ao baixar template: not found");
  });
});
