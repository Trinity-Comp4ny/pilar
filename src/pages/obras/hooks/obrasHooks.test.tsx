import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";
import { parseCapacidadeError } from "@/lib/capacidade";

// Hooks de dados da obra contra o Supabase falso: o que vai para o banco, como cada
// leitura é montada e o que acontece com erro de servidor, RLS e limite de capacidade.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const clima = vi.hoisted(() => ({ buscarPrevisao: vi.fn() }));
vi.mock("@/pages/obras/lib/clima", async (original) => ({
  ...(await original<typeof import("@/pages/obras/lib/clima")>()),
  buscarPrevisao: (...a: unknown[]) => clima.buscarPrevisao(...a),
}));

import { useObras, useObra, useCreateObra, useUpdateObra, useDeleteObra } from "./useObras";
import { useObraFotos, useDeleteRdoFoto, useUploadRdoFoto } from "./useObraFotos";
import {
  assinarArquivos,
  useAtualizarRegistro,
  useCriarRegistro,
  useExcluirRegistro,
  useObraRegistros,
  useReprocessarRegistro,
  useVincularRegistrosRdo,
} from "./useObraRegistros";
import { useCreateObraTarefa, useDeleteObraTarefa, useObraTarefas, useUpdateObraTarefa } from "./useObraTarefas";
import { useObraRdoTarefas, useSaveRdoTarefas } from "./useObraRdoTarefas";
import { useCreateRdo, useDeleteRdo, useObraRdoAutores, useObraRdos, useUpdateRdo } from "./useObraRdo";
import { useObraRdoEfetivo, useSaveRdoEfetivo } from "./useObraRdoEfetivo";
import { useObraRdoImpedimentos, useSaveRdoImpedimentos } from "./useObraRdoImpedimentos";
import { useObraRdoVisitas, useSaveRdoVisitas } from "./useObraRdoVisitas";
import { useCampoAcessos } from "./useCampoAcessos";
import { useObraMedicoes } from "./useObraMedicoes";
import {
  etapasEmOrdem,
  useCreateFrente,
  useDeleteFrente,
  useObraEtapas,
  useObraFrentes,
  useUpdateFrente,
  type ObraFrenteRow,
} from "./useObraFrentes";
import {
  useDeleteMaterial,
  useDeleteMovimento,
  useObraEstoque,
  useSaveMaterial,
  useSaveMovimento,
} from "./useObraEstoque";
import { useConvitesCotacao, useCriarConvite, useRevogarConvite } from "./useCotacaoConvites";
import {
  useCotacoesPendentesEmpresa,
  useDeleteCotacao,
  useObraCotacoes,
  useSalvarPropostasEmLote,
  useSaveCotacao,
} from "./useObraCotacoes";
import { useCidadesSalvas } from "./useCidadesSalvas";
import { useAlertasClimaCronograma, useAlertasClimaObras } from "./useAlertasClima";

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidar = vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, invalidar, wrapper };
}

function hook<T>(fn: () => T) {
  const m = montar();
  return { ...m, ...renderHook(fn, { wrapper: m.wrapper }) };
}

const erro = (message: string, extra: Record<string, unknown> = {}) => ({ message, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  rpcComEmpresa();
});

