import PizZip from "pizzip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroDeDocx } from "@/lib/erroDeDocx";

const upload = vi.fn();
const remove = vi.fn();
const insertSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: () => Promise.resolve({ data: "empresa-1" }),
    storage: { from: () => ({ upload: (...a: unknown[]) => upload(...a), remove: (...a: unknown[]) => remove(...a) }) },
    from: () => ({ insert: () => ({ select: () => ({ single: () => insertSingle() }) }) }),
  },
}));

import { useUploadTemplate } from "./usePropostaTemplates";

const MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function arquivoWord(corpo: string, nome = "Proposta_0655.2026.docx"): File {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${corpo}</w:t></w:r></w:p></w:body></w:document>`
  );
  const bytes = zip.generate({ type: "arraybuffer" });
  const file = new File([bytes], nome, { type: MIME });
  // jsdom antigo não implementa File#arrayBuffer.
  if (!file.arrayBuffer) file.arrayBuffer = async () => bytes.slice(0);
  return file;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useUploadTemplate", () => {
  beforeEach(() => {
    upload.mockReset().mockResolvedValue({ error: null });
    remove.mockReset().mockResolvedValue({ error: null });
    insertSingle.mockReset().mockResolvedValue({ data: { id: "t1", variaveis: ["CODIGO"] }, error: null });
  });

  it("Word sem nenhuma variável é recusado com orientação e não sobe para o storage", async () => {
    const { result } = renderHook(() => useUploadTemplate(), { wrapper });
    result.current.mutate({ file: arquivoWord("Proposta comercial pronta"), nome: "Teste" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ErroDeDocx);
    expect(result.current.error?.message).toContain("nenhuma variável");
    expect(upload).not.toHaveBeenCalled();
  });

  it("Word com chave simples, {CODIGO}, recebe a dica das duas chaves", async () => {
    const { result } = renderHook(() => useUploadTemplate(), { wrapper });
    result.current.mutate({ file: arquivoWord("Código {CODIGO}"), nome: "Teste" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("{{CODIGO}}");
    expect(upload).not.toHaveBeenCalled();
  });

  it("marcação mal fechada é recusada antes do upload", async () => {
    const { result } = renderHook(() => useUploadTemplate(), { wrapper });
    result.current.mutate({ file: arquivoWord("Oi {{NOME e {{CODIGO}}"), nome: "Teste" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("marcação(ões)");
    expect(upload).not.toHaveBeenCalled();
  });

  it("Word com variável sobe e grava o registro", async () => {
    const { result } = renderHook(() => useUploadTemplate(), { wrapper });
    result.current.mutate({ file: arquivoWord("Código {{CODIGO}}"), nome: "Padrão" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("se o registro falha depois do upload, remove o arquivo do storage", async () => {
    insertSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { result } = renderHook(() => useUploadTemplate(), { wrapper });
    result.current.mutate({ file: arquivoWord("Código {{CODIGO}}"), nome: "Padrão" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("arquivo acima de 10 MB é recusado com a mensagem certa", async () => {
    const grande = arquivoWord("Código {{CODIGO}}");
    Object.defineProperty(grande, "size", { value: 11 * 1024 * 1024 });
    const { result } = renderHook(() => useUploadTemplate(), { wrapper });
    result.current.mutate({ file: grande, nome: "Grande" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("10 MB");
  });
});
