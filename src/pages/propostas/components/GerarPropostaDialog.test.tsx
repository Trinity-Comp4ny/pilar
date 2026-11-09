import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sb } from "@/pages/financeiro/testing/supabaseMock";
import type { PropostaTemplate } from "../hooks/usePropostaTemplates";

// Wizard de gerar proposta/contrato .docx: configurar (template + variáveis),
// visualizar (docx -> html), baixar e enviar por email (edge function).

const navigate = vi.fn();
const templatesState: { data: PropostaTemplate[] } = { data: [] };
const downloadTemplateFile = vi.fn(async (_path: string) => new ArrayBuffer(8));
const generateDocx = vi.fn((_buf: ArrayBuffer, _data: Record<string, string>) => fakeBlob);
const convertToHtml = vi.fn(async (_i: unknown) => ({
  value: "<h1>Proposta Casa Verde</h1><script>alert(1)</script>",
}));
const saveAs = vi.fn();
const reportInvokeError = vi.fn();
const track = vi.fn();

// O mock base tipa invoke como "sempre { data: null, error: null }"; aqui ele varia.
const invoke = sb.client.functions.invoke as unknown as Mock<
  (fn: string, opts?: unknown) => Promise<{ data: unknown; error: unknown }>
>;

const fakeBlob = { arrayBuffer: async () => new Uint8Array([80, 75]).buffer } as unknown as Blob;

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));
vi.mock("@/components/ui/select", async () => await import("@/pages/financeiro/testing/nativeSelect"));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("file-saver", () => ({ saveAs: (...a: unknown[]) => saveAs(...a) }));
vi.mock("mammoth", () => ({ default: { convertToHtml: (i: unknown) => convertToHtml(i) } }));
vi.mock("@/lib/docxUtils", () => ({
  generateDocx: (b: ArrayBuffer, d: Record<string, string>) => generateDocx(b, d),
}));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: (...a: unknown[]) => reportInvokeError(...a) }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: (...a: unknown[]) => track(...a) } }));
vi.mock("@/pages/propostas/hooks/usePropostaTemplates", () => ({
  usePropostaTemplates: () => templatesState,
  downloadTemplateFile: (p: string) => downloadTemplateFile(p),
}));

import { toast } from "sonner";
import { GerarPropostaDialog } from "./GerarPropostaDialog";

const template = (p: Partial<PropostaTemplate> = {}): PropostaTemplate => ({
  id: "t1",
  empresa_id: "emp-1",
  nome: "Modelo padrão",
  descricao: null,
  arquivo_path: "emp-1/modelo.docx",
  variaveis: ["CLIENTE_NOME", "VALOR_PROPOSTO", "ESCOPO_SERVICO", "forma_pagamento"],
  tipo: "proposta",
  created_at: "2026-01-01",
  ...p,
});

const propostaBase = {
  id: "prop-1",
  codigo: "PRP-042",
  titulo: "Proposta — Casa Verde",
  valor_proposto: 85000,
  lead_id: "lead-1",
  cliente_id: null,
  campos_extras: null as Record<string, string> | null,
};

const disciplinas = [{ disciplina: "Estrutural", horas_estimadas: 10, custo_hora: 100, valor_venda: 2000 }];

function setup(props: Partial<Parameters<typeof GerarPropostaDialog>[0]> = {}) {
  const onOpenChange = vi.fn();
  const onSent = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <GerarPropostaDialog
        open
        onOpenChange={onOpenChange}
        proposta={propostaBase}
        disciplinas={disciplinas}
        onSent={onSent}
        {...props}
      />
    </QueryClientProvider>
  );
  return { onOpenChange, onSent, ...utils, client };
}

const escolherTemplate = () => fireEvent.change(screen.getByRole("combobox"), { target: { value: "t1" } });
const visualizar = () => fireEvent.click(screen.getByRole("button", { name: /Visualizar Documento/ }));

async function irParaEnvio() {
  escolherTemplate();
  visualizar();
  await screen.findByText("Proposta Casa Verde");
  fireEvent.click(screen.getByRole("button", { name: /Enviar por Email/ }));
  return screen.getByPlaceholderText("cliente@email.com") as HTMLInputElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  templatesState.data = [template()];
  sb.resultado("leads.select", { data: { nome: "João", email: "joao@cliente.com", contato: "11 9999" }, error: null });
  sb.rpcResultado("get_user_empresa_id", { data: "emp-1", error: null });
  sb.resultado("empresas.select", { data: { nome: "Trinity Engenharia" }, error: null });
  invoke.mockResolvedValue({ data: { success: true }, error: null });
});