describe("useObras / useObra", () => {
  it("lista as obras com o avanço calculado pelas tarefas", async () => {
    fake.responder((c) => {
      if (c.tabela === "obras")
        return {
          data: [
            { id: "o-1", nome: "Casa" },
            { id: "o-2", nome: "Galpão" },
          ],
          error: null,
        };
      if (c.tabela === "tarefas")
        return {
          data: [
            { obra_id: "o-1", status: "concluida" },
            { obra_id: "o-1", status: "pendente" },
            { obra_id: null, status: "pendente" },
          ],
          error: null,
        };
      return undefined;
    });
    const { result } = hook(() => useObras());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((o) => [o.id, o.avanco])).toEqual([
      ["o-1", 50],
      ["o-2", 0],
    ]);
  });

  it("erro nas tarefas derruba a lista", async () => {
    fake.responder((c) => (c.tabela === "tarefas" ? { data: null, error: erro("falhou") } : undefined));
    const { result } = hook(() => useObras());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("erro na leitura das obras derruba a lista", async () => {
    fake.responder((c) => (c.tabela === "obras" ? { data: null, error: erro("RLS") } : undefined));
    const { result } = hook(() => useObras());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("obra inexistente devolve null sem buscar tarefas", async () => {
    const { result } = hook(() => useObra("o-x"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(fake.chamadas.some((c) => c.tabela === "tarefas")).toBe(false);
  });

  it("obra existente vem com avanço", async () => {
    fake.responder((c) => {
      if (c.tabela === "obras") return { data: { id: "o-1", nome: "Casa" }, error: null };
      if (c.tabela === "tarefas") return { data: [{ status: "concluida" }], error: null };
      return undefined;
    });
    const { result } = hook(() => useObra("o-1"));
    await waitFor(() => expect(result.current.data?.avanco).toBe(100));
  });

  it("erro ao ler a obra ou suas tarefas vira erro da query", async () => {
    fake.responder((c) => {
      if (c.tabela === "obras") return { data: { id: "o-1" }, error: null };
      if (c.tabela === "tarefas") return { data: null, error: erro("x") };
      return undefined;
    });
    const { result } = hook(() => useObra("o-1"));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("sem id não busca", () => {
    hook(() => useObra(undefined));
    expect(fake.chamadas).toHaveLength(0);
  });

  it("criar obra grava com a empresa e invalida a lista", async () => {
    fake.responder((c) => (c.op === "insert" ? { data: { id: "o-novo" }, error: null } : undefined));
    const { result, invalidar } = hook(() => useCreateObra());
    await act(async () => {
      await result.current.mutateAsync({ nome: "Nova" } as never);
    });
    expect(fake.escritas("obras")[0].payload).toEqual({ nome: "Nova", empresa_id: "emp-1" });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["obras"] });
  });

  it("criar obra sem empresa vinculada é recusado antes do banco", async () => {
    fake.rpc.mockResolvedValue({ data: null, error: null });
    const { result } = hook(() => useCreateObra());
    await act(async () => {
      await expect(result.current.mutateAsync({ nome: "Nova" } as never)).rejects.toThrow(
        "Usuário não vinculado a uma empresa"
      );
    });
    expect(fake.escritas()).toHaveLength(0);
  });

  it("limite de obras do plano chega intacto (com hint) para a tela abrir o desbloqueio", async () => {
    fake.responder((c) =>
      c.op === "insert" ? { data: null, error: erro("capacidade:obras", { hint: "3", code: "P0001" }) } : undefined
    );
    const { result } = hook(() => useCreateObra());
    let capturado: unknown;
    await act(async () => {
      await result.current.mutateAsync({ nome: "Quarta" } as never).catch((e) => (capturado = e));
    });
    expect(parseCapacidadeError(capturado)).toEqual({ recurso: "obras", limite: 3 });
  });

  it("atualizar e excluir obra", async () => {
    fake.responder((c) => (c.op === "update" ? { data: { id: "o-1" }, error: null } : undefined));
    const { result: up } = hook(() => useUpdateObra());
    await act(async () => {
      await up.current.mutateAsync({ id: "o-1", nome: "Renomeada" });
    });
    expect(fake.escritas("obras")[0]).toMatchObject({ op: "update", payload: { nome: "Renomeada" } });

    const { result: del } = hook(() => useDeleteObra());
    await act(async () => {
      await del.current.mutateAsync("o-1");
    });
    expect(fake.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "obras", p_id: "o-1" });
  });

  it("excluir obra sem permissão propaga o erro", async () => {
    rpcComEmpresa({ rpc_soft_delete: { data: null, error: erro("permissão negada") } });
    const { result } = hook(() => useDeleteObra());
    await act(async () => {
      await expect(result.current.mutateAsync("o-1")).rejects.toMatchObject({ message: "permissão negada" });
    });
  });
});

describe("useObraFotos", () => {
  it("sem fotos não assina nada", async () => {
    const { result } = hook(() => useObraFotos("o-1"));
    await waitFor(() => expect(result.current.data).toEqual({}));
    expect(fake.supabase.storage.from).not.toHaveBeenCalled();
  });

  it("agrupa por rdo e descarta foto sem URL assinada", async () => {
    fake.responder((c) =>
      c.tabela === "obra_rdo_foto"
        ? {
            data: [
              { id: "f-1", rdo_id: "r-1", path: "a.jpg" },
              { id: "f-2", rdo_id: "r-1", path: "b.jpg" },
              { id: "f-3", rdo_id: "r-2", path: "c.jpg" },
            ],
            error: null,
          }
        : undefined
    );
    fake.supabase.storage.from.mockImplementationOnce(
      () =>
        ({
          createSignedUrls: async () => ({
            data: [
              { path: "a.jpg", signedUrl: "https://a" },
              { path: "b.jpg", signedUrl: null },
              { path: "c.jpg", signedUrl: "https://c" },
            ],
          }),
        }) as never
    );
    const { result } = hook(() => useObraFotos("o-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      "r-1": [{ id: "f-1", url: "https://a", path: "a.jpg" }],
      "r-2": [{ id: "f-3", url: "https://c", path: "c.jpg" }],
    });
  });

  it("erro na leitura vira erro da query", async () => {
    fake.responder(() => ({ data: null, error: erro("x") }));
    const { result } = hook(() => useObraFotos("o-1"));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("apagar foto remove do storage e do banco", async () => {
    const { result, invalidar } = hook(() => useDeleteRdoFoto("o-1"));
    await act(async () => {
      await result.current.mutateAsync({ id: "f-1", path: "a.jpg" });
    });
    expect(fake.escritas("obra_rdo_foto")[0].op).toBe("delete");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["obra_fotos", "o-1"] });
  });

  it("erro ao apagar o metadado propaga", async () => {
    fake.responder(() => ({ data: null, error: erro("RLS") }));
    const { result } = hook(() => useDeleteRdoFoto(undefined));
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "f-1", path: "a.jpg" })).rejects.toMatchObject({ message: "RLS" });
    });
  });

  describe("upload", () => {
    function prepararCanvas(blob: Blob | null) {
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn(async () => ({ width: 3200, height: 1600 }))
      );
      const drawImage = vi.fn();
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as never);
      vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb: BlobCallback) {
        cb(blob);
      });
      return { drawImage };
    }
    const arquivo = new File(["x"], "foto.png", { type: "image/png" });

    it("comprime para no máx. 1600px e registra a foto", async () => {
      const { drawImage } = prepararCanvas(new Blob(["jpg"], { type: "image/jpeg" }));
      const { result } = hook(() => useUploadRdoFoto());
      await act(async () => {
        await result.current.mutateAsync({ empresaId: "emp-1", obraId: "o-1", rdoId: "r-1", file: arquivo });
      });
      expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800);
      expect(fake.upload).toHaveBeenCalledWith(expect.stringMatching(/^emp-1\/o-1\/r-1\/.+\.jpg$/), expect.any(Blob), {
        contentType: "image/jpeg",
        upsert: false,
      });
      expect(fake.escritas("obra_rdo_foto")[0].payload).toEqual(
        expect.objectContaining({ empresa_id: "emp-1", obra_id: "o-1", rdo_id: "r-1" })
      );
      vi.unstubAllGlobals();
    });

    it("canvas sem blob falha antes de subir", async () => {
      prepararCanvas(null);
      const { result } = hook(() => useUploadRdoFoto());
      await act(async () => {
        await expect(
          result.current.mutateAsync({ empresaId: "emp-1", obraId: "o-1", rdoId: "r-1", file: arquivo })
        ).rejects.toThrow("Não foi possível processar a imagem");
      });
      expect(fake.upload).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("falha no upload não grava metadado", async () => {
      prepararCanvas(new Blob(["jpg"]));
      fake.upload.mockResolvedValueOnce({ data: null, error: erro("quota") });
      const { result } = hook(() => useUploadRdoFoto());
      await act(async () => {
        await expect(
          result.current.mutateAsync({ empresaId: "emp-1", obraId: "o-1", rdoId: "r-1", file: arquivo })
        ).rejects.toThrow("Falha ao subir a foto");
      });
      expect(fake.escritas()).toHaveLength(0);
      vi.unstubAllGlobals();
    });

    it("falha no registro desfaz o upload", async () => {
      prepararCanvas(new Blob(["jpg"]));
      fake.responder(() => ({ data: null, error: erro("RLS") }));
      const { result } = hook(() => useUploadRdoFoto());
      await act(async () => {
        await expect(
          result.current.mutateAsync({ empresaId: "emp-1", obraId: "o-1", rdoId: "r-1", file: arquivo })
        ).rejects.toThrow("Falha ao registrar a foto");
      });
      expect(fake.supabase.storage.from).toHaveBeenCalledTimes(2);
      vi.unstubAllGlobals();
    });
  });
});

