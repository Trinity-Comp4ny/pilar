import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";

const h = vi.hoisted(() => ({ invoke: vi.fn(), token: "tok" as string | null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: h.invoke } } }));
vi.mock("@/hooks/useClienteAuth", () => ({ getPortalToken: () => h.token }));

import { baixarArquivoPortal, ehPastaPortal, listarArquivosPortal } from "./portalArquivos";

beforeEach(() => {
  h.invoke.mockReset();
  h.token = "tok";
});
afterEach(() => vi.restoreAllMocks());

describe("portalArquivos", () => {
  it("lista com o token do portal; subpasta só quando informada", async () => {
    h.invoke.mockResolvedValue({ data: { pasta: null, itens: [] }, error: null });
    await listarArquivosPortal("p1");
    expect(h.invoke).toHaveBeenCalledWith("portal-arquivos", {
      body: { acao: "listar", projeto_id: "p1", session_token: "tok" },
    });
    await listarArquivosPortal("p1", "sub");
    expect(h.invoke).toHaveBeenLastCalledWith("portal-arquivos", {
      body: { acao: "listar", projeto_id: "p1", pasta_id: "sub", session_token: "tok" },
    });
  });

  it("sem sessão do portal nem chama a função", async () => {
    h.token = null;
    await expect(listarArquivosPortal("p1")).rejects.toThrow("Sessão expirada");
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it("erro da função chega com a mensagem do servidor", async () => {
    const resp = new Response(JSON.stringify({ error: "Projeto não encontrado" }), { status: 404 });
    h.invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(resp) });
    await expect(listarArquivosPortal("p1")).rejects.toThrow("Projeto não encontrado");
  });

  it("baixar: documento do Google sai com .pdf; arquivo comum mantém o nome", async () => {
    h.invoke.mockResolvedValue({ data: new Blob(["x"]), error: null });
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const nomes: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      nomes.push(this.download);
    });
    await baixarArquivoPortal("p1", { id: "d1", name: "Memorial", mimeType: "application/vnd.google-apps.document" });
    await baixarArquivoPortal("p1", { id: "a1", name: "planta.pdf", mimeType: "application/pdf" });
    expect(nomes).toEqual(["Memorial.pdf", "planta.pdf"]);
    expect(h.invoke).toHaveBeenCalledWith("portal-arquivos", {
      body: { acao: "baixar", projeto_id: "p1", arquivo_id: "d1", session_token: "tok" },
    });
  });

  it("reconhece pasta", () => {
    expect(ehPastaPortal({ mimeType: "application/vnd.google-apps.folder" })).toBe(true);
    expect(ehPastaPortal({ mimeType: "application/pdf" })).toBe(false);
  });
});
