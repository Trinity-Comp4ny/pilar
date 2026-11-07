import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ErroDeDocx } from "@/lib/erroDeDocx";
import type { PropostaTemplate } from "../hooks/usePropostaTemplates";

// Gestão de templates .docx: lista por tipo, upload (validação e erros),
// exclusão com confirmação e preview (docx -> html sanitizado).

type MutOpts<T> = { onSuccess?: (d: T) => void; onError?: (e: Error) => void };

const estado = {
  templates: [] as PropostaTemplate[],
  isLoading: false,
  upload: { resultado: null as PropostaTemplate | null, erro: null as Error | null },
  remover: { erro: null as Error | null },
};
const uploadMutate = vi.fn((_v: unknown, o: MutOpts<PropostaTemplate>) => {
  if (estado.upload.erro) o.onError?.(estado.upload.erro);
  else o.onSuccess?.(estado.upload.resultado as PropostaTemplate);
});
const deleteMutate = vi.fn((_id: string, o: MutOpts<void>) => {
  if (estado.remover.erro) o.onError?.(estado.remover.erro);
  else o.onSuccess?.(undefined);
});
const downloadTemplateFile = vi.fn(async (_p: string) => new ArrayBuffer(4));
const convertToHtml = vi.fn(async (_i: unknown, _o?: unknown) => ({
  value: "<h1>Contrato de prestação</h1><img src=x onerror=alert(1)>",
}));
const reportInvokeError = vi.fn();

vi.mock("@/components/ui/select", async () => await import("@/pages/financeiro/testing/nativeSelect"));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("mammoth", () => ({ default: { convertToHtml: (i: unknown, o: unknown) => convertToHtml(i, o) } }));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: (...a: unknown[]) => reportInvokeError(...a) }));
vi.mock("@/pages/propostas/hooks/usePropostaTemplates", () => ({
  usePropostaTemplates: () => ({ data: estado.templates, isLoading: estado.isLoading }),
  useUploadTemplate: () => ({ mutate: uploadMutate, isPending: false }),
  useDeleteTemplate: () => ({ mutate: deleteMutate, isPending: false }),
  downloadTemplateFile: (p: string) => downloadTemplateFile(p),
}));

import { toast } from "sonner";
import { TemplatesManager } from "./TemplatesManager";

const tpl = (p: Partial<PropostaTemplate> = {}): PropostaTemplate => ({
  id: "t1",
  empresa_id: "emp-1",
  nome: "Proposta Residencial",
  descricao: "Padrão do escritório",
  arquivo_path: "emp-1/residencial.docx",
  variaveis: ["CLIENTE_NOME", "VALOR_PROPOSTO"],
  tipo: "proposta",
  created_at: "2026-03-10T12:00:00Z",
  ...p,
});

const docx = () =>
  new File(["PK"], "modelo.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

function abrirUpload() {
  fireEvent.click(screen.getByRole("button", { name: /Upload Template/ }));
  return screen.getByRole("dialog");
}

beforeEach(() => {
  vi.clearAllMocks();
  estado.templates = [];
  estado.isLoading = false;
  estado.upload = { resultado: tpl({ variaveis: ["A", "B", "C"] }), erro: null };
  estado.remover = { erro: null };
});

describe("TemplatesManager: listagem", () => {
  it("carregando não mostra a lista", () => {
    estado.isLoading = true;
    render(<TemplatesManager />);
    expect(screen.queryByRole("button", { name: /Upload Template/ })).not.toBeInTheDocument();
  });

  it("sem templates mostra o estado vazio com ação de upload", () => {
    render(<TemplatesManager />);
    expect(screen.getByText("Nenhum template cadastrado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload template" }));
    expect(screen.getByText("Upload de Template")).toBeInTheDocument();
  });

  it("separa propostas e contratos e resume as variáveis (até 5 + contador)", () => {
    estado.templates = [
      tpl(),
      tpl({
        id: "t2",
        nome: "Contrato PJ",
        tipo: "contrato",
        descricao: null,
        variaveis: ["CLIENTE_NOME", "A", "B", "C", "D", "E", "F"],
      }),
    ];
    render(<TemplatesManager />);
    expect(screen.getByRole("heading", { name: "Propostas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contratos" })).toBeInTheDocument();
    expect(screen.getByText("Padrão do escritório")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("7 variáveis")).toBeInTheDocument();
    // automática em verde, manual em amarelo
    const cardContrato = screen.getByText("Contrato PJ").closest(".space-y-3") as HTMLElement;
    expect(within(cardContrato).getByText("CLIENTE_NOME").className).toMatch(/positive/);
    expect(within(cardContrato).getByText("A").className).toMatch(/warning/);
    expect(within(cardContrato).queryByText("F")).not.toBeInTheDocument();
  });

  it("só contratos: não mostra a seção de propostas", () => {
    estado.templates = [tpl({ tipo: "contrato" })];
    render(<TemplatesManager />);
    expect(screen.queryByRole("heading", { name: "Propostas" })).not.toBeInTheDocument();
  });
});