describe("useObraRegistros", () => {
  it("lê os registros da obra", async () => {
    fake.responder(() => ({ data: [{ id: "reg-1", status: "pronto" }], error: null }));
    const { result } = hook(() => useObraRegistros("o-1"));
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(fake.chamadas[0].filtros).toContainEqual(["eq", "obra_id", "o-1"]);
  });

  it("erro na leitura vira erro da query", async () => {
    fake.responder(() => ({ data: null, error: erro("x") }));
    const { result } = hook(() => useObraRegistros("o-1"));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("atualizar registro grava só os campos e invalida", async () => {
    const { result, invalidar } = hook(() => useAtualizarRegistro("o-1"));
    await act(async () => {
      await result.current.mutateAsync({ id: "reg-1", visivel_cliente: true });
    });
    expect(fake.escritas("obra_registro")[0].payload).toEqual({ visivel_cliente: true });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["obra_registros", "o-1"] });
  });

  it("atualizar com erro propaga", async () => {
    fake.responder(() => ({ data: null, error: erro("RLS") }));
    const { result } = hook(() => useAtualizarRegistro("o-1"));
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "reg-1", texto_organizado: "x" })).rejects.toBeTruthy();
    });
  });

  it("criar registro manda texto, áudio e fotos em base64 para a edge", async () => {
    fake.invoke.mockResolvedValue({ data: { success: true }, error: null });
    const { result } = hook(() => useCriarRegistro("o-1"));
    await act(async () => {
      await result.current.mutateAsync({
        clientId: "c-1",
        data: "2026-11-07",
        texto: "concretagem",
        audio: { blob: new Blob(["aud"]), mimeType: "audio/webm;codecs=opus", duracaoS: 12 },
        fotos: [new Blob(["img"])],
      });
    });
    const [nome, opts] = fake.invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(nome).toBe("registro-criar");
    expect(opts.body).toEqual(
      expect.objectContaining({
        obra_id: "o-1",
        client_id: "c-1",
        texto: "concretagem",
        audio: expect.objectContaining({ mime_type: "audio/webm", duracao_s: 12 }),
        fotos: [expect.objectContaining({ content_type: "image/jpeg" })],
      })
    );
  });

  it("criar registro sem sucesso da edge lança a mensagem do servidor", async () => {
    const context = new Response(JSON.stringify({ error: "Obra arquivada" }), { status: 409 });
    fake.invoke.mockResolvedValue({ data: null, error: { context } });
    const { result } = hook(() => useCriarRegistro("o-1"));
    await act(async () => {
      await expect(result.current.mutateAsync({ clientId: "c", data: "2026-11-07", fotos: [] })).rejects.toThrow(
        "Obra arquivada"
      );
    });
  });

  it("vincular registros ao RDO não faz nada com lista vazia", async () => {
    const { result } = hook(() => useVincularRegistrosRdo("o-1"));
    await act(async () => {
      await result.current.mutateAsync({ rdoId: "r-1", registroIds: [] });
    });
    expect(fake.escritas()).toHaveLength(0);
    await act(async () => {
      await result.current.mutateAsync({ rdoId: "r-1", registroIds: ["reg-1", "reg-2"] });
    });
    expect(fake.escritas("obra_registro")[0]).toMatchObject({
      payload: { rdo_id: "r-1" },
      filtros: [["in", "id", ["reg-1", "reg-2"]]],
    });
  });

  it("vincular com erro propaga", async () => {
    fake.responder(() => ({ data: null, error: erro("x") }));
    const { result } = hook(() => useVincularRegistrosRdo("o-1"));
    await act(async () => {
      await expect(result.current.mutateAsync({ rdoId: "r", registroIds: ["a"] })).rejects.toBeTruthy();
    });
  });

  it("excluir apaga áudio, fotos e o registro", async () => {
    const { result } = hook(() => useExcluirRegistro("o-1"));
    await act(async () => {
      await result.current.mutateAsync({ id: "reg-1", audio_path: "a.webm", fotos: ["f.jpg"] });
    });
    expect(fake.supabase.storage.from).toHaveBeenCalledWith("obra-registro-audio");
    expect(fake.supabase.storage.from).toHaveBeenCalledWith("obra-campo");
    expect(fake.escritas("obra_registro")[0].op).toBe("delete");
  });

  it("excluir sem arquivos só apaga a linha; erro propaga", async () => {
    fake.responder(() => ({ data: null, error: erro("RLS") }));
    const { result } = hook(() => useExcluirRegistro("o-1"));
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "reg-1", audio_path: null, fotos: [] })).rejects.toBeTruthy();
    });
    expect(fake.supabase.storage.from).not.toHaveBeenCalled();
  });

  it("reprocessar chama a edge e invalida depois de um tempo", async () => {
    vi.useFakeTimers();
    const { result, invalidar } = hook(() => useReprocessarRegistro("o-1"));
    await act(async () => {
      await result.current.mutateAsync("reg-1");
    });
    expect(fake.invoke).toHaveBeenCalledWith("registro-reprocessar", { body: { registro_id: "reg-1" } });
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ["obra_registros", "o-1"] });
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["obra_registros", "o-1"] });
    vi.useRealTimers();
  });

  it("reprocessar com erro propaga", async () => {
    fake.invoke.mockResolvedValue({ data: null, error: erro("limite") });
    const { result } = hook(() => useReprocessarRegistro("o-1"));
    await act(async () => {
      await expect(result.current.mutateAsync("reg-1")).rejects.toMatchObject({ message: "limite" });
    });
  });

  it("assinarArquivos: vazio, sucesso e erro", async () => {
    expect(await assinarArquivos("b", [])).toEqual([]);
    fake.supabase.storage.from.mockImplementationOnce(
      () =>
        ({
          createSignedUrls: async () => ({ data: [{ signedUrl: "https://1" }, { signedUrl: null }], error: null }),
        }) as never
    );
    expect(await assinarArquivos("b", ["1", "2"])).toEqual(["https://1"]);
    fake.supabase.storage.from.mockImplementationOnce(
      () => ({ createSignedUrls: async () => ({ data: null, error: null }) }) as never
    );
    await expect(assinarArquivos("b", ["1"])).rejects.toThrow("Não deu para abrir o arquivo");
  });
});

