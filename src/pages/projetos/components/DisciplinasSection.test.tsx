import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { DisciplinaResponsavel } from "@/types/projetos";
import type { FluxoDisciplinas } from "@/types/fluxoDisciplinas";

vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({
    value,
    onChange,
    minDate,
    maxDate,
    className,
  }: {
    value?: string;
    onChange: (v: string) => void;
    minDate?: string;
    maxDate?: string;
    className?: string;
  }) => (
    <input
      data-testid="dp"
      data-min={minDate ?? ""}
      data-max={maxDate ?? ""}
      className={className}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
vi.mock("./FluxoPipelineGraph", () => ({
  FluxoPipelineGraph: ({
    stages,
  }: {
    stages: {
      key: string;
      nodes: { titulo: string; responsavelNome?: string; metaLabel?: string; checklistLabel?: string }[];
    }[];
  }) => (
    <div data-testid="grafo">
      {stages.map((s) => (
        <p key={s.key}>
          {s.key}:
          {s.nodes
            .map((n) => `${n.titulo}/${n.responsavelNome ?? "-"}/${n.metaLabel ?? "-"}/${n.checklistLabel ?? "-"}`)
            .join(";")}
        </p>
      ))}
    </div>
  ),
}));

import { DisciplinasSection } from "./DisciplinasSection";

// Tela pesada (Radix + muitos campos): sob cobertura passa dos 5s padrão.
vi.setConfig({ testTimeout: 20000 });

type Props = ComponentProps<typeof DisciplinasSection>;

const fluxo: FluxoDisciplinas = {
  id: "f1",
  empresa_id: "e",
  nome: "Residencial",
  descricao: null,
  ativo: true,
  created_at: "",
  disciplinas: [
    { ordem: 1, nome: "A" },
    { ordem: 2, nome: "B" },
  ],
};
const fluxoUno: FluxoDisciplinas = { ...fluxo, id: "f2", nome: "Curto", disciplinas: [{ ordem: 1, nome: "A" }] };

const VAZIO_RESP = { responsavel_id: "", data_inicio: "", data_previsao: "", data_final: "" };

function props(p: Partial<Props> = {}): Props {
  return {
    disciplinas: [{ id: "d1", nome: "Estrutural" }],
    pessoas: [
      { id: "p1", nome: "Ana" },
      { id: "p2", nome: "Bruno" },
    ],
    projetosDisciplinas: [],
    tempDisciplina: {},
    onTempDisciplinaChange: vi.fn(),
    onAddDisciplina: vi.fn(),
    onRemoveDisciplina: vi.fn(),
    onOpenDetail: vi.fn(),
    addingRespToFormDisc: null,
    onSetAddingResp: vi.fn(),
    newFormResp: VAZIO_RESP,
    onNewFormRespChange: vi.fn(),
    onAddResponsavel: vi.fn(),
    onRemoveResponsavel: vi.fn(),
    onUpdateRespDatas: vi.fn(),
    ...p,
  };
}

function escolher(gatilho: HTMLElement, opcao: string | RegExp) {
  fireEvent.keyDown(gatilho, { key: "Enter" });
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }));
}

const isoEmDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const disc = (p: Partial<DisciplinaResponsavel>): DisciplinaResponsavel => ({
  disciplina: "Estrutural",
  responsavel_id: "p1",
  responsavel_nome: "Ana",
  ...p,
});

describe("DisciplinasSection: fluxo", () => {
  it("escolhe o fluxo, mostra o indicador do aplicado e limpa", () => {
    const p = props({ fluxosData: [fluxo, fluxoUno], onApplyFluxo: vi.fn() });
    const { rerender } = render(<DisciplinasSection {...p} />);
    expect(screen.getByText("Aplicar fluxo de disciplinas")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(screen.getByRole("option", { name: "Curto (1 coluna)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Residencial (2 colunas)" }));
    expect(p.onApplyFluxo).toHaveBeenCalledWith("f1");

    rerender(
      <DisciplinasSection
        {...p}
        projetosDisciplinas={[
          disc({ etapa: 1, data_previsao: "2026-05-01", checklist_padrao: [{ texto: "x" }] }),
          disc({
            etapa: 1,
            disciplina: "Elétrica",
            responsavel_nome: "",
            responsavel_id: "",
            data_inicio: "2026-04-01",
          }),
          disc({ disciplina: "Paisagismo" }),
        ]}
      />
    );
    // Com disciplinas, o seletor some e aparece o indicador.
    expect(screen.queryByText("Aplicar fluxo de disciplinas")).not.toBeInTheDocument();
    expect(screen.getByText("Fluxo aplicado: Residencial")).toBeInTheDocument();
    expect(screen.getByText("paralelo")).toBeInTheDocument();
    expect(screen.getByText("Avulsas")).toBeInTheDocument();
    expect(screen.getByTestId("grafo")).toHaveTextContent("1:Estrutural/Ana/01/05/1 itens;Elétrica/-/-/-");
    // Etapa sem previsão: aviso de "sem prazo".
    expect(screen.getByText("sem prazo definido")).toBeInTheDocument();

    const indicador = screen.getByText("Fluxo aplicado: Residencial").parentElement!;
    fireEvent.click(within(indicador).getByRole("button"));
    expect(p.onApplyFluxo).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("Fluxo de etapas aplicado")).toBeInTheDocument();
  });

  it("sem onApplyFluxo não mostra o seletor", () => {
    render(<DisciplinasSection {...props({ fluxosData: [fluxo] })} />);
    expect(screen.queryByText("Aplicar fluxo de disciplinas")).not.toBeInTheDocument();
  });
});

