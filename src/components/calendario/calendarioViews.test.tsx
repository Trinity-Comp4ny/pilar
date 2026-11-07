import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgendaView } from "./AgendaView";
import { CalendarioSidebar } from "./CalendarioSidebar";
import { CalendarioLegenda, EventoDetalhe } from "./EventoItem";
import { MesView } from "./MesView";
import { MiniMes } from "./MiniMes";
import { SemanaView } from "./SemanaView";
import { fmtKey, groupByDia, todayKey, type PrazoEvento } from "./eventos";

// Novembro/2026 começa num domingo: a grade de segunda-feira tem 6 vazios antes do dia 1.
const NOV = new Date(2026, 10, 15);

function evento(over: Partial<PrazoEvento>): PrazoEvento {
  return {
    id: "e",
    data: "2026-11-10",
    camada: "tarefa",
    estado: "futuro",
    titulo: "Evento",
    status: "",
    ...over,
  };
}

const EVENTOS: PrazoEvento[] = [
  evento({ id: "1", titulo: "Entrega estrutural", camada: "disciplina", estado: "atrasado", subtitulo: "Residencial" }),
  evento({ id: "2", titulo: "Revisão", estado: "proximo", responsavel: "Ana Seed" }),
  evento({ id: "3", titulo: "Pausada", estado: "pausado" }),
  evento({ id: "4", titulo: "Feita", estado: "concluido", camada: "projeto" }),
  evento({ id: "5", titulo: "Outra", data: "2026-11-20" }),
  evento({ id: "6", titulo: "Fora do mês", data: "2026-12-01" }),
];

describe("MiniMes", () => {
  it("navega entre meses, marca dias com evento e seleciona", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<MiniMes selecionado={NOV} diasComEvento={new Set(["2026-11-10", "2026-11-15"])} onSelectDate={onSelect} />);
    expect(screen.getByText("Novembro 2026")).toBeInTheDocument();
    const dia10 = screen.getByRole("button", { name: /^10 de novembro/ });
    expect(dia10.querySelector("[aria-hidden]")).not.toBeNull();
    // o selecionado não mostra o ponto
    expect(screen.getByRole("button", { name: /^15 de novembro/ }).querySelector("[aria-hidden]")).toBeNull();
    await user.click(dia10);
    expect(fmtKey(onSelect.mock.calls[0][0])).toBe("2026-11-10");

    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByText("Dezembro 2026")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(screen.getByText("Outubro 2026")).toBeInTheDocument();
  });

  it("marca hoje", () => {
    render(<MiniMes selecionado={new Date(2000, 0, 1)} diasComEvento={new Set()} onSelectDate={vi.fn()} />);
    render(<MiniMes selecionado={new Date()} diasComEvento={new Set()} onSelectDate={vi.fn()} />);
    expect(document.querySelector('[aria-current="date"]')).not.toBeNull();
  });
});

describe("MesView", () => {
  it("monta a grade, mostra até 3 chips e abre o detalhe do dia", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<MesView cursor={NOV} eventosPorDia={groupByDia(EVENTOS)} onEventoClick={onClick} />);
    expect(container.querySelectorAll(".min-h-\\[100px\\].bg-muted\\/10")).toHaveLength(6 + 6);
    expect(screen.getByText("+1 mais")).toBeInTheDocument();
    expect(screen.getByTitle("Em atraso · Disciplinas")).toBeInTheDocument();

    await user.click(screen.getByText("+1 mais"));
    const detalhe = await screen.findByRole("dialog");
    await user.click(within(detalhe).getByText("Feita"));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: "4" }));
  });

  it("botão + por dia abre o conteúdo de criação e fecha pelo callback", async () => {
    const user = userEvent.setup();
    const renderNovo = vi.fn((dia: Date, fechar: () => void) => (
      <button type="button" onClick={fechar}>
        criar em {fmtKey(dia)}
      </button>
    ));
    render(<MesView cursor={NOV} eventosPorDia={new Map()} onEventoClick={vi.fn()} renderNovoNoDia={renderNovo} />);
    await user.click(screen.getByRole("button", { name: /Nova tarefa em 5 de novembro/ }));
    await user.click(await screen.findByText("criar em 2026-11-05"));
    expect(screen.queryByText("criar em 2026-11-05")).not.toBeInTheDocument();
  });

  it("destaca hoje", () => {
    const hoje = new Date();
    render(<MesView cursor={hoje} eventosPorDia={new Map()} onEventoClick={vi.fn()} />);
    expect(document.querySelector(".bg-brand.rounded-full")).toHaveTextContent(String(hoje.getDate()));
  });
});

