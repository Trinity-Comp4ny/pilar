import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DisciplinaExecucaoEditor } from "./ExecucaoDisciplinaFields";

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const disciplina = { disciplina: "Medição", responsavel_id: "", responsavel_nome: "" };

describe("execução terceirizada", () => {
  it("exige prestador, salva sem usuário interno e bloqueia reenvio enquanto salva", async () => {
    const user = userEvent.setup();
    let concluir!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          concluir = resolve;
        })
    );
    render(<DisciplinaExecucaoEditor disciplina={disciplina} onSave={onSave} />);
    expect(screen.queryByLabelText("Prestador ou empresa")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Serviço terceirizado" }));
    const salvar = screen.getByRole("button", { name: "Salvar execução" });
    expect(salvar).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Prestador ou empresa"), { target: { value: "  Empresa parceira  " } });
    expect(salvar).toBeEnabled();
    await user.click(salvar);
    expect(onSave).toHaveBeenCalledExactlyOnceWith("terceirizada", "Empresa parceira");
    expect(salvar).toBeDisabled();
    await act(async () => concluir());
    expect(salvar).toBeEnabled();
  });
  it("permite voltar para equipe interna sem exigir prestador", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <DisciplinaExecucaoEditor
        disciplina={{ ...disciplina, tipo_execucao: "terceirizada", prestador_nome: "Empresa" }}
        onSave={onSave}
      />
    );
    expect(screen.getByLabelText("Prestador ou empresa")).toHaveValue("Empresa");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Equipe interna" }));
    expect(screen.queryByLabelText("Prestador ou empresa")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar execução" }));
    expect(onSave).toHaveBeenCalledWith("interna", "Empresa");
  });
});