describe("TemplatesManager: upload", () => {
  it("sem nome não envia", () => {
    render(<TemplatesManager />);
    const dialog = abrirUpload();
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));
    expect(toast.error).toHaveBeenCalledWith("Nome é obrigatório");
    expect(uploadMutate).not.toHaveBeenCalled();
  });

  it("sem arquivo não envia", () => {
    render(<TemplatesManager />);
    const dialog = abrirUpload();
    fireEvent.change(within(dialog).getByPlaceholderText(/Proposta Residencial Padrão/), { target: { value: "X" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));
    expect(toast.error).toHaveBeenCalledWith("Selecione um arquivo DOCX");
    expect(uploadMutate).not.toHaveBeenCalled();
  });

  it("envia nome aparado, descrição, tipo e arquivo; avisa variáveis detectadas e fecha", () => {
    render(<TemplatesManager />);
    const dialog = abrirUpload();
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "contrato" } });
    fireEvent.change(within(dialog).getByPlaceholderText(/Proposta Residencial Padrão/), {
      target: { value: "  Contrato PJ  " },
    });
    fireEvent.change(within(dialog).getByPlaceholderText("Breve descrição do template"), {
      target: { value: "   " },
    });
    const arquivo = docx();
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [arquivo] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));

    expect(uploadMutate).toHaveBeenCalledWith(
      { file: arquivo, nome: "Contrato PJ", descricao: undefined, tipo: "contrato" },
      expect.any(Object)
    );
    expect(toast.success).toHaveBeenCalledWith("Template salvo", { description: "3 variáveis detectadas" });
    expect(screen.queryByText("Upload de Template")).not.toBeInTheDocument();
  });

  it("erro de docx mostra a mensagem própria e mantém o formulário", () => {
    estado.upload.erro = new ErroDeDocx("Este Word não tem nenhuma variável.");
    render(<TemplatesManager />);
    const dialog = abrirUpload();
    fireEvent.change(within(dialog).getByPlaceholderText(/Proposta Residencial Padrão/), { target: { value: "X" } });
    fireEvent.change(dialog.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [docx()] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar o template", {
      description: "Este Word não tem nenhuma variável.",
    });
    expect(screen.getByText("Upload de Template")).toBeInTheDocument();
  });

  it("erro do banco vira mensagem segura", () => {
    estado.upload.erro = new Error("new row violates row-level security policy for table proposta_templates");
    render(<TemplatesManager />);
    const dialog = abrirUpload();
    fireEvent.change(within(dialog).getByPlaceholderText(/Proposta Residencial Padrão/), { target: { value: "X" } });
    fireEvent.change(dialog.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [docx()] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar o template", {
      description: "Você não tem permissão para realizar esta ação.",
    });
  });

  it("cancelar limpa o formulário", () => {
    render(<TemplatesManager />);
    let dialog = abrirUpload();
    fireEvent.change(within(dialog).getByPlaceholderText(/Proposta Residencial Padrão/), { target: { value: "X" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Upload de Template")).not.toBeInTheDocument();
    dialog = abrirUpload();
    expect(within(dialog).getByPlaceholderText(/Proposta Residencial Padrão/)).toHaveValue("");
  });
});

describe("TemplatesManager: exclusão", () => {
  it("confirma e remove", () => {
    estado.templates = [tpl()];
    render(<TemplatesManager />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir template" }));
    expect(screen.getByText("Tem certeza que deseja excluir este template?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(deleteMutate).toHaveBeenCalledWith("t1", expect.any(Object));
    expect(toast.success).toHaveBeenCalledWith("Template removido");
  });

  it("erro ao remover avisa", () => {
    estado.templates = [tpl()];
    estado.remover.erro = new Error("permission denied for table proposta_templates");
    render(<TemplatesManager />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir template" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível remover o template", {
      description: "Você não tem permissão para realizar esta ação.",
    });
  });

  it("cancelar a confirmação não remove", () => {
    estado.templates = [tpl()];
    render(<TemplatesManager />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir template" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteMutate).not.toHaveBeenCalled();
  });
});

describe("TemplatesManager: preview", () => {
  it("baixa o arquivo, converte e mostra o html sanitizado com as variáveis", async () => {
    estado.templates = [tpl({ tipo: "contrato", nome: "Contrato PJ", variaveis: ["CLIENTE_NOME", "FORO"] })];
    render(<TemplatesManager />);
    fireEvent.click(screen.getByRole("button", { name: /Preview/ }));
    expect(await screen.findByText("Contrato de prestação")).toBeInTheDocument();
    expect(downloadTemplateFile).toHaveBeenCalledWith("emp-1/residencial.docx");
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("img[onerror]")).toBeNull();
    expect(within(dialog).getByText("{{FORO}}")).toBeInTheDocument();
    expect(within(dialog).getByText("Contrato")).toBeInTheDocument();
  });

  it("falha ao abrir o arquivo reporta, avisa e fecha o preview", async () => {
    downloadTemplateFile.mockRejectedValueOnce(new Error("Erro ao baixar template: Object not found"));
    estado.templates = [tpl()];
    render(<TemplatesManager />);
    fireEvent.click(screen.getByRole("button", { name: /Preview/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith("Não foi possível abrir o preview", {
      description: expect.stringContaining("Erro ao baixar template: Object not found"),
    });
    expect(reportInvokeError).toHaveBeenCalledWith(expect.any(Error), "proposta:preview-template", {
      templateId: "t1",
      arquivo: "emp-1/residencial.docx",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
