import { forwardRef, useImperativeHandle } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSupabaseFrom, findCall } from "@/test/supabaseChain";
import { FeedbackDialog } from "./FeedbackDialog";

const h = vi.hoisted(() => ({
  user: { id: "u1", email: "dev@local.test" } as { id: string; email?: string } | null,
  upload: vi.fn(),
  storageFrom: vi.fn(),
  submitBug: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  carregarImagem: vi.fn(),
  capturarTela: vi.fn(),
  podeCapturar: true,
  exportar: vi.fn(),
  insertResult: { error: null } as { error: unknown },
  sb: null as unknown as ReturnType<typeof createSupabaseFrom>,
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom: criar } = await import("@/test/supabaseChain");
  h.sb = criar(() => h.insertResult);
  return {
    supabase: {
      from: h.sb.from,
      storage: { from: (...a: unknown[]) => (h.storageFrom(...a), { upload: h.upload }) },
    },
  };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: h.user, profile: { nome: "Dev Seed" } }) }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { submitBugFeedback: h.submitBug } }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/lib/feedbackPrint", () => ({
  carregarImagem: h.carregarImagem,
  capturarTela: h.capturarTela,
  podeCapturarTela: () => h.podeCapturar,
  montarContexto: () => ({ rota: "/inicio", janela: "1x1", navegador: "ua", release: "dev" }),
}));
vi.mock("@/components/feedback/PrintAnnotator", () => ({
  PrintAnnotator: forwardRef<unknown, { onRemover: () => void }>(function Fake({ onRemover }, ref) {
    useImperativeHandle(ref, () => ({ exportar: h.exportar }));
    return (
      <button type="button" onClick={onRemover}>
        remover-print
      </button>
    );
  }),
}));

const onOpenChange = vi.fn();

function abrir() {
  render(<FeedbackDialog open onOpenChange={onOpenChange} />);
  return userEvent.setup();
}

function anexarArquivo() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File(["x"], "print.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("__SENTRY_RELEASE__", "dev");
  h.user = { id: "u1", email: "dev@local.test" };
  h.podeCapturar = true;
  h.insertResult = { error: null };
  h.sb.calls.length = 0;
  h.submitBug.mockResolvedValue("evt-1");
  h.carregarImagem.mockResolvedValue(document.createElement("img"));
  h.upload.mockResolvedValue({ error: null });
  h.exportar.mockResolvedValue({ blob: new Blob(["p"], { type: "image/png" }), extensao: "png" });
});

