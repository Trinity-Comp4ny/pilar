import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  h.pasta = { data: { raiz, pastas: [raiz, eletrica] } };
  h.conteudo = {
    [raiz.pasta_id]: {
      itens: [
        { id: eletrica.pasta_id, name: "Elétrica", mimeType: MIME_PASTA },
        {
          id: "arq-1234567890",
          name: "planta.pdf",
          mimeType: "application/pdf",
          size: "2048",
          webViewLink: "https://drive/x",
        },
      ],
    },
    [eletrica.pasta_id]: { itens: [{ id: "dwg-1234567890", name: "quadro.dwg", mimeType: "application/acad" }] },
  };
  h.conectar.mockResolvedValue(undefined);
  h.enviar.mockResolvedValue({ id: "novo", name: "novo.pdf", mimeType: "application/pdf" });
  h.criar.mockResolvedValue({ item: {} });
  h.lixeira.mockResolvedValue({ ok: true });
  h.baixar.mockResolvedValue(undefined);
});

describe("ProjetoArquivosTab", () => {
  it("sem Drive: admin conecta; membro vê que depende do admin", async () => {
    h.status = { conectado: false };
    const user = abrir();
    await user.click(screen.getByRole("button", { name: "Conectar Google Drive" }));
    expect(h.conectar).toHaveBeenCalled();
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
});