describe("useObraTarefas", () => {
  it("lista as tarefas da obra", async () => {
    fake.responder(() => ({ data: [{ id: "t-1" }], error: null }));
    const { result } = hook(() => useObraTarefas("o-1"));
    await waitFor(() => expect(result.current.data).toEqual([{ id: "t-1" }]));
  });

  it("erro vira erro da query", async () => {
    fake.responder(() => ({ data: null, error: erro("x") }));
    const { result } = hook(() => useObraTarefas("o-1"));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("criar tarefa herda o projeto da obra e invalida o Meu trabalho", async () => {
    fake.responder((c) => (c.op === "insert" ? { data: { id: "t-novo" }, error: null } : undefined));
    const { result, invalidar } = hook(() => useCreateObraTarefa("o-1", "proj-1"));
    await act(async () => {
      await result.current.mutateAsync({ titulo: "Armar laje", obra_frente_id: "f-1" });
    });
    expect(fake.escritas("tarefas")[0].payload).toEqual({
      empresa_id: "emp-1",
      obra_id: "o-1",
      projeto_id: "proj-1",
      obra_frente_id: "f-1",
      titulo: "Armar laje",
      responsavel_id: null,
      data_inicio: null,
      prazo: null,
    });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["meu-trabalho", "tarefas"] });
  });

  it("criar tarefa sem empresa é recusado", async () => {
    fake.rpc.mockResolvedValue({ data: null, error: null });
    const { result } = hook(() => useCreateObraTarefa("o-1", null));
    await act(async () => {
      await expect(result.current.mutateAsync({ titulo: "x", obra_frente_id: null })).rejects.toThrow(
        "Usuário não vinculado"
      );
    });
  });

  it("atualizar é otimista e desfaz se o banco recusa", async () => {
    const m = montar();
    m.qc.setQueryData(["obra_tarefas", "o-1"], [{ id: "t-1", status: "pendente" }]);
    fake.responder(() => ({ data: null, error: erro("RLS") }));
    const { result } = renderHook(() => useUpdateObraTarefa("o-1"), { wrapper: m.wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "t-1", status: "concluida" }).catch(() => {});
    });
    expect(m.qc.getQueryData(["obra_tarefas", "o-1"])).toEqual([{ id: "t-1", status: "pendente" }]);
  });

  it("atualizar com sucesso aplica o patch no cache", async () => {
    const m = montar();
    m.qc.setQueryData(
      ["obra_tarefas", "o-1"],
      [
        { id: "t-1", status: "pendente" },
        { id: "t-2", status: "x" },
      ]
    );
    const { result } = renderHook(() => useUpdateObraTarefa("o-1"), { wrapper: m.wrapper });
    let promessa: Promise<void> | undefined;
    act(() => {
      promessa = result.current.mutateAsync({ id: "t-1", status: "concluida" });
    });
    await waitFor(() =>
      expect(m.qc.getQueryData(["obra_tarefas", "o-1"])).toEqual([
        { id: "t-1", status: "concluida" },
        { id: "t-2", status: "x" },
      ])
    );
    await act(async () => {
      await promessa;
    });
    expect(fake.escritas("tarefas")[0].payload).toEqual({ status: "concluida" });
  });

  it("excluir tarefa e erro", async () => {
    const { result } = hook(() => useDeleteObraTarefa("o-1"));
    await act(async () => {
      await result.current.mutateAsync("t-1");
    });
    expect(fake.escritas("tarefas")[0].op).toBe("delete");
    fake.responder(() => ({ data: null, error: erro("x") }));
    await act(async () => {
      await expect(result.current.mutateAsync("t-1")).rejects.toBeTruthy();
    });
  });
});

