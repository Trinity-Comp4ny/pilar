import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ItemTrabalho } from "../useItensTrabalho";
import type { Etapa } from "../useEtapas";
import type { ColunasLista, ColunaLista } from "../colunas";
import type { EtapaControls } from "./QuadroTrabalho";
import { ListaTrabalho, SeletorColunas } from "./ListaTrabalho";

/**
 * Lista de Tarefas: grupos recolhíveis (Concluído recolhido na obra), colunas
 * escolhidas, células só leitura para disciplina, teclado na linha e o
 * "Nova lista" inline.
 */

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const ETAPAS: Etapa[] = [
  { id: "e-fazer", nome: "A fazer", ordem: 0, cor: null, bucket: "a_fazer" },
  { id: "e-ok", nome: "Concluído", ordem: 1, cor: null, bucket: "concluida" },
];

const item = (p: Partial<ItemTrabalho>): ItemTrabalho => ({
  key: `tarefa:${p.id}`,
  tipo: "tarefa",
  id: "x",
  numero: null,
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
  ...p,
});

const ITENS = [
  item({
    id: "t1",
    numero: 5,
    titulo: "Revisar",
    obraCaminho: "Obra · Serviço",
    comentarios: 1,
    links: 2,
    horasEstimadas: 1.5,
  }),
  item({ id: "d1", key: "disciplina:d1", tipo: "disciplina", titulo: "Estrutural", status: "concluida" }),
];

const colunas = (ativas: ColunaLista[]): ColunasLista => ({
  visiveis: Object.fromEntries(ativas.map((c) => [c, true])) as ColunasLista["visiveis"],
  ativas,
  alternar: vi.fn(),
});

function renderLista(props: Partial<Parameters<typeof ListaTrabalho>[0]> = {}) {
  const fns = {
    onAbrir: vi.fn(),
    onPrioridade: vi.fn(),
    onResponsaveis: vi.fn(),
    onPrazo: vi.fn(),
    onProjeto: vi.fn(),
    onEtiquetas: vi.fn(),
    onHoras: vi.fn(),
    onHorasReais: vi.fn(),
    onExcluir: vi.fn(),
    onMover: vi.fn(),
    onCriarNoGrupo: vi.fn(),
  };
  const etapaControls: EtapaControls = {
    etapas: ETAPAS,
    onCriar: vi.fn().mockResolvedValue(true),
    criando: false,
    onEditar: vi.fn(),
    onExcluir: vi.fn(),
    onReordenar: vi.fn(),
  };
  render(
    <ListaTrabalho
      itens={ITENS}
      etapas={ETAPAS}
      pessoas={[]}
      projetos={[]}
      colunas={colunas(["prioridade", "horas", "horasreais", "etiquetas"])}
      podeEditarResponsavel={false}
      etapaControls={etapaControls}
      {...fns}
      {...props}
    />
  );
  return { ...fns, etapaControls, user: userEvent.setup() };
}

describe("ListaTrabalho", () => {
  it("linha mostra número, caminho da obra, contadores e cabeçalho das colunas ativas", () => {
    renderLista();
    const linha = screen.getByRole("group", { name: "Revisar" });
    expect(linha).not.toHaveTextContent("#5");
    expect(linha).toHaveTextContent("Obra · Serviço");
    expect(screen.getAllByText("Horas est.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Horas reais").length).toBeGreaterThan(0);
  });

  it("disciplina tem células só leitura e nenhuma ação", () => {
    renderLista();
    const linha = screen.getByRole("group", { name: "Estrutural" });
    expect(within(linha).queryByTitle("Mudar prioridade")).not.toBeInTheDocument();
    expect(within(linha).queryByRole("button", { name: "Ações da tarefa" })).not.toBeInTheDocument();
    expect(within(linha).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("Enter na linha abre o item; clique também", async () => {
    const { user, onAbrir } = renderLista();
    fireEvent.keyDown(screen.getByRole("group", { name: "Revisar" }), { key: "Enter" });
    expect(onAbrir).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText("Estrutural"));
    expect(onAbrir).toHaveBeenLastCalledWith(expect.objectContaining({ id: "d1" }));
  });

  it("recolher e reabrir um grupo", async () => {
    const { user } = renderLista();
    await user.click(screen.getByRole("button", { name: /^A fazer\s*1$/ }));
    expect(screen.queryByRole("group", { name: "Revisar" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^A fazer\s*1$/ }));
    expect(screen.getByRole("group", { name: "Revisar" })).toBeInTheDocument();
  });

  it("na obra o Concluído começa recolhido", () => {
    renderLista({ recolherConcluidas: true });
    expect(screen.queryByRole("group", { name: "Estrutural" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Revisar" })).toBeInTheDocument();
  });

  it("grupo vazio oferece nova tarefa naquela coluna", async () => {
    const { user, onCriarNoGrupo } = renderLista({ itens: [] });
    await user.click(screen.getAllByRole("button", { name: "Nova tarefa" })[1]);
    expect(onCriarNoGrupo).toHaveBeenCalledWith("e-ok");
  });

  it("nova lista: exige nome, escolhe cor, Escape cancela", async () => {
    const { user, etapaControls } = renderLista();
    await user.click(screen.getByRole("button", { name: /Nova lista/ }));
    expect(screen.getByRole("button", { name: "Adicionar" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.queryByPlaceholderText(/Nome da lista/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Nova lista/ }));
    await user.type(screen.getByPlaceholderText(/Nome da lista/), "Bloqueado");
    await user.click(screen.getByRole("button", { name: "Cor #ef4444" }));
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(etapaControls.onCriar).toHaveBeenCalledWith("Bloqueado", "#ef4444");
    expect(await screen.findByRole("button", { name: /Nova lista/ })).toBeInTheDocument();
  });

  it("criação recusada mantém o campo aberto", async () => {
    const { user, etapaControls } = renderLista();
    vi.mocked(etapaControls.onCriar).mockResolvedValue(false);
    await user.click(screen.getByRole("button", { name: /Nova lista/ }));
    await user.type(screen.getByPlaceholderText(/Nome da lista/), "X{Enter}");
    expect(etapaControls.onCriar).toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/Nome da lista/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByPlaceholderText(/Nome da lista/)).not.toBeInTheDocument();
  });
});

describe("SeletorColunas", () => {
  it("lista as colunas marcadas e alterna sem fechar o menu", async () => {
    const c = colunas(["projeto", "prazo"]);
    render(<SeletorColunas colunas={c} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Colunas/ }));
    expect(await screen.findByRole("menuitemcheckbox", { name: "Projeto" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: "Horas est." })).toHaveAttribute("aria-checked", "false");
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Etiquetas" }));
    expect(c.alternar).toHaveBeenCalledWith("etiquetas");
    expect(screen.getByRole("menuitemcheckbox", { name: "Projeto" })).toBeInTheDocument();
  });
});
