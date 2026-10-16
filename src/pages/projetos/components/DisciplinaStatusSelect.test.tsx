import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DisciplinaStatusSelect } from "./DisciplinaStatusSelect";

// Feedback da VRZ (16/10): no modal do projeto (aberto pelo card do quadro) o status
// de cada disciplina era só rótulo; agora troca ali mesmo, sem abrir a disciplina.

describe("DisciplinaStatusSelect", () => {
  it("troca o status pela lista e devolve a opção escolhida", () => {
    const onChange = vi.fn();
    render(<DisciplinaStatusSelect status="Não Iniciado" canEdit disciplina="Estrutural" onChange={onChange} />);

    const gatilho = screen.getByRole("combobox", { name: "Status de Estrutural" });
    expect(gatilho).toHaveTextContent("Não Iniciado");

    fireEvent.keyDown(gatilho, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Em Andamento" }));

    expect(onChange).toHaveBeenCalledWith("Em Andamento");
  });

  it.each([
    ["em_andamento", "Em Andamento"],
    ["concluida", "Concluído"],
    ["Concluído", "Concluído"],
    [null, "Não Iniciado"],
  ])("grafia legada %s aparece como %s", (cru, rotulo) => {
    render(<DisciplinaStatusSelect status={cru} canEdit disciplina="Elétrica" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Status de Elétrica" })).toHaveTextContent(rotulo);
  });

  it("sem permissão de edição mostra só o rótulo", () => {
    render(<DisciplinaStatusSelect status="Em Andamento" canEdit={false} disciplina="Estrutural" onChange={vi.fn()} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Em Andamento")).toBeInTheDocument();
  });

  it("disciplina pausada fica travada", () => {
    render(<DisciplinaStatusSelect status="Pausada" canEdit disciplina="Estrutural" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Status de Estrutural" })).toBeDisabled();
  });

  it("não oferece Pausada como destino, que exige motivo no detalhe", () => {
    render(<DisciplinaStatusSelect status="Em Andamento" canEdit disciplina="Estrutural" onChange={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(within(screen.getByRole("listbox")).getByRole("option", { name: "Pausada" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });
});