describe("SemanaView", () => {
  it("mostra a semana de segunda a domingo e abre o evento", async () => {
    const onClick = vi.fn();
    render(<SemanaView cursor={new Date(2026, 10, 11)} eventosPorDia={groupByDia(EVENTOS)} onEventoClick={onClick} />);
    expect(screen.getByText("Seg")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(6);
    await userEvent.setup().click(screen.getByText("Revisão"));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: "2" }));
  });

  it("destaca hoje", () => {
    render(<SemanaView cursor={new Date()} eventosPorDia={new Map()} onEventoClick={vi.fn()} />);
    expect(document.querySelector(".bg-brand.rounded-full")).not.toBeNull();
    expect(todayKey()).toBe(fmtKey(new Date()));
  });
});

describe("AgendaView", () => {
  it("mês sem prazos mostra vazio", () => {
    render(<AgendaView cursor={new Date(2026, 0, 1)} eventos={EVENTOS} onEventoClick={vi.fn()} />);
    expect(screen.getByText("Nenhum prazo em Janeiro de 2026.")).toBeInTheDocument();
  });

  it("agrupa os prazos do mês por dia, com badges de estado", async () => {
    const onClick = vi.fn();
    render(<AgendaView cursor={NOV} eventos={EVENTOS} onEventoClick={onClick} />);
    expect(screen.queryByText("Fora do mês")).not.toBeInTheDocument();
    expect(screen.getByText("atraso")).toBeInTheDocument();
    expect(screen.getByText("próximo")).toBeInTheDocument();
    expect(screen.getByText("pausado")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.getByText("Ana Seed")).toBeInTheDocument();
    expect(screen.getByText("Residencial")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("Outra"));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: "5" }));
  });

  it("com criação, lista todos os dias do mês com botão + Tarefa", async () => {
    const user = userEvent.setup();
    render(
      <AgendaView
        cursor={NOV}
        eventos={[]}
        onEventoClick={vi.fn()}
        renderNovoNoDia={(dia, fechar) => (
          <button type="button" onClick={fechar}>
            nova em {dia.getDate()}
          </button>
        )}
      />
    );
    const botoes = screen.getAllByRole("button", { name: /Tarefa/ });
    expect(botoes).toHaveLength(30);
    await user.click(botoes[2]);
    await user.click(await screen.findByText("nova em 3"));
    expect(screen.queryByText("nova em 3")).not.toBeInTheDocument();
  });
});

describe("CalendarioSidebar e legenda", () => {
  it("liga/desliga camadas e mostra filtros extras", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <CalendarioSidebar
        selecionado={NOV}
        diasComEvento={new Set()}
        onSelectDate={vi.fn()}
        camadas={["projeto", "tarefa"]}
        visiveis={{ tarefa: false }}
        onToggleCamada={onToggle}
      >
        <span>filtro-extra</span>
      </CalendarioSidebar>
    );
    expect(screen.getByRole("checkbox", { name: "Projetos" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Tarefas" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Tarefas" }));
    expect(onToggle).toHaveBeenCalledWith("tarefa", true);
    await user.click(screen.getByRole("checkbox", { name: "Projetos" }));
    expect(onToggle).toHaveBeenCalledWith("projeto", false);
    expect(screen.getByText("filtro-extra")).toBeInTheDocument();
  });

  it("sem filtros extras não mostra a seção", () => {
    render(
      <CalendarioSidebar
        selecionado={NOV}
        diasComEvento={new Set()}
        onSelectDate={vi.fn()}
        camadas={["disciplina"]}
        visiveis={{}}
        onToggleCamada={vi.fn()}
      />
    );
    expect(screen.queryByText("Filtros")).not.toBeInTheDocument();
  });

  it("legenda lista as camadas pedidas; detalhe sem extras", () => {
    render(<CalendarioLegenda camadas={["projeto", "disciplina"]} />);
    expect(screen.getByText("Em atraso")).toBeInTheDocument();
    expect(screen.getByText("Disciplinas")).toBeInTheDocument();
    render(<EventoDetalhe evento={evento({ titulo: "Simples" })} onOpen={vi.fn()} />);
    expect(screen.getByText("Simples")).toBeInTheDocument();
  });
});
