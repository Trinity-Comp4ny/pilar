import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManageDisciplinasDialog, type DisciplinaCatalogo } from "./ManageDisciplinasDialog";

const mocks = vi.hoisted(() => ({
  eqMock: vi.fn(),
  updateMock: vi.fn(),
  fromMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccessMock,
    error: mocks.toastErrorMock,
  },
}));

function renderDialog(disciplinas: DisciplinaCatalogo[], onDisciplinasChanged = vi.fn()) {
  render(
    <ManageDisciplinasDialog
      open
      onOpenChange={vi.fn()}
      disciplinas={disciplinas}
      onDisciplinasChanged={onDisciplinasChanged}
    />
  );
  return { onDisciplinasChanged };
}

describe("ManageDisciplinasDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eqMock.mockResolvedValue({ error: null });
    mocks.updateMock.mockReturnValue({ eq: mocks.eqMock });
    mocks.fromMock.mockReturnValue({ update: mocks.updateMock });
  });

  it("edita o nome de uma disciplina da empresa", async () => {
    const user = userEvent.setup();
    const { onDisciplinasChanged } = renderDialog([{ id: "disc-1", nome: "Estrutural", empresa_id: "empresa-1" }]);

    await user.click(screen.getByRole("button", { name: "Editar disciplina Estrutural" }));
    const input = screen.getByDisplayValue("Estrutural");
    await user.clear(input);
    await user.type(input, "Estrutura");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.eqMock).toHaveBeenCalledWith("id", "disc-1"));
    expect(mocks.updateMock).toHaveBeenCalledWith({ nome: "Estrutura" });
    expect(mocks.toastSuccessMock).toHaveBeenCalledWith("Disciplina atualizada");
    expect(onDisciplinasChanged).toHaveBeenCalledOnce();
  });

  it("deixa disciplina padrão do sistema somente leitura", () => {
    renderDialog([{ id: "disc-global", nome: "Arquitetura", empresa_id: null }]);

    expect(screen.getByText("Padrão do sistema")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar disciplina Arquitetura" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir disciplina Arquitetura" })).not.toBeInTheDocument();
  });

  it("bloqueia renomear para nome duplicado", async () => {
    const user = userEvent.setup();
    renderDialog([
      { id: "disc-1", nome: "Estrutural", empresa_id: "empresa-1" },
      { id: "disc-2", nome: "Arquitetura", empresa_id: "empresa-1" },
    ]);

    await user.click(screen.getByRole("button", { name: "Editar disciplina Estrutural" }));
    const input = screen.getByDisplayValue("Estrutural");
    await user.clear(input);
    await user.type(input, "Arquitetura");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mocks.toastErrorMock).toHaveBeenCalledWith("Já existe uma disciplina com este nome");
    expect(mocks.updateMock).not.toHaveBeenCalled();
  });
});
