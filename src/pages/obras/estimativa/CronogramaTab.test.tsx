import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resultadoDoSobrado } from "@/test/estimativaFixtures";
import { CronogramaTab } from "./CronogramaTab";

/** Cronograma da estimativa (SPEC 136): lista e Gantt só de leitura, com fase, etapa e serviço. */

describe("CronogramaTab", () => {
  it("resume prazo, fases e serviços e explica de onde vem o prazo", () => {
    const r = resultadoDoSobrado();
    render(<CronogramaTab resultado={r} />);
    expect(screen.getByText(`${r.meses} meses`)).toBeInTheDocument();
    expect(screen.getByText(/pessoas/)).toBeInTheDocument();
  });

  it("na lista, cada fase abre e fecha para mostrar etapas e serviços", async () => {
    const user = userEvent.setup();
    const r = resultadoDoSobrado();
    render(<CronogramaTab resultado={r} />);
    const fase = r.fases[0];
    const botao = screen.getByRole("button", { name: new RegExp(fase.nome) });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(fase.etapas[0].servicos[0].nome)).not.toBeInTheDocument();
    await user.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(fase.etapas[0].servicos[0].nome)).toBeInTheDocument();
    await user.click(botao);
    expect(screen.queryByText(fase.etapas[0].servicos[0].nome)).not.toBeInTheDocument();
  });

  it("no Gantt, há uma barra por fase e expandir mostra as etapas", async () => {
    const user = userEvent.setup();
    const r = resultadoDoSobrado();
    render(<CronogramaTab resultado={r} />);
    await user.click(screen.getByRole("button", { name: "Gantt" }));
    const gantt = screen.getByRole("region", { name: "Gantt da obra" });
    expect(within(gantt).getAllByRole("img")).toHaveLength(r.fases.length);
    await user.click(within(gantt).getByRole("button", { name: `Expandir ${r.fases[0].nome}` }));
    expect(within(gantt).getAllByRole("img").length).toBeGreaterThan(r.fases.length);
    expect(within(gantt).getByRole("button", { name: `Recolher ${r.fases[0].nome}` })).toBeInTheDocument();
  });
});
