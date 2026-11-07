import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { DisciplinaLinha } from "../lib/disciplinasCalc";

// Editor de disciplinas da proposta: horas x custo/h = custo, valor de venda
// digitado, totais e margem. Disciplina fora do catálogo vira "Outra...".

vi.mock("@/components/ui/select", async () => await import("@/pages/financeiro/testing/nativeSelect"));

import { DisciplinasEditor } from "./DisciplinasEditor";

const linha = (p: Partial<DisciplinaLinha> = {}): DisciplinaLinha => ({
  id: "l1",
  disciplina: "Estrutural",
  horas_estimadas: 10,
  custo_hora: 100,
  valor_venda: 2000,
  ...p,
});

describe("DisciplinasEditor", () => {
  it("sem linhas mostra o estado vazio e não mostra totais", () => {
    render(<DisciplinasEditor rows={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/Nenhuma disciplina/)).toBeInTheDocument();
    expect(screen.queryByText(/Soma venda/)).not.toBeInTheDocument();
  });

  it("adicionar disciplina inclui uma linha vazia", () => {
    const onChange = vi.fn();
    render(<DisciplinasEditor rows={[linha()]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar disciplina/ }));
    const novas = onChange.mock.calls[0][0] as DisciplinaLinha[];
    expect(novas).toHaveLength(2);
    expect(novas[1]).toMatchObject({ disciplina: "", horas_estimadas: 0, custo_hora: 0, valor_venda: 0 });
    expect(novas[1].id).not.toBe("l1");
  });

  it("calcula custo da linha, totais e margem positiva", () => {
    render(<DisciplinasEditor rows={[linha(), linha({ id: "l2", disciplina: "Elétrico", horas_estimadas: 5 })]} onChange={vi.fn()} />);
    expect(screen.getByText("15h")).toBeInTheDocument();
    expect(screen.getByText(/Custo: R\$\s?1\.500,00/)).toBeInTheDocument();
    expect(screen.getByText(/Soma venda: R\$\s?4\.000,00/)).toBeInTheDocument();
    expect(screen.getByText("Margem: 62.5%")).toBeInTheDocument();
  });

  it("margem negativa quando o custo supera a venda", () => {
    render(<DisciplinasEditor rows={[linha({ valor_venda: 500 })]} onChange={vi.fn()} />);
    expect(screen.getByText("Margem: -100.0%").className).toMatch(/danger/);
  });

  it("sem valor de venda não mostra margem", () => {
    render(<DisciplinasEditor rows={[linha({ valor_venda: 0 })]} onChange={vi.fn()} />);
    expect(screen.queryByText(/Margem/)).not.toBeInTheDocument();
  });

  it("remover disciplina tira a linha", () => {
    const onChange = vi.fn();
    render(<DisciplinasEditor rows={[linha(), linha({ id: "l2" })]} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Remover disciplina" })[0]);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: "l2" })]);
  });

  it("trocar a disciplina pelo select atualiza só a linha", () => {
    const onChange = vi.fn();
    render(<DisciplinasEditor rows={[linha()]} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "PPCI" } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: "l1", disciplina: "PPCI" })]);
  });

  it("escolher Outra limpa o nome; disciplina livre mostra campo de texto", () => {
    const onChange = vi.fn();
    const { rerender } = render(<DisciplinasEditor rows={[linha()]} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "__outra__" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ disciplina: "" })]);

    rerender(<DisciplinasEditor rows={[linha({ disciplina: "Paisagismo" })]} onChange={onChange} />);
    const livre = screen.getByPlaceholderText("Nome da disciplina");
    expect(livre).toHaveValue("Paisagismo");
    fireEvent.change(livre, { target: { value: "Paisagismo urbano" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ disciplina: "Paisagismo urbano" })]);
  });

  it("horas aceitam vírgula decimal; custo/h e venda entram como centavos", () => {
    const onChange = vi.fn();
    render(<DisciplinasEditor rows={[linha()]} onChange={onChange} />);
    const [horas, custoHora, venda] = screen.getAllByRole("textbox");
    fireEvent.change(horas, { target: { value: "12,5" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ horas_estimadas: 12.5 })]);
    fireEvent.change(custoHora, { target: { value: "15000" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ custo_hora: 150 })]);
    fireEvent.change(venda, { target: { value: "300000" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ valor_venda: 3000 })]);
  });

  it("horas inválidas viram zero", () => {
    const onChange = vi.fn();
    render(<DisciplinasEditor rows={[linha()]} onChange={onChange} />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ horas_estimadas: 0 })]);
  });

  it("desabilitado não permite adicionar nem remover", () => {
    render(<DisciplinasEditor rows={[linha()]} onChange={vi.fn()} disabled />);
    expect(screen.queryByRole("button", { name: /Adicionar disciplina/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover disciplina" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
