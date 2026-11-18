import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NovoNoDia } from "./NovoNoDia";

describe("NovoNoDia", () => {
  it("sem Google Agenda vai direto para o formulário da tarefa", () => {
    render(
      <NovoNoDia podeReuniao={false} onReuniao={vi.fn()}>
        <p>form tarefa</p>
      </NovoNoDia>
    );
    expect(screen.getByText("form tarefa")).toBeInTheDocument();
  });

  it("com agenda conectada oferece tarefa ou reunião", async () => {
    const user = userEvent.setup();
    const onReuniao = vi.fn();
    render(
      <NovoNoDia podeReuniao onReuniao={onReuniao}>
        <p>form tarefa</p>
      </NovoNoDia>
    );
    expect(screen.queryByText("form tarefa")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reunião" }));
    expect(onReuniao).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Tarefa" }));
    expect(screen.getByText("form tarefa")).toBeInTheDocument();
  });
});
