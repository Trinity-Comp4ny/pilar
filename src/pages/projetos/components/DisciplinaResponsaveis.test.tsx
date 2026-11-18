import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DisciplinaResponsaveis } from "./DisciplinaResponsaveis";
import { atribuicaoDisciplina, atribuicaoLegacy } from "../lib/atribuicaoDisciplina";
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
describe("responsável da disciplina", () => {
  it("seleciona terceirizado no próprio campo, mesmo sem pessoas, sem formulário extra", async () => {
    const user = userEvent.setup(),
      onChange = vi.fn();
    render(<DisciplinaResponsaveis value={[]} pessoas={[]} terceirizada={false} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Sem responsável" }));
    await user.click(screen.getByRole("option", { name: /Serviço terceirizado/ }));
    expect(onChange).toHaveBeenCalledWith([], true);
    expect(screen.queryByText("Execução")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Prestador ou empresa")).not.toBeInTheDocument();
  });
  it("troca terceirizado por pessoa sem manter dois responsáveis incompatíveis", async () => {
    const user = userEvent.setup(),
      onChange = vi.fn();
    render(
      <DisciplinaResponsaveis value={["p1"]} pessoas={[{ id: "p1", nome: "Ana" }]} terceirizada onChange={onChange} />
    );
    await user.click(screen.getByRole("button", { name: "Serviço terceirizado" }));
    await user.click(screen.getByRole("option", { name: /Ana/ }));
    expect(onChange).toHaveBeenCalledWith(["p1"], false);
    expect(atribuicaoDisciplina("terceirizada", "", [], [])).toEqual({
      tipo_execucao: "terceirizada",
      prestador_nome: "Serviço terceirizado",
      responsaveis: [],
    });
    expect(atribuicaoLegacy("interna", "", ["p1"], [{ id: "p1", nome: "Ana" }])).toMatchObject({
      tipo_execucao: "interna",
      prestador_nome: null,
      responsavel_id: "p1",
      responsaveis: [{ responsavel_id: "p1", responsavel_nome: "Ana" }],
    });
  });
});
