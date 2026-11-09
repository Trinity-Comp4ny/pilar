import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { DisciplinaResponsavel, Projeto } from "@/types/projetos";

// Modal do projeto aberto pelo quadro: cabeçalho, disciplinas (adicionar, excluir com
// confirmação, troca de status com data de entrega e justificativa de atraso), ações de
// menu, abrir a disciplina no modal rico e erros do servidor.

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: { email: "dev@local.test" } }) }));
const disc = vi.hoisted(() => ({ lista: [] as unknown[], status: vi.fn() }));
vi.mock("@/hooks/useProjetoDisciplinas", () => ({
  useProjetoDisciplinas: () => ({ data: disc.lista }),
  useUpdateDisciplinaStatus: () => ({ mutateAsync: disc.status }),
}));
const det = vi.hoisted(() => ({ salvar: vi.fn(), adicionar: vi.fn(), remover: vi.fn() }));
vi.mock("../hooks/useProjetoDetail", () => ({
  useProjetoDetail: () => ({
    disciplinasCatalog: [{ id: "cat-1", nome: "Hidráulica" }],
    pessoas: [
      { id: "pes-1", nome: "Ana" },
      { id: "pes-2", nome: "Bruno" },
    ],
    getDbDisc: (i: number) => disc.lista[i],
    handleSaveDiscChanges: det.salvar,
    handleAddDisc: det.adicionar,
    handleRemoveDisc: det.remover,
  }),
}));
const ativ = vi.hoisted(() => ({ salvar: vi.fn() }));
vi.mock("../hooks/useProjetoAtividades", () => ({
  useProjetoAtividades: () => ({ links: [], salvar: { mutate: ativ.salvar } }),
}));
vi.mock("./ProjetoAtividadesPanel", () => ({ ProjetoAtividadesPanel: () => <div>painel-atividades</div> }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
type DlgProps = Record<string, unknown> & { open: boolean; disciplina: DisciplinaResponsavel | null };
vi.mock("./DisciplinaDetailDialog", () => ({
  DisciplinaDetailDialog: (p: DlgProps) => {
    if (!p.open) return null;
    const f =
      (n: string, ...a: unknown[]) =>
      () =>
        (p[n] as (...x: unknown[]) => unknown)(...a);
    return (
      <div role="dialog" aria-label="disciplina-rica">
        <span>rica:{p.disciplina?.disciplina}</span>
        <button onClick={f("onUpdateField", "data_previsao", "2026-08-01")}>rica-campo</button>
        <button onClick={f("onUpdateField", "observacoes", "obs")}>rica-campo-livre</button>
        <button onClick={f("onUpdateField", "status", "Em Andamento")}>rica-status</button>
        <button onClick={f("onUpdateResponsaveis", ["pes-2"])}>rica-resp</button>
        <button onClick={f("onUpdateLabels", ["a"])}>rica-labels</button>
        <button onClick={f("onUpdateLinks", [])}>rica-links</button>
        <button onClick={f("onUpdateComentarios", [])}>rica-coment</button>
        <button onClick={f("onUpdateDescricao", "d")}>rica-desc</button>
        <button onClick={f("onUpdateHorasEstimadas", 1)}>rica-he</button>
        <button onClick={f("onUpdateHorasRealizadas", 2)}>rica-hr</button>
        {typeof p.onDelete === "function" && <button onClick={f("onDelete")}>rica-excluir</button>}
        <button onClick={f("onOpenChange", false)}>rica-fechar</button>
      </div>
    );
  },
}));

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { ProjectDetailDialog } from "./ProjectDetailDialog";

const projeto = {
  id: "proj-1",
  nome: "Residência Silva",
  cliente_nome: "Ana",
  status: "Em Andamento",
  prioridade: "Alta",
  valor_contrato: 100000,
  area_m2: 250,
  data_inicio: "2026-01-01",
  data_previsao: "2099-12-31",
  localizacao: "Campinas, SP",
  observacao: "Cliente prefere reuniões às sextas",
} as unknown as Projeto;

const disciplinas = [
  {
    id: "d-1",
    nome: "Estrutural",
    status: "Em Andamento",
    data_inicio: "2026-01-10",
    data_fim: "2026-02-01",
    data_fim_real: null,
    justificativa_atraso: null,
    responsaveis: [{ id: "pes-1", nome: "Ana" }],
  },
  {
    id: "d-2",
    nome: "Elétrica",
    status: "Concluído",
    data_inicio: "2026-01-10",
    data_fim: "2026-03-01",
    data_fim_real: "2026-02-20",
    responsaveis: [],
  },
  {
    id: "d-3",
    nome: "Hidráulica",
    status: "Não Iniciado",
    data_inicio: null,
    data_fim: "2099-01-01",
    data_fim_real: null,
    responsaveis: [],
  },
];

function montar(props: Partial<Parameters<typeof ProjectDetailDialog>[0]> = {}) {
  const handlers = { onOpenChange: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onProjectUpdated: vi.fn() };
  function Harness() {
    const [open, setOpen] = useState(true);
    return (
      <ProjectDetailDialog
        open={open}
        projeto={projeto}
        canEdit
        {...handlers}
        onOpenChange={(v) => {
          handlers.onOpenChange(v);
          setOpen(v);
        }}
        {...props}
      />
    );
  }
  const ui = render(<Harness />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={["/projetos"]}>
        <Routes>
          <Route path="/projetos" element={children} />
          <Route path="/projetos/:id" element={<div>pagina-do-projeto</div>} />
        </Routes>
      </MemoryRouter>
    ),
  });
  return { ...handlers, ...ui };
}