describe("RDO e suas tabelas-ponte", () => {
  it("lista RDOs, autores e vínculos", async () => {
    fake.responder((c) => {
      if (c.tabela === "obra_rdo") return { data: [{ id: "r-1", created_by: "u-1" }], error: null };
      if (c.tabela === "profiles")
        return {
          data: [
            { id: "u-1", nome: "Ana", first_name: null },
            { id: "u-2", nome: null, first_name: "Bia" },
            { id: "u-3", nome: null, first_name: null },
          ],
          error: null,
        };
      return { data: [{ id: "x" }], error: null };
    });
    const { result } = hook(() => ({
      rdos: useObraRdos("o-1"),
      autores: useObraRdoAutores([{ created_by: "u-2" }, { created_by: "u-1" }, { created_by: null }] as never),
      tarefas: useObraRdoTarefas("o-1"),
      efetivo: useObraRdoEfetivo("o-1"),
      imped: useObraRdoImpedimentos("o-1"),
      visitas: useObraRdoVisitas("o-1"),
      medicoes: useObraMedicoes("o-1"),
    }));
    await waitFor(() => expect(result.current.medicoes.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.autores.data).toEqual({ "u-1": "Ana", "u-2": "Bia", "u-3": "Alguém" }));
    expect(result.current.rdos.data).toHaveLength(1);
    expect(result.current.tarefas.data).toEqual([{ id: "x" }]);
    expect(result.current.efetivo.data).toEqual([{ id: "x" }]);
    expect(result.current.imped.data).toEqual([{ id: "x" }]);
    expect(result.current.visitas.data).toEqual([{ id: "x" }]);
  });

  it("medições são agrupadas por RDO", async () => {
    fake.responder(() => ({
      data: [
        { id: "m-1", rdo_id: "r-1", item: "Concreto", quantidade: 5, unidade: "m³" },
        { id: "m-2", rdo_id: "r-1", item: "Aço", quantidade: 100, unidade: "kg" },
        { id: "m-3", rdo_id: "r-2", item: "Forma", quantidade: 10, unidade: "m²" },
      ],
      error: null,
    }));
    const { result } = hook(() => useObraMedicoes("o-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Object.keys(result.current.data!)).toEqual(["r-1", "r-2"]);
    expect(result.current.data!["r-1"]).toHaveLength(2);
  });

  it("erro em cada leitura vira erro da query", async () => {
    fake.responder(() => ({ data: null, error: erro("x") }));
    const { result } = hook(() => ({
      rdos: useObraRdos("o-1"),
      autores: useObraRdoAutores([{ created_by: "u-1" }] as never),
      tarefas: useObraRdoTarefas("o-1"),
      efetivo: useObraRdoEfetivo("o-1"),
      imped: useObraRdoImpedimentos("o-1"),
      visitas: useObraRdoVisitas("o-1"),
      medicoes: useObraMedicoes("o-1"),
    }));
    await waitFor(() =>
      expect(Object.values(result.current).every((q) => (q as { isError: boolean }).isError)).toBe(true)
    );
  });

  it("criar, atualizar e excluir RDO", async () => {
    fake.responder((c) =>
      c.op === "insert" || c.op === "update" ? { data: { id: "r-1", obra_id: "o-1" }, error: null } : undefined
    );
    const { result, invalidar } = hook(() => ({ c: useCreateRdo(), u: useUpdateRdo(), d: useDeleteRdo("o-1") }));
    await act(async () => {
      await result.current.c.mutateAsync({ obra_id: "o-1", data: "2026-11-07" } as never);
      await result.current.u.mutateAsync({ id: "r-1", clima_manha: "sol" } as never);
      await result.current.d.mutateAsync("r-1");
    });
    expect(fake.escritas("obra_rdo").map((e) => e.op)).toEqual(["insert", "update", "delete"]);
    expect(fake.escritas("obra_rdo")[0].payload).toEqual({ obra_id: "o-1", data: "2026-11-07", empresa_id: "emp-1" });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["obra_rdo", "o-1"] });
  });

  it("criar RDO sem empresa e com erro do banco", async () => {
    fake.rpc.mockResolvedValueOnce({ data: null, error: null });
    const { result } = hook(() => ({ c: useCreateRdo(), u: useUpdateRdo(), d: useDeleteRdo("o-1") }));
    await act(async () => {
      await expect(result.current.c.mutateAsync({ obra_id: "o-1" } as never)).rejects.toThrow("Usuário não vinculado");
    });
    fake.responder(() => ({ data: null, error: erro("RLS") }));
    await act(async () => {
      await expect(result.current.c.mutateAsync({ obra_id: "o-1" } as never)).rejects.toBeTruthy();
      await expect(result.current.u.mutateAsync({ id: "r-1" } as never)).rejects.toBeTruthy();
      await expect(result.current.d.mutateAsync("r-1")).rejects.toBeTruthy();
    });
  });

  it("salvar tarefas do dia substitui vínculos e aplica o efeito no cronograma", async () => {
    const { result, invalidar } = hook(() => useSaveRdoTarefas());
    await act(async () => {
      await result.current.mutateAsync({
        rdoId: "r-1",
        obraId: "o-1",
        entradas: [
          { tarefa_id: "t-1", resultado: "concluiu", observacao: "  ok " },
          { tarefa_id: "t-2", resultado: "parou" },
          { tarefa_id: "t-3", resultado: "avancou", observacao: "   " },
        ],
      });
    });
    const esc = fake.escritas();
    expect(esc.map((e) => `${e.tabela}:${e.op}`)).toEqual([
      "obra_rdo_tarefa:delete",
      "obra_rdo_tarefa:insert",
      "tarefas:update",
      "tarefas:update",
      "tarefas:update",
    ]);
    expect(esc[1].payload).toEqual([
      expect.objectContaining({ tarefa_id: "t-1", observacao: "ok" }),
      expect.objectContaining({ tarefa_id: "t-2", observacao: null }),
      expect.objectContaining({ tarefa_id: "t-3", observacao: null }),
    ]);
    expect(esc[2].payload).toEqual({ status: "concluida", sinalizada: false });
    expect(esc[3].payload).toEqual({ sinalizada: true });
    expect(esc[4].payload).toEqual({ sinalizada: false });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["obra_tarefas", "o-1"] });
  });

  it("salvar tarefas sem entradas só limpa; erros em cada etapa propagam", async () => {
    const { result } = hook(() => useSaveRdoTarefas());
    await act(async () => {
      await result.current.mutateAsync({ rdoId: "r-1", obraId: "o-1", entradas: [] });
    });
    expect(fake.escritas()).toHaveLength(1);

    for (const alvo of ["delete", "insert"] as const) {
      fake.responder((c) =>
        c.tabela === "obra_rdo_tarefa" && c.op === alvo ? { data: null, error: erro(alvo) } : undefined
      );
      await act(async () => {
        await expect(
          result.current.mutateAsync({ rdoId: "r", obraId: "o", entradas: [{ tarefa_id: "t", resultado: "avancou" }] })
        ).rejects.toMatchObject({ message: alvo });
      });
    }
    fake.responder((c) => (c.tabela === "tarefas" ? { data: null, error: erro("tarefas") } : undefined));
    for (const resultado of ["concluiu", "parou", "avancou"] as const) {
      await act(async () => {
        await expect(
          result.current.mutateAsync({ rdoId: "r", obraId: "o", entradas: [{ tarefa_id: "t", resultado }] })
        ).rejects.toMatchObject({ message: "tarefas" });
      });
    }
    fake.rpc.mockResolvedValue({ data: null, error: null });
    await act(async () => {
      await expect(result.current.mutateAsync({ rdoId: "r", obraId: "o", entradas: [] })).rejects.toThrow(
        "Usuário não vinculado"
      );
    });
  });

  it.each([
    [
      "efetivo",
      () => useSaveRdoEfetivo(),
      "obra_rdo_efetivo",
      { fornecedor_nome: "  Equipe A ", quantidade: 4 },
      {
        fornecedor_id: null,
        fornecedor_nome: "Equipe A",
        quantidade: 4,
      },
    ],
    [
      "impedimentos",
      () => useSaveRdoImpedimentos(),
      "obra_rdo_impedimento",
      { descricao: " chuva ", tipo: "clima" },
      {
        descricao: "chuva",
        tipo: "clima",
      },
    ],
    [
      "visitas",
      () => useSaveRdoVisitas(),
      "obra_rdo_visita",
      { fornecedor_id: "forn-1", observacao: " entregou " },
      {
        fornecedor_id: "forn-1",
        fornecedor_nome: null,
        observacao: "entregou",
      },
    ],
  ])("salvar %s substitui as linhas do dia", async (_n, usar, tabela, entrada, esperado) => {
    const { result } = hook(usar as () => ReturnType<typeof useSaveRdoEfetivo>);
    await act(async () => {
      await result.current.mutateAsync({ rdoId: "r-1", obraId: "o-1", entradas: [entrada as never] });
    });
    const esc = fake.escritas(tabela);
    expect(esc.map((e) => e.op)).toEqual(["delete", "insert"]);
    expect(esc[1].payload).toEqual([expect.objectContaining({ empresa_id: "emp-1", rdo_id: "r-1", ...esperado })]);

    await act(async () => {
      await result.current.mutateAsync({ rdoId: "r-1", obraId: "o-1", entradas: [] });
    });
    expect(fake.escritas(tabela)).toHaveLength(3);

    for (const alvo of ["delete", "insert"]) {
      fake.responder((c) => (c.op === alvo ? { data: null, error: erro(alvo) } : undefined));
      await act(async () => {
        await expect(
          result.current.mutateAsync({ rdoId: "r", obraId: "o", entradas: [entrada as never] })
        ).rejects.toMatchObject({ message: alvo });
      });
    }
    fake.rpc.mockResolvedValue({ data: null, error: null });
    await act(async () => {
      await expect(result.current.mutateAsync({ rdoId: "r", obraId: "o", entradas: [] })).rejects.toThrow(
        "Usuário não vinculado"
      );
    });
  });
});