describe("GerarPropostaDialog: configurar", () => {
  it("sem template do tipo leva para o cadastro de templates", () => {
    templatesState.data = [];
    const { onOpenChange } = setup({ mode: "contrato" });
    expect(screen.getByText("Gerar Contrato")).toBeInTheDocument();
    expect(screen.getByText(/Nenhum template do tipo/)).toHaveTextContent("contrato");
    fireEvent.click(screen.getByRole("button", { name: /Gerenciar templates/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navigate).toHaveBeenCalledWith("/templates");
  });

  it("visualizar fica desabilitado até escolher o template", () => {
    setup();
    expect(screen.getByRole("button", { name: /Visualizar Documento/ })).toBeDisabled();
    escolherTemplate();
    expect(screen.getByRole("button", { name: /Visualizar Documento/ })).toBeEnabled();
  });

  it("mostra variáveis automáticas preenchidas e pede as manuais (texto longo vira textarea)", async () => {
    setup();
    escolherTemplate();
    expect(screen.getByText("CLIENTE_NOME")).toBeInTheDocument();
    expect(await screen.findByText("João")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?85\.000,00/)).toBeInTheDocument();
    const escopo = screen.getByPlaceholderText("Valor para ESCOPO SERVICO");
    expect(escopo.tagName).toBe("TEXTAREA");
    const pagamento = screen.getByPlaceholderText("Valor para Forma pagamento");
    expect(pagamento.tagName).toBe("INPUT");
    expect(screen.getByText("{{forma_pagamento}}")).toBeInTheDocument();
  });

  it("variável automática sem dado aparece como vazia", () => {
    sb.resultado("leads.select", { data: null, error: { message: "not found" } });
    setup();
    escolherTemplate();
    const linha = screen.getByText("CLIENTE_NOME").closest("div.flex") as HTMLElement;
    expect(linha).toHaveTextContent("(vazio)");
  });

  it("pré-preenche os campos manuais salvos na proposta", () => {
    setup({ proposta: { ...propostaBase, campos_extras: { forma_pagamento: "30/60/90" } } });
    escolherTemplate();
    expect(screen.getByPlaceholderText("Valor para Forma pagamento")).toHaveValue("30/60/90");
  });

  it("cancelar fecha", () => {
    const { onOpenChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("GerarPropostaDialog: visualizar e baixar", () => {
  it("gera o docx com dados automáticos + manuais, salva o template na proposta e mostra o preview sanitizado", async () => {
    setup();
    escolherTemplate();
    await screen.findByText("João");
    fireEvent.change(screen.getByPlaceholderText("Valor para Forma pagamento"), { target: { value: "À vista" } });
    visualizar();
    expect(await screen.findByText("Proposta Casa Verde")).toBeInTheDocument();
    expect(screen.getByText("Visualizar Proposta")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();

    expect(downloadTemplateFile).toHaveBeenCalledWith("emp-1/modelo.docx");
    const dados = generateDocx.mock.calls[0][1];
    expect(dados).toMatchObject({
      CLIENTE_NOME: "João",
      EMPRESA_NOME: "Trinity Engenharia",
      forma_pagamento: "À vista",
    });
    expect(dados.DISCIPLINAS_COM_VALOR).toMatch(/Estrutural — R\$\s?2\.000,00/);
    expect(sb.de("propostas", "update")[0].args[0]).toEqual({
      template_id: "t1",
      campos_extras: { forma_pagamento: "À vista" },
    });
  });

  it("contrato não grava template na proposta", async () => {
    templatesState.data = [template({ tipo: "contrato" })];
    setup({ mode: "contrato" });
    escolherTemplate();
    visualizar();
    await screen.findByText("Proposta Casa Verde");
    expect(sb.de("propostas", "update")).toHaveLength(0);
  });

  it("falha ao baixar o template avisa e continua no passo de configuração", async () => {
    downloadTemplateFile.mockRejectedValueOnce(new Error("Erro ao baixar template: not found"));
    setup();
    escolherTemplate();
    visualizar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Erro ao gerar preview", {
        description: "Erro ao baixar template: not found",
      })
    );
    expect(reportInvokeError).toHaveBeenCalledWith(expect.any(Error), "proposta:gerar-preview");
    expect(screen.getByText("Gerar Proposta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Visualizar Documento/ })).toBeEnabled();
  });

  it("baixa o documento com o nome pelo código", async () => {
    setup();
    escolherTemplate();
    visualizar();
    await screen.findByText("Proposta Casa Verde");
    fireEvent.click(screen.getByRole("button", { name: /Baixar documento/ }));
    expect(saveAs).toHaveBeenCalledWith(fakeBlob, "Proposta_PRP-042.docx");
    expect(toast.success).toHaveBeenCalledWith("Documento baixado");
  });

  it("sem código usa o título no nome do arquivo", async () => {
    setup({ proposta: { ...propostaBase, codigo: null } });
    escolherTemplate();
    visualizar();
    await screen.findByText("Proposta Casa Verde");
    fireEvent.click(screen.getByRole("button", { name: /Baixar documento/ }));
    expect(saveAs).toHaveBeenCalledWith(fakeBlob, "Proposta_Proposta_—_Casa_Verde.docx");
  });

  it("voltar retorna à configuração", async () => {
    setup();
    escolherTemplate();
    visualizar();
    await screen.findByText("Proposta Casa Verde");
    fireEvent.click(screen.getByRole("button", { name: /^Voltar$/ }));
    expect(screen.getByText("Gerar Proposta")).toBeInTheDocument();
  });
});

describe("GerarPropostaDialog: enviar", () => {
  it("pré-preenche destinatário, assunto e mensagem com o contato", async () => {
    setup();
    await screen.findByText("Gerar Proposta");
    await waitFor(() => expect(sb.de("leads", "single")).toHaveLength(1));
    const email = await irParaEnvio();
    expect(email).toHaveValue("joao@cliente.com");
    expect(screen.getByDisplayValue("Proposta — Casa Verde")).toBeInTheDocument();
    expect(
      (screen.getByPlaceholderText("Mensagem personalizada para o cliente...") as HTMLTextAreaElement).value
    ).toContain("Olá, João!");
  });

  it("contrato monta o assunto sem o prefixo Proposta", async () => {
    templatesState.data = [template({ tipo: "contrato" })];
    setup({ mode: "contrato" });
    await waitFor(() => expect(sb.de("leads", "single")).toHaveLength(1));
    await irParaEnvio();
    expect(screen.getByDisplayValue("Contrato — Casa Verde")).toBeInTheDocument();
    expect(
      (screen.getByPlaceholderText("Mensagem personalizada para o cliente...") as HTMLTextAreaElement).value
    ).toContain("o contrato");
  });

  it("envia o anexo em base64 pela edge function, avisa e fecha", async () => {
    const { onSent, onOpenChange } = setup();
    await waitFor(() => expect(sb.de("leads", "single")).toHaveLength(1));
    await irParaEnvio();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Envio/ }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(invoke).toHaveBeenCalledWith("send-proposta-email", {
      body: expect.objectContaining({
        email: "joao@cliente.com",
        subject: "Proposta — Casa Verde",
        attachment_base64: btoa("PK"),
        filename: "Proposta_PRP-042.docx",
        proposta_id: "prop-1",
        nome_cliente: "João",
        doc_mode: "proposta",
      }),
    });
    expect(track).toHaveBeenCalledWith("proposta_enviada", { documento: "proposta" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sem email cadastrado avisa e bloqueia o envio", async () => {
    sb.resultado("leads.select", { data: { nome: "João", email: null, contato: null }, error: null });
    setup();
    await waitFor(() => expect(sb.de("leads", "single")).toHaveLength(1));
    const email = await irParaEnvio();
    expect(email).toHaveValue("");
    expect(screen.getByText(/Nenhum email cadastrado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmar Envio/ })).toBeDisabled();
  });

  it("email inválido mostra o erro e bloqueia o envio", async () => {
    setup();
    const email = await irParaEnvio();
    fireEvent.change(email, { target: { value: "joao@" } });
    expect(screen.getByText(/Digite um email válido/)).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /Confirmar Envio/ })).toBeDisabled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("assunto vazio usa o padrão", async () => {
    setup();
    const email = await irParaEnvio();
    fireEvent.change(email, { target: { value: "outro@cliente.com" } });
    fireEvent.change(screen.getByDisplayValue("Proposta — Casa Verde"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Envio/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(invoke.mock.calls[0][1]).toMatchObject({
      body: { email: "outro@cliente.com", subject: "Proposta — Proposta — Casa Verde" },
    });
  });

  it("erro da edge function avisa e mantém o diálogo aberto", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "Resend fora do ar" } });
    const { onSent, onOpenChange } = setup();
    const email = await irParaEnvio();
    fireEvent.change(email, { target: { value: "joao@cliente.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Envio/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Erro ao enviar email", { description: "Resend fora do ar" })
    );
    expect(reportInvokeError).toHaveBeenCalledWith(expect.any(Error), "send-proposta-email");
    expect(onSent).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Confirmar Envio/ })).toBeEnabled();
  });

  it("voltar ao preview mantém o documento", async () => {
    setup();
    await irParaEnvio();
    fireEvent.click(screen.getByRole("button", { name: /Voltar ao Preview/ }));
    expect(screen.getByText("Proposta Casa Verde")).toBeInTheDocument();
  });

  it("fechar o diálogo volta ao primeiro passo", async () => {
    const { rerender, client, onOpenChange } = setup();
    await irParaEnvio();
    const tree = (open: boolean) => (
      <QueryClientProvider client={client}>
        <GerarPropostaDialog
          open={open}
          onOpenChange={onOpenChange}
          proposta={propostaBase}
          disciplinas={disciplinas}
        />
      </QueryClientProvider>
    );
    rerender(tree(false));
    rerender(tree(true));
    expect(screen.getByText("Gerar Proposta")).toBeInTheDocument();
  });
});
