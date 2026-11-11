import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import {
  baixarArquivo,
  conectarGoogleDrive,
  criarPasta,
  desconectarDrive,
  enviarArquivo,
  ErroDrive,
  ehPasta,
  iniciarConexaoDrive,
  lerRetornoDoDrive,
  listarPasta,
  MIME_PASTA,
  moverParaLixeira,
  pastaDoProjeto,
} from "./googleDrive";

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

  it("ações mandam a ação e os ids certos para a função", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await pastaDoProjeto("p1");
    await criarPasta("pai1234567", "Revisão 2");
    await moverParaLixeira("arq1234567");
    await desconectarDrive();
    expect(invoke.mock.calls.map((c) => [c[0], c[1].body])).toEqual([
      ["google-drive", { acao: "pasta_projeto", projeto_id: "p1" }],
      ["google-drive", { acao: "criar_pasta", pasta_pai_id: "pai1234567", nome: "Revisão 2" }],
      ["google-drive", { acao: "lixeira", arquivo_id: "arq1234567" }],
      ["google-drive-oauth", { acao: "desconectar" }],
    ]);
    expect(ehPasta({ mimeType: MIME_PASTA })).toBe(true);
    expect(ehPasta({ mimeType: "application/pdf" })).toBe(false);
  });

  it("erro sem corpo JSON fica com a mensagem padrão e sem código", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("rede") });
    const e = await moverParaLixeira("arq1234567").catch((x) => x);
    expect(e).toBeInstanceOf(ErroDrive);
    expect(e.message).toBe("Não foi possível excluir.");
    expect(e.codigo).toBeUndefined();
  });

  it("baixar: binário vira download com o nome do arquivo; documento do Google abre no Drive", async () => {
    const criar = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    invoke.mockResolvedValue({ data: new Blob(["x"]), error: null });
    await baixarArquivo({ id: "arq1234567", name: "planta.pdf", mimeType: "application/pdf" });
    expect(criar).toHaveBeenCalled();
    expect(clique).toHaveBeenCalled();

    const abrir = vi.spyOn(window, "open").mockReturnValue(null);
    invoke.mockResolvedValue({ data: { abrir: "https://docs.google.com/x" }, error: null });
    await baixarArquivo({ id: "doc1234567", name: "Memorial", mimeType: "application/vnd.google-apps.document" });
    expect(abrir).toHaveBeenCalledWith("https://docs.google.com/x", "_blank", "noopener,noreferrer");
    vi.restoreAllMocks();
  });

  it("conectar leva ao consentimento com a página atual como retorno", async () => {
    window.history.replaceState(null, "", "/projetos/p1#arquivos");
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, pathname: "/projetos/p1", search: "", hash: "#arquivos", assign });
    invoke.mockResolvedValue({ data: { url: "https://accounts.google.com/x" }, error: null });
    await conectarGoogleDrive();
    expect(invoke).toHaveBeenCalledWith("google-drive-oauth", {
      body: { acao: "iniciar", retorno: "/projetos/p1#arquivos" },
    });
    expect(assign).toHaveBeenCalledWith("https://accounts.google.com/x");
    vi.unstubAllGlobals();
  });

  describe("enviarArquivo", () => {
    class XhrFalso {
      static todos: XhrFalso[] = [];
      static get ultimo(): XhrFalso {
        return XhrFalso.todos[XhrFalso.todos.length - 1];
      }
      status = 200;
      responseText = "";
      upload = {
        onprogress: null as null | ((e: { lengthComputable: boolean; loaded: number; total: number }) => void),
      };
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      metodo = "";
      url = "";
      corpo: unknown;
      constructor() {
        XhrFalso.todos.push(this);
      }
      open(m: string, u: string) {
        this.metodo = m;
        this.url = u;
      }
      send(c: unknown) {
        this.corpo = c;
      }
    }

    beforeEach(() => {
      XhrFalso.todos = [];
      vi.stubGlobal("XMLHttpRequest", XhrFalso);
    });
    afterEach(() => vi.unstubAllGlobals());

    const arquivo = new File(["abc"], "quadro.dwg", { type: "" });

    it("abre a sessão, manda o binário direto ao Google e informa o progresso", async () => {
      invoke.mockResolvedValue({ data: { upload_url: "https://upload/sessao" }, error: null });
      const progresso = vi.fn();
      const envio = enviarArquivo("pasta12345", arquivo, progresso);
      await vi.waitFor(() => expect(XhrFalso.ultimo?.url).toBe("https://upload/sessao"));
      expect(invoke).toHaveBeenCalledWith("google-drive", {
        body: {
          acao: "iniciar_upload",
          pasta_id: "pasta12345",
          nome: "quadro.dwg",
          mime: "application/octet-stream",
          tamanho: 3,
        },
      });
      const xhr = XhrFalso.ultimo;
      expect(xhr.metodo).toBe("PUT");
      expect(xhr.corpo).toBe(arquivo);
      xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
      expect(progresso).toHaveBeenCalledWith(0.25);
      xhr.responseText = JSON.stringify({ id: "novo", name: "quadro.dwg", mimeType: "application/acad" });
      xhr.onload?.();
      await expect(envio).resolves.toEqual({ id: "novo", name: "quadro.dwg", mimeType: "application/acad" });
    });

    it("resposta sem JSON ainda conta como enviado; recusa e falha de rede viram erro", async () => {
      invoke.mockResolvedValue({ data: { upload_url: "https://upload/s" }, error: null });
      const ok = enviarArquivo("pasta12345", arquivo);
      await vi.waitFor(() => expect(XhrFalso.ultimo?.url).toBe("https://upload/s"));
      XhrFalso.ultimo.responseText = "nada";
      XhrFalso.ultimo.onload?.();
      await expect(ok).resolves.toMatchObject({ name: "quadro.dwg" });

      const recusa = enviarArquivo("pasta12345", arquivo);
      await vi.waitFor(() => expect(XhrFalso.todos).toHaveLength(2));
      XhrFalso.ultimo.status = 403;
      XhrFalso.ultimo.onload?.();
      await expect(recusa).rejects.toThrow("O Google Drive recusou o envio de quadro.dwg.");

      const rede = enviarArquivo("pasta12345", arquivo);
      await vi.waitFor(() => expect(XhrFalso.todos).toHaveLength(3));
      XhrFalso.ultimo.onerror?.();
      await expect(rede).rejects.toThrow("Falha de rede ao enviar quadro.dwg.");
    });
  });
});
