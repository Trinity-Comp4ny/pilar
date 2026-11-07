import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// Gerenciador de fluxos de disciplinas: lista (vazia e com fluxos), criar com colunas e
// disciplinas em paralelo, reordenar colunas, duração/responsáveis/tarefas, editar,
// excluir com confirmação, validações e erro do servidor.

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const fx = vi.hoisted(() => ({ lista: [] as unknown[], criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() }));
vi.mock("@/hooks/useFluxosDisciplinas", () => ({
  useFluxosDisciplinas: () => ({ data: fx.lista }),
  useCreateFluxo: () => ({ mutateAsync: fx.criar, isPending: false }),
  useUpdateFluxo: () => ({ mutateAsync: fx.atualizar, isPending: false }),
  useDeleteFluxo: () => ({ mutateAsync: fx.excluir, isPending: false }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/pages/projetos/components/TarefasEditor", () => ({
  TarefasEditor: ({ onChange }: { onChange: (v: unknown[]) => void }) => (
    <button onClick={() => onChange([{ texto: "Memorial", dias_uteis: 2, responsavel_id: "pes-1" }])}>
      definir-tarefas
    </button>
  ),
}));
vi.mock("@/components/SeletorResponsaveis", () => ({
  SeletorResponsaveis: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button onClick={() => onChange(["pes-2", "fantasma"])}>escolher-responsaveis</button>
  ),
}));

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
})) as unknown as typeof window.matchMedia;

import { FluxoDisciplinasDialog } from "./FluxoDisciplinasDialog";

const disciplinas = [
  { id: "c-1", nome: "Arquitetura" },
  { id: "c-2", nome: "Estrutural" },
  { id: "c-3", nome: "Elétrica" },
];
const pessoas = [
  { id: "pes-1", nome: "Ana" },
  { id: "pes-2", nome: "Bruno" },
];

function montar() {
  const onOpenChange = vi.fn();
  render(<FluxoDisciplinasDialog open onOpenChange={onOpenChange} disciplinas={disciplinas} pessoas={pessoas} />);
  return { onOpenChange };
}

function escolher(placeholder: string, opcao: string) {
  const combo = screen.getAllByRole("combobox").find((c) => c.textContent?.includes(placeholder))!;
  fireEvent.keyDown(combo, { key: "Enter" });
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }));
}