describe("FeedbackDialog", () => {
  it("bug: envia sem título, com evento do Sentry", async () => {
    const user = abrir();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    await user.type(screen.getByLabelText("O que aconteceu?"), "  Botão não salva  ");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Relato enviado. Obrigado!"));
    expect(h.submitBug).toHaveBeenCalledWith("Botão não salva", { email: "dev@local.test", name: "Dev Seed" });
    const insert = findCall(h.sb.calls, "feature_suggestions", "insert");
    expect(insert?.payload).toMatchObject({
      tipo: "bug",
      titulo: null,
      descricao: "Botão não salva",
      created_by: "u1",
      print_path: null,
      sentry_event_id: "evt-1",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sugestão exige título e não vai pro Sentry", async () => {
    const user = abrir();
    await user.click(screen.getByRole("radio", { name: /Sugerir melhoria/ }));
    await user.type(screen.getByLabelText("Descrição"), "Exportar PDF");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    await user.type(screen.getByLabelText("Título"), "PDF");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Sugestão enviada. Obrigado!"));
    expect(h.submitBug).not.toHaveBeenCalled();
    expect(findCall(h.sb.calls, "feature_suggestions", "insert")?.payload).toMatchObject({
      tipo: "sugestao",
      titulo: "PDF",
      sentry_event_id: null,
    });
    await user.click(screen.getByRole("radio", { name: /Reportar problema/ }));
  });

  it("sem sessão não envia", async () => {
    h.user = null;
    const user = abrir();
    await user.type(screen.getByLabelText("O que aconteceu?"), "x");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(h.toastError).toHaveBeenCalledWith("Sua sessão expirou", expect.any(Object));
    expect(h.sb.from).not.toHaveBeenCalled();
  });

  it("erro do banco mantém o texto e avisa", async () => {
    h.insertResult = { error: { message: "falhou" } };
    const user = abrir();
    await user.type(screen.getByLabelText("O que aconteceu?"), "texto");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Não deu pra enviar o feedback", expect.any(Object)));
    expect(screen.getByLabelText("O que aconteceu?")).toHaveValue("texto");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("anexa imagem, sobe o print e grava o caminho", async () => {
    const user = abrir();
    anexarArquivo();
    expect(await screen.findByText("remover-print")).toBeInTheDocument();
    await user.type(screen.getByLabelText("O que aconteceu?"), "com print");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalled());
    expect(h.storageFrom).toHaveBeenCalledWith("feedback-prints");
    const [path, , opts] = h.upload.mock.calls[0];
    expect(path).toMatch(/^u1\/.+\.png$/);
    expect(opts).toEqual({ contentType: "image/png", upsert: false });
    expect(findCall(h.sb.calls, "feature_suggestions", "insert")?.payload).toMatchObject({ print_path: path });
  });

  it("falha no upload do print não grava o feedback", async () => {
    h.upload.mockResolvedValue({ error: new Error("bucket cheio") });
    const user = abrir();
    anexarArquivo();
    await screen.findByText("remover-print");
    await user.type(screen.getByLabelText("O que aconteceu?"), "x");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalled());
    expect(findCall(h.sb.calls, "feature_suggestions", "insert")).toBeUndefined();
  });

  it("remover o print volta às opções de anexo", async () => {
    const user = abrir();
    anexarArquivo();
    await user.click(await screen.findByText("remover-print"));
    expect(screen.getByRole("button", { name: /Enviar imagem/ })).toBeInTheDocument();
  });

  it("imagem que não abre avisa", async () => {
    h.carregarImagem.mockRejectedValue(new Error("formato"));
    abrir();
    anexarArquivo();
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Não deu pra anexar o print", expect.any(Object)));
  });

  it("input de arquivo vazio não faz nada", () => {
    abrir();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [] } });
    expect(h.carregarImagem).not.toHaveBeenCalled();
  });

  it("colar imagem anexa; colar texto não", async () => {
    abrir();
    const area = screen.getByLabelText("O que aconteceu?");
    fireEvent.paste(area, { clipboardData: { files: [new File(["t"], "a.txt", { type: "text/plain" })] } });
    expect(h.carregarImagem).not.toHaveBeenCalled();
    fireEvent.paste(area, { clipboardData: { files: [new File(["i"], "a.png", { type: "image/png" })] } });
    expect(await screen.findByText("remover-print")).toBeInTheDocument();
  });

  it("capturar tela anexa o frame", async () => {
    h.capturarTela.mockResolvedValue(new Blob(["f"]));
    const user = abrir();
    await user.click(screen.getByRole("button", { name: /Capturar tela/ }));
    expect(await screen.findByText("remover-print", {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it("cancelar o seletor de tela não mostra erro", async () => {
    h.capturarTela.mockRejectedValue(new DOMException("cancelado", "NotAllowedError"));
    const user = abrir();
    await user.click(screen.getByRole("button", { name: /Capturar tela/ }));
    await waitFor(() => expect(h.capturarTela).toHaveBeenCalled(), { timeout: 2000 });
    await waitFor(() => expect(screen.getByRole("button", { name: /Capturar tela/ })).toBeInTheDocument());
    expect(h.toastError).not.toHaveBeenCalled();
  });

  it("falha na captura sugere print pelo sistema", async () => {
    h.capturarTela.mockRejectedValue(new Error("x"));
    const user = abrir();
    await user.click(screen.getByRole("button", { name: /Capturar tela/ }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Não deu pra capturar a tela", expect.any(Object)), {
      timeout: 2000,
    });
  });

  it("sem Screen Capture API não oferece captura", () => {
    h.podeCapturar = false;
    abrir();
    expect(screen.queryByRole("button", { name: /Capturar tela/ })).not.toBeInTheDocument();
  });

  it("fechar pelo cancelar limpa o formulário", async () => {
    const user = abrir();
    await user.type(screen.getByLabelText("O que aconteceu?"), "rascunho");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("O que aconteceu?")).toHaveValue("");
  });
});