describe("DisciplinasSection: cartões das disciplinas", () => {
  it("prioridade, prazo (atraso e atenção), status e ações de editar/remover", () => {
    const p = props({
      projetosDisciplinas: [
        disc({ prioridade: "Alta", data_previsao: "2020-01-01", status: "Em Andamento" }),
        disc({
          disciplina: "Elétrica",
          prioridade: "Urgente" as never,
          data_previsao: isoEmDias(3),
          status: "Concluído",
        }),
        disc({ disciplina: "Hidráulica", data_previsao: isoEmDias(0) }),
      ],
    });
    render(<DisciplinasSection {...p} />);
    expect(screen.getByText("Alta")).toBeInTheDocument();
    expect(screen.getByText("Urgente")).toBeInTheDocument();
    expect(screen.getByText(/Em Atraso \(\d+d\)/)).toBeInTheDocument();
    expect(screen.getByText("Em Andamento")).toHaveClass("text-info-mid");
    expect(screen.getByText("Concluído")).toHaveClass("text-positive-strong");
    expect(screen.getByText("Não Iniciado")).toHaveClass("text-ink-muted");
    // Atenção no dia (0 dias) não mostra contagem.
    expect(screen.getByText(/^Atenção\s*$/)).toBeInTheDocument();

    const cartao = screen.getByText("Elétrica").closest(".bg-white") as HTMLElement;
    const [editar, remover] = within(cartao).getAllByRole("button");
    fireEvent.click(editar);
    fireEvent.click(remover);
    expect(p.onOpenDetail).toHaveBeenCalledWith(1);
    expect(p.onRemoveDisciplina).toHaveBeenCalledWith(1);
  });

  it("vários responsáveis: nomes, remover responsável e datas por responsável", () => {
    const p = props({
      disciplinas: [
        { id: "d1", nome: "Estrutural" },
        { id: "d2", nome: "Arquitetura" },
      ],
      projetoDataInicio: "2026-03-01",
      projetoDataPrevisao: "2026-06-30",
      projetoDataFinal: "2026-07-31",
      projetosDisciplinas: [
        disc({
          responsaveis: [
            {
              responsavel_id: "p1",
              responsavel_nome: "Ana",
              data_inicio: "2026-02-01",
              data_previsao: "2026-07-15",
              data_final: "2026-02-15",
            },
            { responsavel_id: "p2", responsavel_nome: "Bruno", data_final: "2026-09-01" },
          ],
        }),
      ],
    });
    render(<DisciplinasSection {...p} />);
    expect(screen.getByText("Ana, Bruno")).toBeInTheDocument();
    expect(screen.getAllByText("Fora do prazo do projeto")).toHaveLength(2);
    expect(screen.getByText("Anterior ao início do projeto")).toBeInTheDocument();
    expect(screen.getByText("Posterior à conclusão do projeto")).toBeInTheDocument();

    const bruno = screen
      .getAllByText("Bruno")
      .find((el) => el.tagName === "SPAN" && el.className.includes("font-medium"))!;
    fireEvent.click(within(bruno.closest(".justify-between") as HTMLElement).getByRole("button"));
    expect(p.onRemoveResponsavel).toHaveBeenCalledWith(0, 1);

    const [inicio, previsao, conclusao] = screen.getAllByTestId("dp");
    expect(inicio).toHaveAttribute("data-max", "2026-07-15");
    fireEvent.change(inicio, { target: { value: "2026-03-02" } });
    fireEvent.change(previsao, { target: { value: "2026-04-02" } });
    fireEvent.change(conclusao, { target: { value: "2026-05-02" } });
    expect(p.onUpdateRespDatas).toHaveBeenCalledWith(0, 0, "data_inicio", "2026-03-02");
    expect(p.onUpdateRespDatas).toHaveBeenCalledWith(0, 0, "data_previsao", "2026-04-02");
    expect(p.onUpdateRespDatas).toHaveBeenCalledWith(0, 0, "data_final", "2026-05-02");
  });

  it("botão Adicionar responsável liga o modo de adição", () => {
    const p = props({ projetosDisciplinas: [disc({})] });
    render(<DisciplinasSection {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar responsável/ }));
    expect(p.onSetAddingResp).toHaveBeenCalledWith(0);
  });

  it("formulário de novo responsável: pessoa, datas, adicionar e cancelar", () => {
    const p = props({
      projetosDisciplinas: [disc({})],
      addingRespToFormDisc: 0,
      newFormResp: { responsavel_id: "", data_inicio: "", data_previsao: "2026-05-01", data_final: "2026-06-01" },
    });
    render(<DisciplinasSection {...p} />);
    escolher(screen.getByRole("combobox"), "Bruno");
    expect(p.onNewFormRespChange).toHaveBeenLastCalledWith(expect.objectContaining({ responsavel_id: "p2" }));

    const dps = screen.getAllByTestId("dp");
    const [ini, prev, fim] = dps.slice(-3);
    expect(ini).toHaveAttribute("data-max", "2026-05-01");
    fireEvent.change(ini, { target: { value: "2026-04-01" } });
    expect(p.onNewFormRespChange).toHaveBeenLastCalledWith(expect.objectContaining({ data_inicio: "2026-04-01" }));
    fireEvent.change(prev, { target: { value: "2026-05-10" } });
    expect(p.onNewFormRespChange).toHaveBeenLastCalledWith(expect.objectContaining({ data_previsao: "2026-05-10" }));
    fireEvent.change(fim, { target: { value: "2026-06-10" } });
    expect(p.onNewFormRespChange).toHaveBeenLastCalledWith(expect.objectContaining({ data_final: "2026-06-10" }));

    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(p.onAddResponsavel).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(p.onSetAddingResp).toHaveBeenCalledWith(null);
    expect(p.onNewFormRespChange).toHaveBeenLastCalledWith(VAZIO_RESP);
  });
});

