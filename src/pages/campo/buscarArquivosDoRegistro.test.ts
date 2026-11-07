import { beforeEach, describe, expect, it, vi } from "vitest";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// URLs assinadas das fotos e do áudio de um registro próprio do Pilar Campo:
// exige sessão, traduz 401 em "entre de novo" e o resto em "confira o sinal".

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));

import { buscarArquivosDoRegistro } from "./buscarArquivosDoRegistro";
import { setCampoToken } from "./useCampoAuth";

const invoke = () => vi.mocked(sb.client.functions.invoke);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("buscarArquivosDoRegistro", () => {
  it("sem sessão nem chama a edge", async () => {
    await expect(buscarArquivosDoRegistro("r1")).rejects.toThrow("Sua sessão venceu. Entre de novo.");
    expect(invoke()).not.toHaveBeenCalled();
  });

  it("devolve áudio e fotos assinados", async () => {
    setCampoToken("tok");
    invoke().mockResolvedValueOnce({ data: { audio_url: "https://a", fotos: ["https://f1"] }, error: null } as never);
    await expect(buscarArquivosDoRegistro("r1")).resolves.toEqual({ audioUrl: "https://a", fotos: ["https://f1"] });
    expect(invoke()).toHaveBeenCalledWith("campo-registro-arquivos", { body: { token: "tok", registro_id: "r1" } });
  });

  it("resposta sem arquivos vira vazio", async () => {
    setCampoToken("tok");
    invoke().mockResolvedValueOnce({ data: null, error: null } as never);
    await expect(buscarArquivosDoRegistro("r1")).resolves.toEqual({ audioUrl: null, fotos: [] });
  });

  it("401 pede para entrar de novo; outro erro pede para conferir o sinal", async () => {
    setCampoToken("tok");
    invoke()
      .mockResolvedValueOnce({ data: null, error: { context: new Response("{}", { status: 401 }) } } as never)
      .mockResolvedValueOnce({ data: null, error: new Error("Failed to fetch") } as never);
    await expect(buscarArquivosDoRegistro("r1")).rejects.toThrow("Sua sessão venceu. Entre de novo.");
    await expect(buscarArquivosDoRegistro("r1")).rejects.toThrow(
      "Não deu para abrir agora. Confira o sinal e tente de novo."
    );
  });
});
