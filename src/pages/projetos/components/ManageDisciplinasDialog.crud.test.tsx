import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { Projeto } from "@/types/projetos";

// Catálogo de disciplinas: busca, criar (duplicado, erro do servidor), excluir com
// a contagem de projetos afetados, e editar (Enter, erro, disciplina do sistema).

const m = vi.hoisted(() => ({
  insert: vi.fn(),
  excluir: vi.fn(),
  renomear: vi.fn(),
  reportError: vi.fn((_e: unknown, _o?: unknown) => ({ message: "mensagem amigável" })),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: (p: unknown) => m.insert(p) }) },
}));
vi.mock("@/lib/reportError", () => ({ reportError: (e: unknown, o: unknown) => m.reportError(e, o) }));
vi.mock("@/pages/projetos/lib/disciplinaEmLote", async (orig) => ({
  ...(await orig<typeof import("@/pages/projetos/lib/disciplinaEmLote")>()),
  excluirDisciplina: (a: unknown) => m.excluir(a),
  renomearDisciplina: (a: unknown) => m.renomear(a),
}));

import { ManageDisciplinasDialog, type DisciplinaCatalogo } from "./ManageDisciplinasDialog";

const catalogo: DisciplinaCatalogo[] = [
  { id: "c1", nome: "Estrutural", empresa_id: "emp" },
  { id: "c2", nome: "Elétrica", empresa_id: "emp" },
  { id: "c3", nome: "Padrão", empresa_id: null },
];
const projetos = [
  { id: "p1", disciplinas: [{ id: "pd1", disciplina: "Estrutural" }] },
  { id: "p2", disciplinas: [{ id: "pd2", disciplina: "estrutural" }] },
  { id: "p3", disciplinas: [{ id: "pd3", disciplina: "Elétrica" }] },
] as unknown as Projeto[];

let onChanged: ReturnType<typeof vi.fn<() => void>>;
function montar(disciplinas = catalogo) {
  onChanged = vi.fn();
  render(
    <ManageDisciplinasDialog
      open
      onOpenChange={vi.fn()}
      disciplinas={disciplinas}
      projetos={projetos}
      onDisciplinasChanged={onChanged}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  m.insert.mockResolvedValue({ error: null });
  m.excluir.mockResolvedValue(undefined);
  m.renomear.mockResolvedValue(undefined);
});

