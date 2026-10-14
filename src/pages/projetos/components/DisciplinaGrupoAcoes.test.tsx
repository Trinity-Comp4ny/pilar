import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Projeto } from "@/types/projetos";
import { DisciplinaGrupoAcoes } from "./DisciplinaGrupoAcoes";

const mocks = vi.hoisted(() => ({
  excluir: vi.fn(),
  renomear: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock("@/pages/projetos/lib/disciplinaEmLote", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/pages/projetos/lib/disciplinaEmLote")>()),
  excluirDisciplina: mocks.excluir,
  renomearDisciplina: mocks.renomear,
}));

const projeto = (id: string, nomes: string[]) =>
  ({ id, disciplinas: nomes.map((disciplina, i) => ({ id: `${id}-d${i}`, disciplina })) }) as unknown as Projeto;
const projetos = [projeto("p1", ["Cadastro de clientes"]), projeto("p2", ["Cadastro de clientes", "Elétrica"])];

function renderAcoes(onChanged = vi.fn()) {
  render(<DisciplinaGrupoAcoes nome="Cadastro de clientes" projetos={projetos} catalogo={[]} onChanged={onChanged} />);
  return { onChanged };
}

describe("DisciplinaGrupoAcoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.excluir.mockResolvedValue(undefined);
    mocks.renomear.mockResolvedValue(undefined);
  });

  it("avisa em quantos projetos a disciplina está antes de excluir e recarrega ao confirmar", async () => {
    const user = userEvent.setup();
    const { onChanged } = renderAcoes();

    await user.click(screen.getByRole("button", { name: "Ações da disciplina Cadastro de clientes" }));
    await user.click(await screen.findByRole("menuitem", { name: "Excluir" }));

    expect(await screen.findByText(/Ela está em 2 projetos e será removida de todos/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(mocks.excluir).toHaveBeenCalledOnce());
    expect(mocks.excluir.mock.calls[0][0].nome).toBe("Cadastro de clientes");
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("bloqueia renomear para o nome de outra disciplina", async () => {
    const user = userEvent.setup();
    renderAcoes();

    await user.click(screen.getByRole("button", { name: "Ações da disciplina Cadastro de clientes" }));
    await user.click(await screen.findByRole("menuitem", { name: "Renomear" }));
    const input = screen.getByDisplayValue("Cadastro de clientes");
    await user.clear(input);
    await user.type(input, "elétrica");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mocks.toastError).toHaveBeenCalledWith("Já existe uma disciplina com este nome");
    expect(mocks.renomear).not.toHaveBeenCalled();
  });

  it("renomeia e recarrega", async () => {
    const user = userEvent.setup();
    const { onChanged } = renderAcoes();

    await user.click(screen.getByRole("button", { name: "Ações da disciplina Cadastro de clientes" }));
    await user.click(await screen.findByRole("menuitem", { name: "Renomear" }));
    const input = screen.getByDisplayValue("Cadastro de clientes");
    await user.clear(input);
    await user.type(input, "Cadastro");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.renomear).toHaveBeenCalledOnce());
    expect(mocks.renomear.mock.calls[0][0]).toMatchObject({ nome: "Cadastro de clientes", novoNome: "Cadastro" });
    expect(onChanged).toHaveBeenCalledOnce();
  });
});
