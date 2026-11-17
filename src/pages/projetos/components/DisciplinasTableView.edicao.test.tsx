import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { DisciplinaResponsavel, ProjetoDisciplinaDB } from "@/types/projetos";

vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({
    value,
    onChange,
    minDate,
    maxDate,
  }: {
    value?: string;
    onChange: (v: string) => void;
    minDate?: string;
    maxDate?: string;
  }) => (
    <input
      data-testid="dp"
      data-min={minDate ?? ""}
      data-max={maxDate ?? ""}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import userEvent from "@testing-library/user-event";
import { clicarAcao } from "@/test/acoesLinha";
import { DisciplinasTableView } from "./DisciplinasTableView";

// Tela pesada (Radix + muitos campos): sob cobertura passa dos 5s padrão.
vi.setConfig({ testTimeout: 20000 });

// Edição inline da tabela de disciplinas: nome, prioridade, datas, status com
// confirmação de conclusão e justificativa de atraso, responsáveis, observações
// e exclusão; e a leitura (sem permissão de edição).

type Props = ComponentProps<typeof DisciplinasTableView>;

const legacy = [
  {
    disciplina: "Estrutural",
    status: "Em Andamento",
    prioridade: "Alta",
    data_inicio: "2026-03-01",
    data_previsao: "2099-05-01",
  },
  { disciplina: "Elétrica", status: "Em Andamento", data_previsao: "2020-01-10" },
  { disciplina: "Hidráulica", status: "Concluído", data_final: "2026-02-01" },
  { disciplina: "Sem banco", status: "Não Iniciado" },
] as unknown as DisciplinaResponsavel[];

const db = [
  {
    id: "d1",
    projeto_id: "p1",
    nome: "Estrutural",
    status: "Em Andamento",
    data_fim_real: null,
    observacoes: "[01/01] primeira\n[02/01] segunda",
    responsaveis: [
      { id: "pe1", nome: "Ana" },
      { id: "pe2", nome: "Bruno" },
    ],
  },
  {
    id: "d2",
    projeto_id: "p1",
    nome: "Elétrica",
    status: "Em Andamento",
    data_fim_real: "2026-01-20",
    observacoes: null,
    responsaveis: [{ id: "pe1", nome: "Ana" }],
  },
  { id: "d3", projeto_id: "p1", nome: "Hidráulica", status: "Concluído", data_fim_real: null, observacoes: null },
] as unknown as ProjetoDisciplinaDB[];

const pessoas = [
  { id: "pe1", nome: "Ana" },
  { id: "pe2", nome: "Bruno" },
  { id: "pe3", nome: "Carla" },
];

let p: Props;
beforeEach(() => {
  p = {
    canEdit: true,
    disciplinasLegacy: legacy,
    dbDisciplinas: db,
    disciplinasCatalog: [{ id: "c1", nome: "Elétrica" }],
    pessoas,
    checklistCounts: { d1: { total: 2, concluidos: 1 } } as never,
    applyDiscStatusChange: vi.fn().mockResolvedValue(undefined),
    handleRemoveDisc: vi.fn().mockResolvedValue(undefined),
    handleAddDisc: vi.fn().mockResolvedValue(undefined),
    handleSaveDiscChanges: vi.fn().mockResolvedValue(undefined),
    handleAddResponsavel: vi.fn().mockResolvedValue(undefined),
    handleRemoveResponsavel: vi.fn().mockResolvedValue(undefined),
    onAplicarFluxo: vi.fn(),
    projetoDataInicio: "2026-02-15T00:00:00",
  };
});

const linha = (nome: string) =>
  screen.getAllByRole("row").find((r) => within(r).queryAllByText(nome).length > 0) as HTMLElement;
function escolher(gatilho: HTMLElement, opcao: string | RegExp) {
  fireEvent.keyDown(gatilho, { key: "Enter" });
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }));
}
async function escolherEEsperar(gatilho: HTMLElement, opcao: string | RegExp) {
  fireEvent.keyDown(gatilho, { key: "Enter" });
  const item = within(screen.getByRole("listbox")).getByRole("option", { name: opcao });
  await act(async () => fireEvent.click(item));
}