describe("FluxoDisciplinasDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fx.lista = [];
    fx.criar.mockResolvedValue(undefined);
    fx.atualizar.mockResolvedValue(undefined);
    fx.excluir.mockResolvedValue(undefined);
  });

  it("sem fluxos mostra o vazio", () => {
    montar();
    expect(screen.getByText("Nenhum fluxo criado ainda")).toBeInTheDocument();
  });

  it("lista fluxos com colunas e disciplinas", () => {
    fx.lista = [
      {
        id: "f-1",
        nome: "Residencial",
        descricao: "Casas térreas",
        disciplinas: [
          { ordem: 1, nome: "Arquitetura" },
          { ordem: 2, nome: "Estrutural" },
          { ordem: 2, nome: "Elétrica" },
        ],
      },
      { id: "f-2", nome: "Simples", descricao: null, disciplinas: [{ ordem: 1, nome: "Arquitetura" }] },
    ];
    montar();
    expect(screen.getByText("Residencial")).toBeInTheDocument();
    expect(screen.getByText("Casas térreas")).toBeInTheDocument();
    expect(screen.getByText("2 colunas")).toBeInTheDocument();
    expect(screen.getByText("3 disciplinas")).toBeInTheDocument();
    expect(screen.getByText("Estrutural, Elétrica")).toBeInTheDocument();
    expect(screen.getByText("1 coluna")).toBeInTheDocument();
    expect(screen.getByText("1 disciplina")).toBeInTheDocument();
  });

  it("criar exige nome e ao menos uma disciplina", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Novo fluxo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar fluxo" }));
    expect(toast.error).toHaveBeenCalledWith("Nome do fluxo é obrigatório");
    fireEvent.change(screen.getByPlaceholderText("Ex: Fluxo Residencial"), { target: { value: "Comercial" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar fluxo" }));
    expect(toast.error).toHaveBeenCalledWith("Adicione pelo menos uma disciplina");
    expect(fx.criar).not.toHaveBeenCalled();
  });

  it("monta colunas, paralelas, duração, responsáveis e tarefas e cria", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Novo fluxo/ }));
    expect(screen.getByText("Adicione disciplinas para ver o fluxo montado aqui")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Ex: Fluxo Residencial"), { target: { value: "  Comercial " } });
    fireEvent.change(screen.getByPlaceholderText("Opcional"), { target: { value: "Lojas" } });
    escolher("+ próxima coluna", "Arquitetura");
    escolher("+ próxima coluna", "Estrutural");
    escolher("+ disciplina em paralelo aqui", "Elétrica");

    const duracoes = screen.getAllByPlaceholderText("—");
    fireEvent.change(duracoes[0], { target: { value: "10" } });
    fireEvent.change(duracoes[1], { target: { value: "0" } });
    fireEvent.click(screen.getAllByRole("button", { name: "escolher-responsaveis" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "definir-tarefas" })[1]);

    fireEvent.click(screen.getByRole("button", { name: "Criar fluxo" }));
    await waitFor(() => expect(fx.criar).toHaveBeenCalled());
    const payload = fx.criar.mock.calls[0][0];
    expect(payload.nome).toBe("Comercial");
    expect(payload.descricao).toBe("Lojas");
    expect(payload.disciplinas).toHaveLength(3);
    expect(payload.disciplinas[0]).toMatchObject({
      nome: "Arquitetura",
      ordem: 1,
      duracao_dias_uteis: 10,
      responsaveis_ids: ["pes-2", "fantasma"],
      responsaveis_nomes: ["Bruno"],
    });
    expect(payload.disciplinas[0]).not.toHaveProperty("_key");
    expect(payload.disciplinas.find((d: { nome: string }) => d.nome === "Elétrica").duracao_dias_uteis).toBeUndefined();
    expect(payload.disciplinas.find((d: { nome: string }) => d.nome === "Elétrica")).toMatchObject({
      checklist_padrao: [expect.objectContaining({ texto: "Memorial" })],
    });
    // "em paralelo" entra na mesma coluna da primeira disciplina
    expect(payload.disciplinas.find((d: { nome: string }) => d.nome === "Elétrica").ordem).toBe(1);
    expect(payload.disciplinas.find((d: { nome: string }) => d.nome === "Estrutural").ordem).toBe(2);
    expect(toast.success).toHaveBeenCalledWith("Fluxo criado");
    expect(screen.getByRole("button", { name: /Novo fluxo/ })).toBeInTheDocument();
  });

  it("mover coluna e remover disciplina renumeram as ordens", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Novo fluxo/ }));
    fireEvent.change(screen.getByPlaceholderText("Ex: Fluxo Residencial"), { target: { value: "F" } });
    escolher("+ próxima coluna", "Arquitetura");
    escolher("+ próxima coluna", "Estrutural");
    escolher("+ próxima coluna", "Elétrica");
    // primeira coluna desce (troca com a segunda)
    const setas = screen.getAllByRole("button").filter((b) => b.querySelector("svg.lucide-arrow-down"));
    fireEvent.click(setas[0]);
    const sobe = screen.getAllByRole("button").filter((b) => b.querySelector("svg.lucide-arrow-up"));
    fireEvent.click(sobe[0]);
    // remove "Arquitetura" (o X ao lado do badge)
    const badge = screen.getAllByText("Arquitetura").find((e) => e.className.includes("text-sm"))!;
    fireEvent.click(
      within(badge.parentElement as HTMLElement)
        .getAllByRole("button")
        .at(-1)!
    );
    fireEvent.click(screen.getByRole("button", { name: "Criar fluxo" }));
    await waitFor(() => expect(fx.criar).toHaveBeenCalled());
    const ordens = fx.criar.mock.calls[0][0].disciplinas.map((d: { nome: string; ordem: number }) => [d.nome, d.ordem]);
    expect(ordens.map((o: [string, number]) => o[0])).not.toContain("Arquitetura");
    expect(ordens.map((o: [string, number]) => o[1]).sort()).toEqual([1, 2]);
  });

  it("editar carrega o fluxo e salva alterações", async () => {
    fx.lista = [
      {
        id: "f-1",
        nome: "Residencial",
        descricao: null,
        disciplinas: [
          { ordem: 1, nome: "Arquitetura", checklist_padrao: [{ texto: "x", dias_uteis: 3, responsavel_id: "pes-1" }] },
        ],
      },
    ];
    montar();
    const card = screen.getByText("Residencial").closest(".rounded-lg") as HTMLElement;
    fireEvent.click(within(card).getAllByRole("button")[0]);
    expect(screen.getByText("Editar fluxo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Residencial")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(fx.atualizar).toHaveBeenCalledWith(expect.objectContaining({ id: "f-1", nome: "Residencial" }))
    );
    expect(toast.success).toHaveBeenCalledWith("Fluxo atualizado");
  });

  it("erro ao salvar mantém o formulário", async () => {
    fx.criar.mockRejectedValue(new Error("RLS"));
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Novo fluxo/ }));
    fireEvent.change(screen.getByPlaceholderText("Ex: Fluxo Residencial"), { target: { value: "F" } });
    escolher("+ próxima coluna", "Arquitetura");
    fireEvent.click(screen.getByRole("button", { name: "Criar fluxo" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao salvar fluxo"));
    expect(screen.getByText("Novo fluxo")).toBeInTheDocument();
  });

  it("voltar e cancelar retornam à lista", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Novo fluxo/ }));
    fireEvent.click(screen.getByRole("button", { name: /Voltar/ }));
    expect(screen.getByText("Fluxos de disciplinas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Novo fluxo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Fluxos de disciplinas")).toBeInTheDocument();
  });

  it("excluir pede confirmação; erro avisa", async () => {
    fx.lista = [{ id: "f-1", nome: "Residencial", descricao: null, disciplinas: [] }];
    montar();
    const card = screen.getByText("Residencial").closest(".rounded-lg") as HTMLElement;
    fireEvent.click(within(card).getAllByRole("button")[1]);
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(fx.excluir).toHaveBeenCalledWith("f-1"));
    expect(toast.success).toHaveBeenCalledWith("Fluxo excluído");

    fx.excluir.mockRejectedValue(new Error("em uso"));
    fireEvent.click(within(card).getAllByRole("button")[1]);
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao excluir fluxo"));
  });

  it("fechar o diálogo volta à lista", () => {
    const { onOpenChange } = montar();
    fireEvent.click(screen.getByRole("button", { name: /Novo fluxo/ }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
