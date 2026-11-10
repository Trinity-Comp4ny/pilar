import { beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { ErroDrive, iniciarConexaoDrive, lerRetornoDoDrive, listarPasta } from "./googleDrive";

beforeEach(() => invoke.mockReset());

describe("googleDrive", () => {
  it("erro da função vira ErroDrive com a mensagem e o código", async () => {
    const resp = new Response(JSON.stringify({ error: "Reconecte o Google Drive", codigo: "reconectar" }), {
      status: 409,
    });
    invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(resp) });
    const e = await listarPasta("abc1234567").catch((x) => x);
    expect(e).toBeInstanceOf(ErroDrive);
    expect(e.message).toBe("Reconecte o Google Drive");
    expect(e.codigo).toBe("reconectar");
  });

  it("iniciar conexão manda o caminho de retorno", async () => {
    invoke.mockResolvedValue({ data: { url: "https://accounts.google.com/x" }, error: null });
    await expect(iniciarConexaoDrive("/projetos/p1#arquivos")).resolves.toEqual({
      url: "https://accounts.google.com/x",
    });
    expect(invoke).toHaveBeenCalledWith("google-drive-oauth", {
      body: { acao: "iniciar", retorno: "/projetos/p1#arquivos" },
    });
  });

  it("lerRetornoDoDrive só aceita os três status e limpa a URL", () => {
    window.history.replaceState(null, "", "/x?a=1&drive=negado");
    expect(lerRetornoDoDrive()).toBe("negado");
    expect(window.location.search).toBe("?a=1");
    window.history.replaceState(null, "", "/x?drive=qualquer");
    expect(lerRetornoDoDrive()).toBeNull();
  });
});