describe("useCampoAcessos", () => {
  it("lista os acessos e revoga", async () => {
    rpcComEmpresa({ campo_listar_contas_obra: { data: [{ id: "a-1", nome: "Zé" }], error: null } });
    const { result, invalidar } = hook(() => useCampoAcessos("o-1"));
    await waitFor(() => expect(result.current.acessos).toHaveLength(1));
    await act(async () => {
      await result.current.revogar.mutateAsync("a-1");
    });
    expect(fake.rpc).toHaveBeenCalledWith("campo_revogar_acesso", { p_account_id: "a-1" });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["campo-acessos", "o-1"] });
  });

  it("erro de permissão na lista deixa vazio; erro ao revogar propaga", async () => {
    rpcComEmpresa({
      campo_listar_contas_obra: { data: null, error: erro("permission denied") },
      campo_revogar_acesso: { data: null, error: erro("permission denied") },
    });
    const { result } = hook(() => useCampoAcessos("o-1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.acessos).toEqual([]);
    await act(async () => {
      await expect(result.current.revogar.mutateAsync("a-1")).rejects.toMatchObject({ message: "permission denied" });
    });
  });
});

describe("useObraFrentes", () => {
  const nos = [
    { id: "e-2", nivel: "etapa", parent_id: "f-1", ordem: 2, created_at: "2026-01-01" },
    { id: "f-2", nivel: "fase", parent_id: null, ordem: 2, created_at: "2026-01-01" },
    { id: "e-3", nivel: "etapa", parent_id: "f-2", ordem: 1, created_at: "2026-01-01" },
    { id: "f-1", nivel: "fase", parent_id: null, ordem: 1, created_at: "2026-01-01" },
    { id: "e-1", nivel: "etapa", parent_id: "f-1", ordem: 1, created_at: "2026-01-02" },
    { id: "e-0", nivel: "etapa", parent_id: "f-1", ordem: 1, created_at: "2026-01-01" },
    { id: "s-1", nivel: "servico", parent_id: "e-1", ordem: 1, created_at: "2026-01-01" },
  ] as unknown as ObraFrenteRow[];

  it("etapas em ordem de fase, etapa e criação", () => {
    expect(etapasEmOrdem(nos).map((n) => n.id)).toEqual(["e-0", "e-1", "e-2", "e-3"]);
  });

  it("lê nós e etapas do mesmo cache", async () => {
    fake.responder(() => ({ data: nos, error: null }));
    const { result } = hook(() => ({ todos: useObraFrentes("o-1"), etapas: useObraEtapas("o-1") }));
    await waitFor(() => expect(result.current.etapas.data).toHaveLength(4));
    expect(result.current.todos.data).toHaveLength(7);
  });

  it("erro de leitura", async () => {
    fake.responder(() => ({ data: null, error: erro("x") }));
    const { result } = hook(() => useObraFrentes("o-1"));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("criar, atualizar e excluir nó", async () => {
    fake.responder((c) => (c.op === "insert" ? { data: { id: "n-1" }, error: null } : undefined));
    const { result, invalidar } = hook(() => ({
      c: useCreateFrente("o-1"),
      u: useUpdateFrente("o-1"),
      d: useDeleteFrente("o-1"),
    }));
    await act(async () => {
      await result.current.c.mutateAsync({ nome: "Fundação", ordem: 1, nivel: "fase", parent_id: null });
      await result.current.u.mutateAsync({ id: "n-1", nome: "Fundações" });
      await result.current.d.mutateAsync("n-1");
    });
    expect(fake.escritas("obra_frente").map((e) => e.op)).toEqual(["insert", "update", "delete"]);
    expect(fake.escritas("obra_frente")[1].payload).toEqual({ nome: "Fundações" });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["obra_tarefas", "o-1"] });
  });

  it("erros de escrita e empresa ausente", async () => {
    const { result } = hook(() => ({
      c: useCreateFrente("o-1"),
      u: useUpdateFrente("o-1"),
      d: useDeleteFrente("o-1"),
    }));
    fake.rpc.mockResolvedValueOnce({ data: null, error: null });
    await act(async () => {
      await expect(
        result.current.c.mutateAsync({ nome: "x", ordem: 1, nivel: "fase", parent_id: null })
      ).rejects.toThrow("Usuário não vinculado");
    });
    fake.responder(() => ({ data: null, error: erro("RLS") }));
    await act(async () => {
      await expect(
        result.current.c.mutateAsync({ nome: "x", ordem: 1, nivel: "fase", parent_id: null })
      ).rejects.toBeTruthy();
      await expect(result.current.u.mutateAsync({ id: "n" })).rejects.toBeTruthy();
      await expect(result.current.d.mutateAsync("n")).rejects.toBeTruthy();
    });
  });
});

describe("useObraEstoque", () => {
  it("filtra movimentos removidos e ordena do mais novo", async () => {
    fake.responder(() => ({
      data: [
        {
          id: "m-1",
          movimentos: [
            { id: "a", data: "2026-01-01", deleted_at: null },
            { id: "b", data: "2026-03-01", deleted_at: null },
            { id: "c", data: "2026-02-01", deleted_at: "2026-02-02" },
            { id: "d", data: "2026-03-01", deleted_at: null },
          ],
        },
        { id: "m-2", movimentos: null },
      ],
      error: null,
    }));
    const { result } = hook(() => useObraEstoque("o-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].movimentos.map((m) => m.id)).toEqual(["b", "d", "a"]);
    expect(result.current.data![1].movimentos).toEqual([]);
  });

  it("erro de leitura", async () => {
    fake.responder(() => ({ data: null, error: erro("x") }));
    const { result } = hook(() => useObraEstoque("o-1"));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("salvar material novo e existente", async () => {
    fake.responder((c) => (c.op === "insert" ? { data: { id: "mat-novo" }, error: null } : undefined));
    const { result } = hook(() => useSaveMaterial("o-1"));
    let id: string | undefined;
    await act(async () => {
      id = await result.current.mutateAsync({ nome: "Areia", unidade: "m³" });
    });
    expect(id).toBe("mat-novo");
    await act(async () => {
      id = await result.current.mutateAsync({ id: "mat-1", nome: "Areia fina", unidade: "m³" });
    });
    expect(id).toBe("mat-1");
    expect(fake.escritas("obra_material").map((e) => e.op)).toEqual(["insert", "update"]);
  });

  it("salvar material: sem empresa e erro do banco", async () => {
    const { result } = hook(() => useSaveMaterial("o-1"));
    fake.rpc.mockResolvedValueOnce({ data: null, error: null });
    await act(async () => {
      await expect(result.current.mutateAsync({ nome: "x", unidade: "u" })).rejects.toThrow("Usuário não vinculado");
    });
    fake.responder(() => ({ data: null, error: erro("RLS") }));
    await act(async () => {
      await expect(result.current.mutateAsync({ nome: "x", unidade: "u" })).rejects.toBeTruthy();
      await expect(result.current.mutateAsync({ id: "m", nome: "x", unidade: "u" })).rejects.toBeTruthy();
    });
  });

  it("editar movimento de baixa zera o valor unitário", async () => {
    const { result } = hook(() => useSaveMovimento("o-1"));
    await act(async () => {
      await result.current.mutateAsync({
        id: "mv-1",
        obra_material_id: "m-1",
        tipo: "baixa",
        quantidade: 2,
        data: "2026-11-07",
        valor_unitario: 99,
      });
    });
    expect(fake.escritas("obra_material_mov")[0]).toMatchObject({ op: "update", payload: { valor_unitario: null } });
    fake.responder(() => ({ data: null, error: erro("x") }));
    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: "mv-1", obra_material_id: "m", tipo: "entrada", quantidade: 1, data: "d" })
      ).rejects.toBeTruthy();
    });
  });

  it("excluir material e movimento usam o soft delete por RPC", async () => {
    const { result } = hook(() => ({ m: useDeleteMaterial("o-1"), mv: useDeleteMovimento("o-1") }));
    await act(async () => {
      await result.current.m.mutateAsync("m-1");
      await result.current.mv.mutateAsync("mv-1");
    });
    expect(fake.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "obra_material", p_id: "m-1" });
    expect(fake.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "obra_material_mov", p_id: "mv-1" });
    rpcComEmpresa({ rpc_soft_delete: { data: null, error: erro("negado") } });
    await act(async () => {
      await expect(result.current.m.mutateAsync("m-1")).rejects.toBeTruthy();
      await expect(result.current.mv.mutateAsync("mv-1")).rejects.toBeTruthy();
    });
  });
});