describe("DisciplinasSection: incluir disciplina", () => {
  it("abre o formulário, escolhe tudo, mostra o prazo e inclui", () => {
    const p = props({
      disciplinas: [
        { id: "d1", nome: "Estrutural" },
        { id: "d2", nome: "Arquitetura" },
      ],
      projetoDataInicio: "2026-03-01",
      projetoDataPrevisao: "2026-06-30",
      tempDisciplina: {
        disciplina: "Estrutural",
        data_inicio: "2026-01-01",
        data_previsao: "2026-08-01",
        data_final: "2026-02-01",
      },
    });
    render(<DisciplinasSection {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar nova disciplina/ }));
    expect(screen.getByText(/Prazo do projeto: 01\/03 → 30\/06/)).toBeInTheDocument();
    expect(screen.getAllByText("Fora do prazo do projeto")).toHaveLength(2);
    expect(screen.getByText("Anterior ao início do projeto")).toBeInTheDocument();

    const [disciplina, responsavel, prioridade] = screen.getAllByRole("combobox");
    escolher(disciplina, "Arquitetura");
    expect(p.onTempDisciplinaChange).toHaveBeenLastCalledWith(expect.objectContaining({ disciplina: "Arquitetura" }));
    escolher(responsavel, "Ana");
    expect(p.onTempDisciplinaChange).toHaveBeenLastCalledWith(expect.objectContaining({ responsavel_id: "p1" }));
    escolher(prioridade, "Baixa");
    expect(p.onTempDisciplinaChange).toHaveBeenLastCalledWith(expect.objectContaining({ prioridade: "Baixa" }));

    const [ini, prev, fim] = screen.getAllByTestId("dp");
    expect(ini).toHaveAttribute("data-max", "2026-08-01");
    fireEvent.change(ini, { target: { value: "2026-03-05" } });
    expect(p.onTempDisciplinaChange).toHaveBeenLastCalledWith(expect.objectContaining({ data_inicio: "2026-03-05" }));
    fireEvent.change(prev, { target: { value: "2026-04-05" } });
    expect(p.onTempDisciplinaChange).toHaveBeenLastCalledWith(expect.objectContaining({ data_previsao: "2026-04-05" }));
    fireEvent.change(fim, { target: { value: "2026-05-05" } });
    expect(p.onTempDisciplinaChange).toHaveBeenLastCalledWith(expect.objectContaining({ data_final: "2026-05-05" }));

    fireEvent.click(screen.getByRole("button", { name: /Incluir na lista/ }));
    expect(p.onAddDisciplina).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Incluir na lista/ })).not.toBeInTheDocument();
  });

  it("sem catálogo nem pessoas: orienta, trava o responsável e não deixa incluir; Cancelar fecha", () => {
    render(<DisciplinasSection {...props({ disciplinas: [], pessoas: [] })} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar nova disciplina/ }));
    expect(screen.getByText(/Nenhuma disciplina cadastrada/)).toBeInTheDocument();
    expect(screen.getByText("Nenhuma pessoa cadastrada")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[1]).toBeDisabled();
    expect(screen.getByRole("button", { name: /Incluir na lista/ })).toBeDisabled();
    expect(screen.queryByText(/Prazo do projeto/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: /Adicionar nova disciplina/ })).toBeInTheDocument();
  });
});