describe("ManageDisciplinasDialog: lista e busca", () => {
  it("conta as cadastradas e filtra pela busca, com mensagem quando nada casa", () => {
    montar();
    expect(screen.getByText("3 disciplinas cadastradas")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Buscar disciplina..."), { target: { value: "elé" } });
    expect(screen.queryByText("Estrutural")).not.toBeInTheDocument();
    expect(screen.getByText("Elétrica")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Buscar disciplina..."), { target: { value: "zzz" } });
    expect(screen.getByText('Nenhuma disciplina encontrada para "zzz"')).toBeInTheDocument();
  });

  it("singular com uma só", () => {
    montar([catalogo[0]]);
    expect(screen.getByText("1 disciplina cadastrada")).toBeInTheDocument();
  });
});

describe("ManageDisciplinasDialog: criar", () => {
  const abrir = () => fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
  const dialogoNovo = () => screen.getByRole("dialog", { name: "Nova disciplina" });

  it("cria com nome aparado pelo Enter e fecha", async () => {
    montar();
    abrir();
    const campo = within(dialogoNovo()).getByPlaceholderText("Ex.: Arquitetônico");
    fireEvent.change(campo, { target: { value: "  Hidráulica " } });
    await act(async () => fireEvent.keyDown(campo, { key: "Enter" }));
    expect(m.insert).toHaveBeenCalledWith({ nome: "Hidráulica" });
    expect(toast.success).toHaveBeenCalledWith("Disciplina adicionada");
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Nova disciplina" })).not.toBeInTheDocument();
  });

  it("nome vazio não chama o servidor; duplicado (sem diferenciar maiúscula) avisa", async () => {
    montar();
    abrir();
    const campo = within(dialogoNovo()).getByPlaceholderText("Ex.: Arquitetônico");
    fireEvent.keyDown(campo, { key: "Enter" });
    fireEvent.keyDown(campo, { key: "a" });
    fireEvent.change(campo, { target: { value: "ESTRUTURAL" } });
    await act(async () => fireEvent.click(within(dialogoNovo()).getByRole("button", { name: "Adicionar" })));
    expect(toast.error).toHaveBeenCalledWith("Já existe uma disciplina com este nome");
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("erro do servidor reporta e mantém o diálogo com o nome", async () => {
    m.insert.mockResolvedValue({ error: { message: "limite do plano" } });
    montar();
    abrir();
    const campo = within(dialogoNovo()).getByPlaceholderText("Ex.: Arquitetônico");
    fireEvent.change(campo, { target: { value: "Gás" } });
    await act(async () => fireEvent.click(within(dialogoNovo()).getByRole("button", { name: "Adicionar" })));
    expect(m.reportError).toHaveBeenCalledWith(
      { message: "limite do plano" },
      { context: "disciplina:criar", extra: { nome: "Gás" } }
    );
    expect(toast.error).toHaveBeenCalledWith("Não foi possível adicionar a disciplina", {
      description: "mensagem amigável",
    });
    expect(campo).toHaveValue("Gás");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("Cancelar fecha e limpa o nome", () => {
    montar();
    abrir();
    fireEvent.change(within(dialogoNovo()).getByPlaceholderText("Ex.: Arquitetônico"), { target: { value: "X" } });
    fireEvent.click(within(dialogoNovo()).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog", { name: "Nova disciplina" })).not.toBeInTheDocument();
    abrir();
    expect(within(dialogoNovo()).getByPlaceholderText("Ex.: Arquitetônico")).toHaveValue("");
    fireEvent.keyDown(dialogoNovo(), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Nova disciplina" })).not.toBeInTheDocument();
  });
});

describe("ManageDisciplinasDialog: excluir", () => {
  it("avisa quantos projetos usam e exclui", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Excluir disciplina Estrutural" }));
    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText(/Ela está em 2 projetos e será removida de todos/)).toBeInTheDocument();
    await act(async () => fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir" })));
    expect(m.excluir).toHaveBeenCalledWith({ nome: "Estrutural", projetos, catalogo });
    expect(toast.success).toHaveBeenCalledWith("Disciplina excluída");
    expect(onChanged).toHaveBeenCalled();
  });

  it("um projeto no singular; sem uso só avisa que não dá para desfazer", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Excluir disciplina Elétrica" }));
    expect(screen.getByText(/Ela está em 1 projeto e será removida/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir disciplina Padrão" }));
    expect(within(screen.getByRole("alertdialog")).getByText("Não dá para desfazer.")).toBeInTheDocument();
  });

  it("falha ao excluir reporta o erro", async () => {
    m.excluir.mockRejectedValue(new Error("fk"));
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Excluir disciplina Elétrica" }));
    await act(async () =>
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }))
    );
    expect(m.reportError).toHaveBeenCalledWith(expect.any(Error), {
      context: "disciplina:excluir",
      extra: { id: "c2" },
    });
    expect(toast.error).toHaveBeenCalledWith("Não foi possível excluir a disciplina", {
      description: "mensagem amigável",
    });
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("ManageDisciplinasDialog: editar", () => {
  const dialogoEditar = () => screen.getByRole("dialog", { name: "Editar disciplina" });

  it("disciplina do sistema (sem empresa) não abre edição", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Editar disciplina Padrão" }));
    expect(screen.queryByRole("dialog", { name: "Editar disciplina" })).not.toBeInTheDocument();
  });

  it("renomeia pelo Enter; nome vazio não salva; mesmo nome passa", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Editar disciplina Elétrica" }));
    const campo = within(dialogoEditar()).getByDisplayValue("Elétrica");
    fireEvent.change(campo, { target: { value: "  " } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(m.renomear).not.toHaveBeenCalled();
    fireEvent.keyDown(campo, { key: "x" });

    fireEvent.change(campo, { target: { value: "Elétrica e Dados" } });
    await act(async () => fireEvent.keyDown(campo, { key: "Enter" }));
    expect(m.renomear).toHaveBeenCalledWith({
      nome: "Elétrica",
      novoNome: "Elétrica e Dados",
      projetos,
      catalogo,
    });
    expect(toast.success).toHaveBeenCalledWith("Disciplina atualizada");
    expect(screen.queryByRole("dialog", { name: "Editar disciplina" })).not.toBeInTheDocument();
  });

  it("falha ao renomear reporta e mantém aberto", async () => {
    m.renomear.mockRejectedValue(new Error("rls"));
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Editar disciplina Elétrica" }));
    fireEvent.change(within(dialogoEditar()).getByDisplayValue("Elétrica"), { target: { value: "Elétrica 2" } });
    await act(async () => fireEvent.click(within(dialogoEditar()).getByRole("button", { name: "Salvar" })));
    expect(m.reportError).toHaveBeenCalledWith(expect.any(Error), {
      context: "disciplina:editar",
      extra: { id: "c2", nome: "Elétrica 2" },
    });
    expect(toast.error).toHaveBeenCalledWith("Não foi possível editar a disciplina", {
      description: "mensagem amigável",
    });
    expect(dialogoEditar()).toBeInTheDocument();
  });

  it("Cancelar e Esc fecham a edição", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Editar disciplina Elétrica" }));
    fireEvent.click(within(dialogoEditar()).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog", { name: "Editar disciplina" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar disciplina Elétrica" }));
    fireEvent.keyDown(dialogoEditar(), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Editar disciplina" })).not.toBeInTheDocument();
  });
});