describe("convites e cotações", () => {
  it("lista, cria e revoga convites", async () => {
    fake.responder(() => ({ data: [{ id: "cv-1" }], error: null }));
    rpcComEmpresa({ rpc_criar_convite_cotacao: { data: { token: "tok", fornecedor_id: "f-1" }, error: null } });
    const { result, invalidar } = hook(() => ({
      lista: useConvitesCotacao("cot-1"),
      criar: useCriarConvite("cot-1", "o-1"),
      revogar: useRevogarConvite("cot-1"),
    }));
    await waitFor(() => expect(result.current.lista.data).toEqual([{ id: "cv-1" }]));
    let r: unknown;
    await act(async () => {
      r = await result.current.criar.mutateAsync({ fornecedorId: null, fornecedorNome: "Novo", validadeDias: 7 });
      await result.current.revogar.mutateAsync("cv-1");
    });
    expect(r).toEqual({ token: "tok", fornecedor_id: "f-1" });
    expect(fake.rpc).toHaveBeenCalledWith("rpc_criar_convite_cotacao", {
      p_cotacao_id: "cot-1",
      p_fornecedor_id: undefined,
      p_fornecedor_nome: "Novo",
      p_validade_dias: 7,
    });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["obra_cotacao", "o-1"] });
  });

  it("erros de convite propagam", async () => {
    fake.responder(() => ({ data: null, error: erro("x") }));
    rpcComEmpresa({
      rpc_criar_convite_cotacao: { data: null, error: erro("cotação fechada") },
      rpc_revogar_convite_cotacao: { data: null, error: erro("já respondido") },
    });
    const { result } = hook(() => ({
      lista: useConvitesCotacao("cot-1"),
      criar: useCriarConvite("cot-1", "o-1"),
      revogar: useRevogarConvite("cot-1"),
    }));
    await waitFor(() => expect(result.current.lista.isError).toBe(true));
    await act(async () => {
      await expect(
        result.current.criar.mutateAsync({ fornecedorId: "f", fornecedorNome: null, validadeDias: 3 })
      ).rejects.toMatchObject({ message: "cotação fechada" });
      await expect(result.current.revogar.mutateAsync("cv")).rejects.toMatchObject({ message: "já respondido" });
    });
  });

  it("cotações da obra filtram propostas removidas e ordenam itens", async () => {
    fake.responder(() => ({
      data: [
        {
          id: "cot-1",
          propostas: [
            { id: "p-1", deleted_at: null, itens: [{ ordem: 2 }, { ordem: 0 }] },
            { id: "p-2", deleted_at: "2026-01-01", itens: [] },
            { id: "p-3", deleted_at: null, itens: null },
          ],
        },
        { id: "cot-2", propostas: null },
      ],
      error: null,
    }));
    const { result } = hook(() => useObraCotacoes("o-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].propostas.map((p) => p.id)).toEqual(["p-1", "p-3"]);
    expect(result.current.data![0].propostas[0].itens.map((i) => i.ordem)).toEqual([0, 2]);
    expect(result.current.data![1].propostas).toEqual([]);
  });

  it("pendentes da empresa trazem o nome da obra ou 'Obra removida'", async () => {
    fake.responder(() => ({
      data: [
        {
          id: "c-1",
          obra_id: "o-1",
          descricao: "Aço",
          prazo_necessidade: null,
          created_at: "x",
          obras: { nome: "Casa" },
        },
        { id: "c-2", obra_id: "o-2", descricao: "Brita", prazo_necessidade: null, created_at: "y", obras: null },
      ],
      error: null,
    }));
    const { result } = hook(() => useCotacoesPendentesEmpresa());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.map((c) => c.obra_nome)).toEqual(["Casa", "Obra removida"]);
  });

  it("erros de leitura das cotações", async () => {
    fake.responder(() => ({ data: null, error: erro("x") }));
    const { result } = hook(() => ({ a: useObraCotacoes("o-1"), b: useCotacoesPendentesEmpresa() }));
    await waitFor(() => expect(result.current.a.isError && result.current.b.isError).toBe(true));
  });

  it("salvar cotação: nova, edição, sem empresa e erro", async () => {
    const { result } = hook(() => useSaveCotacao("o-1"));
    await act(async () => {
      await result.current.mutateAsync({ descricao: "Aço CA-50" });
      await result.current.mutateAsync({ id: "cot-1", descricao: "Aço CA-60" });
    });
    expect(fake.escritas("obra_cotacao").map((e) => e.op)).toEqual(["insert", "update"]);
    expect(fake.escritas("obra_cotacao")[0].payload).toEqual({
      descricao: "Aço CA-50",
      empresa_id: "emp-1",
      obra_id: "o-1",
    });
    fake.rpc.mockResolvedValueOnce({ data: null, error: null });
    await act(async () => {
      await expect(result.current.mutateAsync({ descricao: "x" })).rejects.toThrow("Usuário não vinculado");
    });
    fake.responder(() => ({ data: null, error: erro("x") }));
    await act(async () => {
      await expect(result.current.mutateAsync({ descricao: "x" })).rejects.toBeTruthy();
      await expect(result.current.mutateAsync({ id: "c", descricao: "x" })).rejects.toBeTruthy();
    });
  });

  it("excluir cotação com erro propaga", async () => {
    rpcComEmpresa({ rpc_soft_delete: { data: null, error: erro("negado") } });
    const { result } = hook(() => useDeleteCotacao("o-1"));
    await act(async () => {
      await expect(result.current.mutateAsync("cot-1")).rejects.toMatchObject({ message: "negado" });
    });
  });

  it("lote vazio de propostas não toca no banco", async () => {
    const { result } = hook(() => useSalvarPropostasEmLote("o-1", "cot-1"));
    await act(async () => {
      await result.current.mutateAsync([]);
    });
    expect(fake.rpc).not.toHaveBeenCalled();
    fake.rpc.mockResolvedValueOnce({ data: null, error: null });
    await act(async () => {
      await expect(
        result.current.mutateAsync([
          {
            fornecedor_nome: "x",
            quantidade: null,
            unidade: null,
            valor_a_vista: 1,
            valor_parcelado: null,
            condicao_pagamento: null,
            confianca: 1,
          },
        ])
      ).rejects.toThrow("Usuário não vinculado");
    });
  });
});

