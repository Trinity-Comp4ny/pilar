import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EstruturaFluxo } from "@/pages/obras/lib/fluxoObra";

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const h = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  fluxos: [] as unknown[],
  carregando: false,
  salvar: vi.fn(),
  excluir: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/pages/obras/hooks/useFluxosObra", () => ({
  useFluxosObra: () => ({ data: h.fluxos, isLoading: h.carregando }),
  useSalvarFluxoObra: () => ({ mutateAsync: h.salvar, isPending: false }),
  useExcluirFluxoObra: () => ({ mutateAsync: h.excluir, isPending: false }),
}));
vi.mock("@/pages/obras/hooks/useFornecedoresLite", () => ({
  useFornecedoresLite: () => ({ data: [{ id: "f1", nome: "Silva Estruturas" }] }),
}));
vi.mock("./SincronizarObrasDialog", () => ({
  SincronizarObrasDialog: ({ fluxo }: { fluxo: { nome: string } | null }) =>
    fluxo ? <div>Sincronizar {fluxo.nome}</div> : null,
}));

import { FluxosObraDialog } from "./FluxosObraDialog";

const estrutura: EstruturaFluxo = [
  {
    nome: "Fundação",
    etapas: [
      {
        nome: "Escavação",
        servicos: [
          { nome: "Locação", duracao_dias: 3, fornecedor_id: null, paralelo: false, tarefas: ["Marcar eixos"] },
        ],
      },
    ],
  },
];
const fluxo = { id: "x1", nome: "Residencial", descricao: "Casas", estrutura };

beforeEach(() => {
  vi.clearAllMocks();
  h.fluxos = [];
  h.carregando = false;
  h.salvar.mockResolvedValue("novo");
  h.excluir.mockResolvedValue(undefined);
});

describe("FluxosObraDialog", () => {
  it("sem fluxo explica como criar", () => {
    render(<FluxosObraDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Nenhum fluxo ainda/)).toBeInTheDocument();
  });

  it("lista os fluxos com serviços e duração", () => {
    h.fluxos = [fluxo];
    render(<FluxosObraDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Residencial")).toBeInTheDocument();
    expect(screen.getByText(/1 serviços · 3 dias/)).toBeInTheDocument();
  });

  it("não mostra a lista enquanto carrega", () => {
    h.carregando = true;
    render(<FluxosObraDialog open onOpenChange={vi.fn()} />);
    expect(screen.queryByText(/Nenhum fluxo ainda/)).not.toBeInTheDocument();
  });

  it("cria um fluxo novo preenchendo a primeira linha", async () => {
    render(<FluxosObraDialog open onOpenChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Novo fluxo/ }));
    expect(screen.getByRole("button", { name: "Salvar fluxo" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Nome"), "Comercial");
    await userEvent.type(screen.getByLabelText("Fase da linha 1"), "Estrutura");
    await userEvent.type(screen.getByLabelText("Etapa da linha 1"), "Fundação");
    await userEvent.type(screen.getByLabelText("Serviço da linha 1"), "Sapatas");
    await userEvent.type(screen.getByLabelText("Tarefas da linha 1"), "Armar; Concretar");
    expect(screen.getByText(/5 dias no total/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar fluxo" }));
    await waitFor(() => expect(h.salvar).toHaveBeenCalled());
    expect(h.salvar.mock.calls[0][0].nome).toBe("Comercial");
    expect(h.toast.success).toHaveBeenCalledWith("Fluxo criado");
    expect(screen.queryByText(/Sincronizar/)).not.toBeInTheDocument();
  });

  it("adiciona e remove linhas, mudando duração, prestador e paralelo", async () => {
    render(<FluxosObraDialog open onOpenChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Novo fluxo/ }));
    await userEvent.type(screen.getByLabelText("Fase da linha 1"), "A");
    await userEvent.type(screen.getByLabelText("Etapa da linha 1"), "B");
    await userEvent.type(screen.getByLabelText("Serviço da linha 1"), "C");
    await userEvent.click(screen.getByRole("button", { name: /Adicionar serviço/ }));
    expect(screen.getByLabelText("Fase da linha 2")).toHaveValue("A");
    await userEvent.type(screen.getByLabelText("Serviço da linha 2"), "D");
    await userEvent.clear(screen.getByLabelText("Duração em dias da linha 2"));
    await userEvent.type(screen.getByLabelText("Duração em dias da linha 2"), "7");
    await userEvent.click(screen.getAllByRole("switch")[1]);
    await userEvent.click(screen.getByLabelText("Prestador da linha 2"));
    await userEvent.click(await screen.findByRole("option", { name: "Silva Estruturas" }));
    await userEvent.click(screen.getByRole("button", { name: "Remover a linha 1" }));
    expect(screen.queryByLabelText("Fase da linha 2")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remover a linha 1" }));
    expect(screen.getByLabelText("Fase da linha 1")).toBeInTheDocument();
  });

  it("editar um fluxo existente oferece atualizar as obras", async () => {
    h.fluxos = [fluxo];
    render(<FluxosObraDialog open onOpenChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Editar Residencial" }));
    expect(screen.getByLabelText("Nome")).toHaveValue("Residencial");
    await userEvent.type(screen.getByLabelText("Nome"), " 2");
    await userEvent.click(screen.getByRole("button", { name: "Salvar fluxo" }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Fluxo atualizado"));
    expect(await screen.findByText("Sincronizar Residencial 2")).toBeInTheDocument();
  });

  it("erro ao salvar avisa e mantém o editor", async () => {
    h.salvar.mockRejectedValue(new Error("RLS negou"));
    h.fluxos = [fluxo];
    render(<FluxosObraDialog open onOpenChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Editar Residencial" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar fluxo" }));
    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "RLS negou" })
    );
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });

  it("exclui com confirmação e avisa quando falha", async () => {
    h.fluxos = [fluxo];
    render(<FluxosObraDialog open onOpenChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Excluir Residencial" }));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(h.excluir).toHaveBeenCalledWith("x1"));

    h.excluir.mockRejectedValue(new Error("x"));
    await userEvent.click(screen.getByRole("button", { name: "Excluir Residencial" }));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Não foi possível excluir", expect.anything()));
  });
});
