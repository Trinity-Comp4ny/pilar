import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ItemTrabalho } from "../useItensTrabalho";
import type { Etapa } from "../useEtapas";
import { QuadroTrabalho, type EtapaControls } from "./QuadroTrabalho";

/**
 * Quadro de Tarefas: colunas = etapas, cards com prioridade editável só na
 * tarefa, menu de editar/excluir, prazo atrasado destacado e ações de coluna
 * (âncora de status não se exclui).
 */

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const ETAPAS: Etapa[] = [
  { id: "e-fazer", nome: "A fazer", ordem: 0, cor: null, bucket: "a_fazer" },
  { id: "x1", nome: "Revisão", ordem: 1, cor: "#3b82f6", bucket: null },
  { id: "e-ok", nome: "Concluído", ordem: 2, cor: null, bucket: "concluida" },
];

const base: ItemTrabalho = {
  key: "",
  tipo: "tarefa",
  id: "",
  numero: 1,
  titulo: "",
  status: "a_fazer",
  prioridade: "media",
  prazo: null,
  projetoId: null,
  projetoNome: null,
  obraCaminho: null,
  responsavelId: null,
  responsavelNome: null,
  responsaveis: [],
  etapaId: null,
  labels: [],
  horasEstimadas: null,
  horasReais: null,
  comentarios: 0,
  links: 0,
};

const ITENS: ItemTrabalho[] = [
  {
    ...base,
    key: "tarefa:t1",
    id: "t1",
    titulo: "Revisar prancha",
    prazo: "2020-01-10",
    responsaveis: [{ id: "pe1", nome: "Rita" }],
    projetoNome: "Casa Ipê",
    obraCaminho: "Obra Aurora · Execução",
    labels: ["urgente"],
    comentarios: 2,
    links: 1,
  },
  {
    ...base,
    key: "disciplina:d1",
    tipo: "disciplina",
    id: "d1",
    numero: null,
    titulo: "Estrutural",
    status: "concluida",
    prioridade: "alta",
    prazo: "2020-01-10",
  },
  { ...base, key: "tarefa:t2", id: "t2", titulo: "Extra", etapaId: "x1", prazo: "data-ruim" },
];

function renderQuadro() {
  const handlers = { onAbrir: vi.fn(), onPrioridade: vi.fn(), onExcluir: vi.fn(), onMover: vi.fn() };
  const etapaControls: EtapaControls = {
    etapas: ETAPAS,
    onCriar: vi.fn().mockResolvedValue(true),
    criando: false,
    onEditar: vi.fn(),
    onExcluir: vi.fn(),
    onReordenar: vi.fn(),
  };
  render(
    <QuadroTrabalho itens={ITENS} sort={{ key: "dueDate", dir: "asc" }} etapaControls={etapaControls} {...handlers} />
  );
  return { ...handlers, etapaControls, user: userEvent.setup() };
}

const card = (titulo: string) => screen.getByText(titulo).closest("[class*='rounded']") as HTMLElement;

describe("QuadroTrabalho", () => {
  it("cada item cai na sua coluna, com metadados e contadores", () => {
    renderQuadro();
    expect(screen.getByText("Revisar prancha")).toBeInTheDocument();
    expect(screen.getByText("Rita")).toBeInTheDocument();
    expect(screen.getByText("Casa Ipê")).toBeInTheDocument();
    expect(screen.getByText("Obra Aurora · Execução")).toBeInTheDocument();
    expect(screen.getByText("urgente")).toBeInTheDocument();
    expect(screen.getAllByText("Tarefa").length).toBe(2);
    expect(screen.getByText("Disciplina")).toBeInTheDocument();
  });

  it("prazo vencido de tarefa aberta fica em destaque; de item concluído não", () => {
    renderQuadro();
    const prazos = screen.getAllByText(/10 de jan|10 jan/);
    const [daTarefa, daDisciplina] = prazos;
    expect(daTarefa.closest("span")).toHaveClass("text-negative-strong");
    expect(daDisciplina.closest("span")).not.toHaveClass("text-negative-strong");
  });

  it("abrir, mudar prioridade e excluir pelo card da tarefa", async () => {
    const { user, onAbrir, onPrioridade, onExcluir } = renderQuadro();
    await user.click(screen.getByText("Revisar prancha"));
    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));

    const alvo = card("Revisar prancha");
    await user.click(within(alvo).getByTitle("Mudar prioridade"));
    await user.click(await screen.findByRole("menuitem", { name: "Alta" }));
    expect(onPrioridade).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), "alta");

    await user.click(within(card("Revisar prancha")).getByRole("button", { name: "Mais opções" }));
    await user.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    expect(onExcluir).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
    expect(onAbrir).toHaveBeenCalledTimes(1);
  });

  it("disciplina não tem prioridade editável nem menu", () => {
    renderQuadro();
    const alvo = card("Estrutural");
    expect(within(alvo).queryByTitle("Mudar prioridade")).not.toBeInTheDocument();
    expect(within(alvo).queryByRole("button", { name: "Mais opções" })).not.toBeInTheDocument();
  });

  it("ações de coluna: editar, mover e excluir só na coluna extra", async () => {
    const { user, etapaControls } = renderQuadro();
    const menus = screen.getAllByRole("button", { name: "Ações da coluna" });
    await user.click(menus[0]);
    expect(await screen.findByRole("menuitem", { name: /Mover para esquerda/ })).toHaveAttribute("data-disabled");
    expect(screen.queryByRole("menuitem", { name: /Excluir/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /Mover para direita/ }));
    expect(etapaControls.onReordenar).toHaveBeenCalledWith("e-fazer", 1);

    await user.click(screen.getAllByRole("button", { name: "Ações da coluna" })[1]);
    await user.click(await screen.findByRole("menuitem", { name: /Excluir/ }));
    expect(etapaControls.onExcluir).toHaveBeenCalledWith(ETAPAS[1]);

    await user.click(screen.getAllByRole("button", { name: "Ações da coluna" })[2]);
    await user.click(await screen.findByRole("menuitem", { name: /Editar/ }));
    expect(etapaControls.onEditar).toHaveBeenCalledWith(ETAPAS[2]);
  });
});