describe("useCidadesSalvas", () => {
  beforeEach(() => localStorage.clear());

  it("começa vazio, adiciona sem duplicar e remove", () => {
    const { result } = renderHook(() => useCidadesSalvas());
    expect(result.current.cidades).toEqual([]);
    const sp = { label: "São Paulo", latitude: -23.55, longitude: -46.63 };
    act(() => result.current.adicionar(sp));
    act(() => result.current.adicionar({ ...sp, label: "SP de novo", latitude: -23.551 }));
    expect(result.current.cidades).toEqual([sp]);
    expect(result.current.salva({ latitude: -23.55, longitude: -46.63 })).toBe(true);
    expect(JSON.parse(localStorage.getItem("pilar.clima.cidades")!)).toEqual([sp]);
    act(() => result.current.remover(sp));
    expect(result.current.cidades).toEqual([]);
  });

  it("guarda no máximo 8, a mais nova primeiro", () => {
    const { result } = renderHook(() => useCidadesSalvas());
    for (let i = 0; i < 10; i++) {
      act(() => result.current.adicionar({ label: `C${i}`, latitude: i, longitude: i }));
    }
    expect(result.current.cidades).toHaveLength(8);
    expect(result.current.cidades[0].label).toBe("C9");
  });

  it("ignora conteúdo corrompido ou inválido no storage", () => {
    localStorage.setItem("pilar.clima.cidades", "{nao-json");
    expect(renderHook(() => useCidadesSalvas()).result.current.cidades).toEqual([]);
    localStorage.setItem("pilar.clima.cidades", JSON.stringify({ a: 1 }));
    expect(renderHook(() => useCidadesSalvas()).result.current.cidades).toEqual([]);
    localStorage.setItem(
      "pilar.clima.cidades",
      JSON.stringify([{ label: "Ok", latitude: 1, longitude: 2 }, { label: "Ruim", latitude: "1" }, null])
    );
    expect(renderHook(() => useCidadesSalvas()).result.current.cidades).toEqual([
      { label: "Ok", latitude: 1, longitude: 2 },
    ]);
  });
});

describe("alertas de clima", () => {
  const dia = (o: Partial<{ chuvaProb: number; code: number; ventoMax: number; data: string }>) => ({
    data: "2026-11-07",
    chuvaProb: 0,
    code: 0,
    ventoMax: 5,
    ...o,
  });

  it("Radar: chuva amanhã e vento hoje viram alertas por obra", async () => {
    fake.responder(() => ({
      data: [
        { id: "o-1", nome: "Casa", cidade: "Campinas", latitude: 1, longitude: 2 },
        { id: "o-2", nome: "Galpão", cidade: null, latitude: 3, longitude: 4 },
      ],
      error: null,
    }));
    clima.buscarPrevisao.mockImplementation(async (lat: number) =>
      lat === 1
        ? { dias: [dia({ ventoMax: 80 }), dia({ chuvaProb: 70 }), dia({ chuvaProb: 100 })] }
        : { dias: [dia({}), dia({})] }
    );
    const { result } = hook(() => useAlertasClimaObras(true));
    await waitFor(() => expect(result.current.alertas).toHaveLength(2));
    expect(result.current.alertas).toEqual([
      expect.objectContaining({ obraId: "o-1", tipo: "chuva", quando: "amanhã", label: "chuva amanhã (70%)" }),
      expect.objectContaining({ obraId: "o-1", tipo: "vento", quando: "hoje", label: "vento 80 km/h hoje" }),
    ]);
    expect(result.current.isLoading).toBe(false);
  });

  it("desligado não busca nada", () => {
    const { result } = hook(() => useAlertasClimaObras(false));
    expect(result.current).toEqual({ alertas: [], isLoading: false });
    expect(fake.chamadas).toHaveLength(0);
  });

  it("erro ao listar obras deixa o Radar vazio", async () => {
    fake.responder(() => ({ data: null, error: erro("x") }));
    const { result } = hook(() => useAlertasClimaObras(true));
    await waitFor(() => expect(fake.chamadas.length).toBeGreaterThan(0));
    expect(result.current.alertas).toEqual([]);
  });

  it("cronograma: sem coordenada não busca previsão", () => {
    const { result } = hook(() => useAlertasClimaCronograma(null, null, []));
    expect(result.current).toEqual([]);
    expect(clima.buscarPrevisao).not.toHaveBeenCalled();
  });

  it("cronograma: com coordenada cruza as tarefas sensíveis com a previsão", async () => {
    clima.buscarPrevisao.mockResolvedValue({ dias: [dia({ chuvaProb: 90 })] });
    const tarefas = [
      {
        id: "t-1",
        titulo: "Concretar laje",
        sensivel_clima: "concretagem",
        data_inicio: "2026-11-07",
        prazo: "2026-11-07",
        status: "pendente",
      },
    ];
    const { result } = hook(() => useAlertasClimaCronograma(1, 2, tarefas as never));
    await waitFor(() => expect(clima.buscarPrevisao).toHaveBeenCalledWith(1, 2));
    await waitFor(() =>
      expect(result.current).toEqual([
        expect.objectContaining({ tarefaId: "t-1", motivo: "chuva", data: "2026-11-07" }),
      ])
    );
  });
});