describe("DisciplinasTableView: lista vazia", () => {
  it("com edição e fluxo: orienta aplicar fluxo e adiciona pela linha nova", async () => {
    render(<DisciplinasTableView {...p} disciplinasLegacy={[]} dbDisciplinas={[]} />);
    expect(screen.getByText("0 disciplinas")).toBeInTheDocument();
    expect(screen.getByText(/Aplique um fluxo da empresa/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Aplicar fluxo/ }));
    expect(p.onAplicarFluxo).toHaveBeenCalled();

    const [, doVazio] = screen.getAllByRole("button", { name: /Adicionar disciplina/ });
    fireEvent.click(doVazio);
    const [disc, resp] = screen.getAllByRole("combobox");
    escolher(disc, "Elétrica");
    escolher(resp, "Carla");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Adicionar disciplina" })));
    expect(p.handleAddDisc).toHaveBeenCalledWith({ disciplina: "Elétrica", responsavel_id: "pe3" });
    // Linha nova fecha e o botão do cabeçalho volta.
    expect(screen.getAllByRole("button", { name: /Adicionar disciplina/ })).toHaveLength(2);
  });

  it("cancelar a linha nova volta ao estado vazio", () => {
    render(<DisciplinasTableView {...p} disciplinasLegacy={[]} dbDisciplinas={[]} onAplicarFluxo={undefined} />);
    expect(screen.getByText(/Adicione as disciplinas deste projeto/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Adicionar disciplina/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Nenhuma disciplina definida")).toBeInTheDocument();
  });

  it("sem edição não oferece ação", () => {
    render(<DisciplinasTableView {...p} canEdit={false} disciplinasLegacy={[]} dbDisciplinas={[]} />);
    expect(screen.getByText(/Adicione as disciplinas deste projeto/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("DisciplinasTableView: edição inline", () => {
  it("troca nome e prioridade; disciplina fora do catálogo continua escolhível", async () => {
    render(<DisciplinasTableView {...p} />);
    expect(screen.getByText("4 disciplinas")).toBeInTheDocument();
    const est = linha("Estrutural");
    fireEvent.keyDown(within(est).getByRole("combobox", { name: "Disciplina" }), { key: "Enter" });
    expect(within(screen.getByRole("listbox")).getByRole("option", { name: "Estrutural" })).toBeInTheDocument();
    await act(async () =>
      fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Elétrica" }))
    );
    expect(p.handleSaveDiscChanges).toHaveBeenCalledWith(expect.objectContaining({ id: "d1", nome: "Elétrica" }));

    await escolherEEsperar(within(est).getByRole("combobox", { name: "Prioridade" }), "Baixa");
    expect(p.handleSaveDiscChanges).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "d1", prioridade: "Baixa" })
    );
  });

  it("linha sem registro no banco não grava edição rápida", async () => {
    render(<DisciplinasTableView {...p} />);
    await escolherEEsperar(within(linha("Sem banco")).getByRole("combobox", { name: "Prioridade" }), "Alta");
    expect(p.handleSaveDiscChanges).not.toHaveBeenCalled();
  });

  it("datas: início, previsão e final viram data_inicio, data_fim e data_fim_real (vazio vira null)", async () => {
    render(<DisciplinasTableView {...p} />);
    const [ini, prev, fim] = within(linha("Estrutural")).getAllByTestId("dp");
    expect(ini).toHaveAttribute("data-min", "2026-02-15");
    expect(ini).toHaveAttribute("data-max", "2099-05-01");
    expect(prev).toHaveAttribute("data-min", "2026-03-01");
    await act(async () => fireEvent.change(ini, { target: { value: "2026-03-05" } }));
    expect(p.handleSaveDiscChanges).toHaveBeenLastCalledWith(expect.objectContaining({ data_inicio: "2026-03-05" }));
    await act(async () => fireEvent.change(ini, { target: { value: "" } }));
    expect(p.handleSaveDiscChanges).toHaveBeenLastCalledWith(expect.objectContaining({ data_inicio: null }));
    await act(async () => fireEvent.change(prev, { target: { value: "2026-06-01" } }));
    expect(p.handleSaveDiscChanges).toHaveBeenLastCalledWith(expect.objectContaining({ data_fim: "2026-06-01" }));
    await act(async () => fireEvent.change(prev, { target: { value: "" } }));
    expect(p.handleSaveDiscChanges).toHaveBeenLastCalledWith(expect.objectContaining({ data_fim: null }));
    await act(async () => fireEvent.change(fim, { target: { value: "2026-07-01" } }));
    expect(p.handleSaveDiscChanges).toHaveBeenLastCalledWith(expect.objectContaining({ data_fim_real: "2026-07-01" }));
    const fimHidraulica = within(linha("Hidráulica")).getAllByTestId("dp")[2];
    await act(async () => fireEvent.change(fimHidraulica, { target: { value: "" } }));
    expect(p.handleSaveDiscChanges).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "d3", data_fim_real: null })
    );
  });

  it("status comum aplica direto; em atraso sem justificativa pede uma", async () => {
    render(<DisciplinasTableView {...p} />);
    await escolherEEsperar(within(linha("Estrutural")).getByRole("combobox", { name: "Status" }), "Pendente");
    expect(p.applyDiscStatusChange).toHaveBeenCalledWith(0, "Pendente");

    // Elétrica está atrasada (marcada na linha) e não tem justificativa.
    const eletrica = linha("Elétrica");
    expect(within(eletrica).getByText("Atrasada")).toBeInTheDocument();
    await escolherEEsperar(within(eletrica).getByRole("combobox", { name: "Status" }), "Pendente");
    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText("Justificativa de atraso obrigatória")).toBeInTheDocument();
    const confirmar = within(dialogo).getByRole("button", { name: "Confirmar" });
    expect(confirmar).toBeDisabled();
    fireEvent.change(within(dialogo).getByPlaceholderText("Explique o motivo do atraso..."), {
      target: { value: "  Cliente atrasou o levantamento " },
    });
    await act(async () => fireEvent.click(confirmar));
    expect(p.applyDiscStatusChange).toHaveBeenLastCalledWith(1, "Pendente", "Cliente atrasou o levantamento");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("justificativa cancelada não aplica", async () => {
    render(<DisciplinasTableView {...p} />);
    await escolherEEsperar(within(linha("Elétrica")).getByRole("combobox", { name: "Status" }), "Não Iniciado");
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(p.applyDiscStatusChange).not.toHaveBeenCalled();
  });

  it("concluir pede a data real (já gravada ou hoje) e aplica com ela", async () => {
    render(<DisciplinasTableView {...p} />);
    await escolherEEsperar(within(linha("Elétrica")).getByRole("combobox", { name: "Status" }), "Concluído");
    let dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText("Elétrica")).toBeInTheDocument();
    const data = within(dialogo).getByTestId("dp");
    expect(data).toHaveValue("2026-01-20");
    fireEvent.change(data, { target: { value: "" } });
    expect(within(dialogo).getByRole("button", { name: "Confirmar" })).toBeDisabled();
    fireEvent.change(data, { target: { value: "2026-01-25" } });
    await act(async () => fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" })));
    expect(p.applyDiscStatusChange).toHaveBeenCalledWith(1, "Concluído", undefined, "2026-01-25");

    // Sem data gravada, sugere hoje; cancelar fecha sem aplicar.
    await escolherEEsperar(within(linha("Sem banco")).getByRole("combobox", { name: "Status" }), "Concluído");
    dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByTestId("dp")).toHaveValue(new Date().toISOString().split("T")[0]);
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(p.applyDiscStatusChange).toHaveBeenCalledTimes(1);
  });

  it("excluir pede confirmação; cancelar não remove", async () => {
    render(<DisciplinasTableView {...p} />);
    const user = userEvent.setup();
    await clicarAcao(user, linha("Hidráulica") as unknown as HTMLElement, "Excluir");
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(p.handleRemoveDisc).not.toHaveBeenCalled();

    await clicarAcao(user, linha("Hidráulica") as unknown as HTMLElement, "Excluir");
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    expect(p.handleRemoveDisc).toHaveBeenCalledWith(2);
  });
});

describe("DisciplinasTableView: observações e responsáveis", () => {
  it("observações: conta as existentes, adiciona por Enter e pelo botão", async () => {
    render(<DisciplinasTableView {...p} />);
    fireEvent.click(within(linha("Estrutural")).getByRole("button", { name: "Observações (2)" }));
    expect(screen.getByText(/primeira/)).toBeInTheDocument();
    const campo = screen.getByPlaceholderText("Nova observação...");
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(p.handleSaveDiscChanges).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: " Revisar armação " } });
    await act(async () => fireEvent.keyDown(campo, { key: "Enter" }));
    const obs = (p.handleSaveDiscChanges as ReturnType<typeof vi.fn>).mock.calls[0][0].observacoes as string;
    expect(obs.startsWith("[01/01] primeira\n[02/01] segunda\n[")).toBe(true);
    expect(obs.endsWith("] Revisar armação")).toBe(true);
    expect(campo).toHaveValue("");
  });

  it("observação na disciplina sem nenhuma, pelo botão", async () => {
    render(<DisciplinasTableView {...p} />);
    fireEvent.click(within(linha("Hidráulica")).getByRole("button", { name: "Observações" }));
    expect(screen.getByText("Nenhuma observação")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Nova observação..."), { target: { value: "Entregue" } });
    const dialog = screen.getByPlaceholderText("Nova observação...").parentElement!;
    await act(async () => fireEvent.click(within(dialog).getByRole("button")));
    expect(p.handleSaveDiscChanges).toHaveBeenCalledWith(
      expect.objectContaining({ id: "d3", observacoes: expect.stringMatching(/^\[.+\] Entregue$/) })
    );
  });

  it("responsáveis: mostra resumo, remove (com mais de um) e adiciona quem falta", async () => {
    render(<DisciplinasTableView {...p} />);
    expect(within(linha("Elétrica")).getByText("Ana")).toBeInTheDocument();
    expect(within(linha("Hidráulica")).getByText("Sem responsável")).toBeInTheDocument();
    fireEvent.click(within(linha("Estrutural")).getByRole("button", { name: /Ana \+1/ }));
    expect(screen.getByText("Responsáveis de Estrutural")).toBeInTheDocument();
    const remover = screen.getAllByRole("button", { name: "Remover responsável" });
    expect(remover).toHaveLength(2);
    await act(async () => fireEvent.click(remover[1]));
    expect(p.handleRemoveResponsavel).toHaveBeenCalledWith(0, 1);

    const adicionar = screen.getByRole("button", { name: "Adicionar responsável" });
    expect(adicionar).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "" }), { key: "Enter" });
    const lista = screen.getByRole("listbox");
    expect(within(lista).queryByRole("option", { name: "Ana" })).not.toBeInTheDocument();
    fireEvent.click(within(lista).getByRole("option", { name: "Carla" }));
    await act(async () => fireEvent.click(adicionar));
    expect(p.handleAddResponsavel).toHaveBeenCalledWith(0, "pe3");
  });

  it("disciplina sem responsável mostra o vazio no popover", () => {
    render(<DisciplinasTableView {...p} />);
    fireEvent.click(within(linha("Hidráulica")).getByRole("button", { name: /Sem responsável/ }));
    expect(screen.getByText("Nenhum responsável")).toBeInTheDocument();
  });
});

describe("DisciplinasTableView: somente leitura", () => {
  it("mostra prioridade, datas formatadas e responsáveis como texto", () => {
    render(<DisciplinasTableView {...p} canEdit={false} />);
    const est = linha("Estrutural");
    expect(within(est).getByText("Alta")).toBeInTheDocument();
    expect(within(est).getByText("01/03")).toBeInTheDocument();
    expect(within(est).getByText("Ana +1")).toBeInTheDocument();
    expect(within(linha("Elétrica")).getAllByText("—").length).toBeGreaterThan(0);
    expect(within(linha("Hidráulica")).getByText("01/02")).toHaveClass("text-positive-strong");
    expect(screen.queryByRole("button", { name: /^Mais ações/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aplicar fluxo/ })).not.toBeInTheDocument();
  });
});