const cabecalhoDisciplinas = () => screen.getByText(/^Disciplinas \(/).parentElement as HTMLElement;
const botaoAdicionar = () => within(cabecalhoDisciplinas()).getByRole("button", { name: /Adicionar/ });

function escolherStatus(disciplina: string, status: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: `Status de ${disciplina}` }), { key: "Enter" });
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: status }));
}

describe("ProjectDetailDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    disc.lista = disciplinas;
    disc.status.mockResolvedValue(undefined);
    det.salvar.mockResolvedValue(undefined);
    det.adicionar.mockResolvedValue(undefined);
    det.remover.mockResolvedValue(undefined);
  });

  it("sem projeto não renderiza", () => {
    const { container } = montar({ projeto: null });
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra cabeçalho, metadados, disciplinas e observação", () => {
    montar();
    expect(screen.getByRole("heading", { name: "Residência Silva" })).toBeInTheDocument();
    expect(screen.getByText("Campinas, SP")).toBeInTheDocument();
    expect(screen.getByText(/250 m²/)).toBeInTheDocument();
    expect(screen.getByText("Disciplinas (3)")).toBeInTheDocument();
    expect(screen.getByText("Atrasada")).toBeInTheDocument();
    expect(screen.getAllByText("Sem responsável").length).toBe(2);
    expect(screen.getByText(/Concluída/)).toBeInTheDocument();
    expect(screen.getByText("Cliente prefere reuniões às sextas")).toBeInTheDocument();
  });

  it("projeto sem disciplinas convida a adicionar", () => {
    disc.lista = [];
    montar();
    expect(screen.getByText("Nenhuma disciplina definida.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar disciplina/ }));
    expect(screen.getByText("Disciplina")).toBeInTheDocument();
  });

  it("sem edição não há menu, adicionar nem excluir", () => {
    montar({ canEdit: false, projeto: { ...projeto, cliente_nome: undefined } as Projeto });
    expect(screen.queryByRole("button", { name: "Mais opções" })).not.toBeInTheDocument();
    expect(within(cabecalhoDisciplinas()).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir disciplina" })).not.toBeInTheDocument();
    expect(screen.getByText("Sem cliente")).toBeInTheDocument();
  });

  it("menu: editar dados e excluir projeto", async () => {
    const h = montar();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Mais opções" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Editar dados/ }));
    expect(h.onEdit).toHaveBeenCalledWith(projeto);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Mais opções" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Excluir projeto/ }));
    expect(h.onDelete).toHaveBeenCalledWith("proj-1");
  });

  it("abrir projeto completo navega e fecha o modal", () => {
    const h = montar();
    fireEvent.click(screen.getByRole("button", { name: /Abrir projeto completo/ }));
    expect(h.onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByText("pagina-do-projeto")).toBeInTheDocument();
  });

  it("adicionar disciplina exige disciplina e responsável", async () => {
    const h = montar();
    fireEvent.click(botaoAdicionar());
    const add = () =>
      within(screen.getByRole("button", { name: "Cancelar" }).parentElement as HTMLElement).getByRole("button", {
        name: "Adicionar",
      });
    expect(add()).toBeDisabled();
    const [selDisc, selResp] = screen
      .getAllByRole("combobox")
      .filter((c) => !c.getAttribute("aria-label")?.startsWith("Status"));
    fireEvent.keyDown(selDisc, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Hidráulica" }));
    fireEvent.keyDown(selResp, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Bruno" }));
    fireEvent.click(add());
    await waitFor(() =>
      expect(det.adicionar).toHaveBeenCalledWith({ disciplina: "Hidráulica", responsavel_id: "pes-2" })
    );
    await waitFor(() => expect(h.onProjectUpdated).toHaveBeenCalled());
  });

  it("cancelar a adição volta ao estado inicial", () => {
    montar();
    fireEvent.click(botaoAdicionar());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Responsável")).not.toBeInTheDocument();
  });

  it("excluir disciplina pede confirmação com o nome", async () => {
    const h = montar();
    fireEvent.click(screen.getAllByRole("button", { name: "Excluir disciplina" })[1]);
    expect(await screen.findByText(/A disciplina "Elétrica" e seus dados serão removidos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(det.remover).toHaveBeenCalledWith(1));
    expect(h.onProjectUpdated).toHaveBeenCalled();
  });

  it("concluir pede a data real e grava com ela", async () => {
    montar();
    escolherStatus("Hidráulica", "Concluído");
    expect(await screen.findByText("Confirmar conclusão")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(disc.status).toHaveBeenCalled());
    const hoje = new Date().toISOString().split("T")[0];
    expect(disc.status).toHaveBeenCalledWith(
      expect.objectContaining({ id: "d-3", status: "Concluído", data_fim_real: hoje })
    );
    expect(toast.success).toHaveBeenCalledWith("Hidráulica: Concluído");
  });

  it("disciplina atrasada exige justificativa antes de mudar o status", async () => {
    montar();
    escolherStatus("Estrutural", "Não Iniciado");
    expect(await screen.findByText("Justificativa de atraso obrigatória")).toBeInTheDocument();
    const confirmar = screen.getByRole("button", { name: "Confirmar" });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Explique o motivo do atraso..."), {
      target: { value: "  cliente atrasou o levantamento " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(disc.status).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "d-1",
          status: "Não Iniciado",
          justificativa_atraso: "cliente atrasou o levantamento",
        })
      )
    );
  });

  it("disciplina em dia muda direto; erro do servidor avisa", async () => {
    disc.status.mockRejectedValue(new Error("RLS"));
    montar();
    escolherStatus("Hidráulica", "Em Andamento");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao atualizar"));
  });

  describe("modal rico da disciplina", () => {
    function abrirRica(h: ReturnType<typeof montar>) {
      fireEvent.click(screen.getByText("Estrutural"));
      expect(h.onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.getByText("rica:Estrutural")).toBeInTheDocument();
    }

    it("campos vão para a coluna certa do banco", async () => {
      const h = montar();
      abrirRica(h);
      fireEvent.click(screen.getByRole("button", { name: "rica-campo" }));
      await waitFor(() =>
        expect(det.salvar).toHaveBeenCalledWith(expect.objectContaining({ id: "d-1", data_fim: "2026-08-01" }))
      );
      fireEvent.click(screen.getByRole("button", { name: "rica-campo-livre" }));
      await waitFor(() => expect(det.salvar).toHaveBeenLastCalledWith(expect.objectContaining({ observacoes: "obs" })));
      fireEvent.click(screen.getByRole("button", { name: "rica-resp" }));
      await waitFor(() =>
        expect(det.salvar).toHaveBeenLastCalledWith(
          expect.objectContaining({ responsaveis: [{ id: "pes-2", nome: "Bruno" }] })
        )
      );
      for (const b of ["rica-labels", "rica-links", "rica-coment", "rica-desc", "rica-he", "rica-hr"]) {
        fireEvent.click(screen.getByRole("button", { name: b }));
      }
      await waitFor(() => expect(det.salvar).toHaveBeenCalledTimes(9));
      expect(h.onProjectUpdated).toHaveBeenCalled();
    });

    it("status pelo modal rico passa pelas travas (atrasada pede justificativa)", async () => {
      const h = montar();
      abrirRica(h);
      fireEvent.click(screen.getByRole("button", { name: "rica-status" }));
      expect(await screen.findByText("Justificativa de atraso obrigatória")).toBeInTheDocument();
    });

    it("fechar volta ao modal do projeto; excluir remove", async () => {
      const h = montar();
      abrirRica(h);
      fireEvent.click(screen.getByRole("button", { name: "rica-excluir" }));
      await waitFor(() => expect(det.remover).toHaveBeenCalledWith(0));
      expect(h.onOpenChange).toHaveBeenCalledWith(true);
    });

    it("fechar sem excluir reabre o projeto", () => {
      const h = montar();
      abrirRica(h);
      fireEvent.click(screen.getByRole("button", { name: "rica-fechar" }));
      expect(h.onOpenChange).toHaveBeenLastCalledWith(true);
      expect(screen.queryByText("rica:Estrutural")).not.toBeInTheDocument();
    });
  });
});
