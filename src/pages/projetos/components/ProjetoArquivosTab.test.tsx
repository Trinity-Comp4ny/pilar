import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Aba Arquivos (SPEC 163): sem conexão (admin conecta, membro vê o aviso), conexão
// expirada, listar com pasta de disciplina, navegar, enviar, criar pasta e excluir.

const h = vi.hoisted(() => ({
  isAdmin: true,
  status: { conectado: true, email: "drive@vrz.com", conectadoEm: null } as Record<string, unknown>,
  pasta: {} as { data?: unknown; error?: unknown; isLoading?: boolean; refetch?: () => void },
  conteudo: {} as Record<string, { itens: unknown[] }>,
  conectar: vi.fn(),
  enviar: vi.fn(),
  criar: vi.fn(),
  lixeira: vi.fn(),
  baixar: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isAdmin: h.isAdmin }) }));
vi.mock("@/hooks/useGoogleDrive", () => ({
  useStatusDrive: () => ({ data: h.status, isLoading: false }),
  usePastaDoProjeto: () => ({ isLoading: false, refetch: vi.fn(), ...h.pasta }),
  useConteudoDaPasta: (id: string) => ({ data: h.conteudo[id] ?? { itens: [] }, isLoading: false, error: null }),
}));
vi.mock("@/lib/googleDrive", async (orig) => ({
  ...(await orig<typeof import("@/lib/googleDrive")>()),
  conectarGoogleDrive: h.conectar,
  enviarArquivo: h.enviar,
  criarPasta: h.criar,
  moverParaLixeira: h.lixeira,
  baixarArquivo: h.baixar,
}));
vi.mock("sonner", () => ({ toast: h.toast }));
// Links têm teste próprio (LinksDoProjeto.test.tsx): aqui só importa que a seção aparece.
vi.mock("./LinksDoProjeto", () => ({ LinksDoProjeto: () => <section aria-label="Links do projeto" /> }));

import { ProjetoArquivosTab } from "./ProjetoArquivosTab";
import { ErroDrive, MIME_PASTA } from "@/lib/googleDrive";

const raiz = {
  pasta_id: "raiz-1234567890",
  pasta_pai_id: null,
  projeto_id: "p1",
  projeto_disciplina_id: null,
  nome: "421 - Casa",
};
const eletrica = {
  pasta_id: "elet-1234567890",
  pasta_pai_id: raiz.pasta_id,
  projeto_id: "p1",
  projeto_disciplina_id: "d1",
  nome: "Elétrica",
};

const cliente = {
  pasta_id: "cli-1234567890",
  pasta_pai_id: raiz.pasta_id,
  projeto_id: "p1",
  projeto_disciplina_id: null,
  nome: "Cliente",
  para_cliente: true,
};

function abrir(canEdit = true) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProjetoArquivosTab projetoId="p1" canEdit={canEdit} />
    </QueryClientProvider>
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  h.isAdmin = true;
  h.status = { conectado: true, email: "drive@vrz.com", conectadoEm: null };
  h.pasta = { data: { raiz, pastas: [raiz, eletrica, cliente] } };
  h.conteudo = {
    [raiz.pasta_id]: {
      itens: [
        { id: eletrica.pasta_id, name: "Elétrica", mimeType: MIME_PASTA },
        { id: cliente.pasta_id, name: "Cliente", mimeType: MIME_PASTA },
        {
          id: "arq-1234567890",
          name: "planta.pdf",
          mimeType: "application/pdf",
          size: "2048",
          webViewLink: "https://drive/x",
        },
      ],
    },
    [cliente.pasta_id]: { itens: [{ id: "ent-1234567890", name: "entrega.pdf", mimeType: "application/pdf" }] },
    [eletrica.pasta_id]: { itens: [{ id: "dwg-1234567890", name: "quadro.dwg", mimeType: "application/acad" }] },
  };
  h.conectar.mockResolvedValue(undefined);
  h.enviar.mockResolvedValue({ id: "novo", name: "novo.pdf", mimeType: "application/pdf" });
  h.criar.mockResolvedValue({ item: {} });
  h.lixeira.mockResolvedValue({ ok: true });
  h.baixar.mockResolvedValue(undefined);
});

describe("ProjetoArquivosTab", () => {
  it("sem Drive: o botão de conectar fica fixo e os links continuam na aba", async () => {
    h.status = { conectado: false };
    const user = abrir();
    expect(screen.getByRole("region", { name: "Links do projeto" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Conectar Google Drive" }));
    expect(h.conectar).toHaveBeenCalled();
  });

  it("com Drive: os links ficam abaixo da pasta", () => {
    h.pasta = { data: { raiz, pastas: [raiz] } };
    abrir();
    expect(screen.getByRole("region", { name: "Links do projeto" })).toBeInTheDocument();
  });

  it("sem Drive e sem ser admin: só o aviso", () => {
    h.status = { conectado: false };
    h.isAdmin = false;
    abrir();
    expect(screen.queryByRole("button", { name: "Conectar Google Drive" })).not.toBeInTheDocument();
    expect(screen.getByText(/quando o admin do escritório conectar/)).toBeInTheDocument();
  });

  it("conexão expirada pede para conectar de novo", () => {
    h.pasta = { error: new ErroDrive("expirou", "reconectar") };
    abrir();
    expect(screen.getByText("A conexão com o Google Drive expirou")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar de novo" })).toBeInTheDocument();
  });

  it("lista a pasta do projeto, marca a pasta da disciplina e navega por ela", async () => {
    const user = abrir();
    const linha = screen.getByText("Elétrica").closest("tr") as HTMLElement;
    expect(within(linha).getByText("disciplina")).toBeInTheDocument();
    // Pasta de disciplina não sai pela lixeira.
    expect(screen.queryByRole("button", { name: "Excluir Elétrica" })).not.toBeInTheDocument();
    await user.click(linha);
    expect(await screen.findByText("quadro.dwg")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "421 - Casa" }));
    expect(await screen.findByText("planta.pdf")).toBeInTheDocument();
  });

  it("envia os arquivos escolhidos para a pasta aberta", async () => {
    const user = abrir();
    const arquivo = new File(["x"], "memorial.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("arquivos-input"), arquivo);
    await waitFor(() => expect(h.enviar).toHaveBeenCalledWith(raiz.pasta_id, arquivo, expect.any(Function)));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Arquivo enviado"));
  });

  it("cria pasta e manda arquivo para a lixeira com confirmação", async () => {
    const user = abrir();
    await user.click(screen.getByRole("button", { name: /Nova pasta/ }));
    await user.type(screen.getByLabelText("Nome"), "Revisão 2");
    await user.click(screen.getByRole("button", { name: "Criar pasta" }));
    await waitFor(() => expect(h.criar).toHaveBeenCalledWith(raiz.pasta_id, "Revisão 2"));

    await user.click(screen.getByRole("button", { name: "Excluir planta.pdf" }));
    await user.click(await screen.findByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(h.lixeira).toHaveBeenCalledWith("arq-1234567890"));
  });

  it("quem só vê não envia, não cria e não exclui, mas baixa", async () => {
    const user = abrir(false);
    expect(screen.queryByRole("button", { name: /Enviar arquivos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nova pasta/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir planta.pdf" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Baixar planta.pdf" }));
    expect(h.baixar).toHaveBeenCalled();
  });

  it("pasta Cliente: marcada como do portal, fixa, e avisa dentro dela", async () => {
    const user = abrir();
    const linha = screen.getByText("Cliente").closest("tr") as HTMLElement;
    expect(within(linha).getByText("aparece no portal do cliente")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir Cliente" })).not.toBeInTheDocument();
    expect(screen.queryByText(/O cliente vê esta pasta/)).not.toBeInTheDocument();
    await user.click(linha);
    expect(await screen.findByText("entrega.pdf")).toBeInTheDocument();
    expect(screen.getByText(/O cliente vê esta pasta no portal/)).toBeInTheDocument();
  });

  it("arrastar arquivo mostra o aviso de soltar e o drop envia", async () => {
    abrir();
    expect(screen.queryByText(/Aparece aqui o que foi criado/)).not.toBeInTheDocument();
    const alvo = screen.getByText("planta.pdf").closest(".relative") as HTMLElement;
    const arquivo = new File(["x"], "corte.pdf", { type: "application/pdf" });
    const dataTransfer = { types: ["Files"], files: [arquivo] };
    fireEvent.dragEnter(alvo, { dataTransfer });
    expect(screen.getByText("Solte para enviar")).toBeInTheDocument();
    expect(screen.getByText("Os arquivos vão para a pasta 421 - Casa")).toBeInTheDocument();
    fireEvent.drop(alvo, { dataTransfer });
    expect(screen.queryByText("Solte para enviar")).not.toBeInTheDocument();
    await waitFor(() => expect(h.enviar).toHaveBeenCalledWith(raiz.pasta_id, arquivo, expect.any(Function)));
  });
});
