import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TarefaDialog } from "@/components/tarefas/TarefaDialog";
import type { Etapa } from "@/hooks/tarefas/useEtapas";
import type { ReactNode } from "react";

vi.mock("@/hooks/useComentarioAutoria", () => ({
  useComentarioAutoria: () => ({ autorId: "u-eu", podeExcluir: () => false }),
}));
import { notificarMencao } from "@/lib/notificarMencao";

vi.mock("@/lib/notificarMencao", () => ({ notificarMencao: vi.fn() }));
vi.mock("@/hooks/useProjetoDisciplinas", () => ({
  useProjetoDisciplinas: (id: string) => ({ data: [{ id: `${id}-d1`, nome: "Estrutural" }] }),
}));
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
vi.mock("@/components/ui/responsive-detail-panels", () => ({
  ResponsiveDetailPanels: ({ primary, secondary }: { primary: React.ReactNode; secondary: React.ReactNode }) => (
    <div>
      {primary}
      {secondary}
    </div>
  ),
}));
vi.mock("@/components/atividades/AtividadeComposerComMencoes", () => ({
  AtividadeComposer: ({ onSubmit }: { onSubmit: (texto: string, ids: string[]) => void }) => (
    <button onClick={() => onSubmit("Rever com @Ana", ["p-1"])}>Adicionar comentário</button>
  ),
}));

const etapas: Etapa[] = [{ id: "e1", nome: "A fazer", ordem: 0, cor: null, bucket: "a_fazer" }];

function abrirNova(onSave = vi.fn().mockResolvedValue("t1")) {
  render(
    <TarefaDialog
      open
      onOpenChange={vi.fn()}
      pessoas={[]}
      projetos={[]}
      etapas={etapas}
      defaultResponsavelId={null}
      autorNome="Eu"
      onSave={onSave}
      saving={false}
    />
  );
  return onSave;
}

describe("TarefaDialog: nome obrigatório", () => {
  // Feedback da VRZ (17/10): "não consigo criar tarefa, o botão salvar não acende".
  // O campo do nome parece um título e o botão ficava apagado sem dizer por quê.
  it("o botão Salvar não fica desabilitado sem nome", () => {
    abrirNova();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
  });

  it("Salvar sem nome mostra o erro, foca o campo e não grava", () => {
    const onSave = abrirNova();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Dê um nome à tarefa para salvar.");
    const campo = screen.getByRole("textbox", { name: "Nome da tarefa" });
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("nome só com espaços também não passa", () => {
    const onSave = abrirNova();
    fireEvent.change(screen.getByRole("textbox", { name: "Nome da tarefa" }), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("com nome, grava e não mostra erro", async () => {
    const onSave = abrirNova();
    fireEvent.change(screen.getByRole("textbox", { name: "Nome da tarefa" }), {
      target: { value: "Revisar memorial" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ titulo: "Revisar memorial", etapa_id: "e1" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("o erro some quando a pessoa digita o nome", () => {
    abrirNova();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Nome da tarefa" }), { target: { value: "A" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// SPEC 140: dentro da obra o formulário oferece o serviço do cronograma (opcional).
describe("TarefaDialog: serviço da obra", () => {
  const servicos = [{ id: "s1", caminho: "Estrutura › Fundação › Sapatas" }];

  function abrirNaObra(servicosObra?: typeof servicos) {
    const onSave = vi.fn().mockResolvedValue("t1");
    render(
      <TarefaDialog
        open
        onOpenChange={vi.fn()}
        pessoas={[]}
        projetos={[]}
        etapas={etapas}
        defaultResponsavelId={null}
        autorNome="Eu"
        onSave={onSave}
        saving={false}
        servicosObra={servicosObra}
      />
    );
    return onSave;
  }

  it("fora da obra o campo não existe e o serviço não vai no input", async () => {
    const onSave = abrirNaObra();
    expect(screen.queryByText("Serviço da obra")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Nome da tarefa" }), { target: { value: "Tarefa avulsa" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("obra_frente_id");
  });

  it("na obra o campo aparece, começa sem serviço e manda obra_frente_id nulo", async () => {
    const onSave = abrirNaObra(servicos);
    expect(screen.getByText("Serviço da obra")).toBeInTheDocument();
    expect(screen.getByText("Sem serviço")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Nome da tarefa" }), { target: { value: "Tarefa da obra" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ obra_frente_id: null }));
  });
});

describe("TarefaDialog: vínculo com projeto e apontamento", () => {
  function abrir(extra: Partial<React.ComponentProps<typeof TarefaDialog>> = {}) {
    const onSave = vi.fn().mockResolvedValue("t-nova");
    const fechar = vi.fn();
    const queryClient = new QueryClient();
    render(
      <TarefaDialog
        open
        onOpenChange={fechar}
        pessoas={[{ id: "p-1", nome: "Ana" }]}
        projetos={[
          { id: "proj-1", nome: "Edifício" },
          { id: "proj-2", nome: "Reforma" },
        ]}
        etapas={[...etapas, { id: "e2", nome: "Concluída", ordem: 1, cor: null, bucket: "concluida" }]}
        defaultResponsavelId="p-1"
        autorNome="Eu"
        onSave={onSave}
        saving={false}
        defaultTitulo="Conferir cotas"
        defaultDescricao="Apontamento da prancha"
        {...extra}
      />,
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    );
    return { onSave, fechar };
  }
  function escolher(combo: HTMLElement, nome: string) {
    fireEvent.keyDown(combo, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: nome }));
  }

  it("salva a disciplina e a classificação de retrabalho dentro do projeto fixo", async () => {
    const { onSave } = abrir({ projetoFixoId: "proj-1", defaultDisciplinaId: "proj-1-d1" });
    expect(screen.getByText("Edifício").closest("button")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Disciplina" })).toHaveTextContent("Estrutural");
    fireEvent.click(screen.getByRole("checkbox", { name: /Correção interna/ }));
    fireEvent.change(screen.getByPlaceholderText(/Detalhes, contexto/), { target: { value: "Cota corrigida" } });
    escolher(screen.getByText("A fazer").closest("button")!, "Concluída");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar comentário" }));
    expect(notificarMencao).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          projeto_id: "proj-1",
          projeto_disciplina_id: "proj-1-d1",
          retrabalho: true,
          descricao: "Cota corrigida",
          status: "concluida",
          responsaveis: ["p-1"],
          comentarios: [expect.objectContaining({ texto: "Rever com @Ana", mencionados: ["p-1"] })],
        })
      )
    );
    expect(notificarMencao).toHaveBeenCalledWith("tarefa", "t-nova", ["p-1"], "Rever com @Ana", expect.any(String));
  });

  it("limpa a disciplina anterior quando troca o projeto de uma tarefa", async () => {
    const { onSave } = abrir();
    escolher(screen.getByText("Sem projeto").closest("button")!, "Edifício");
    escolher(screen.getByRole("combobox", { name: "Disciplina" }), "Estrutural");
    escolher(screen.getByText("Edifício").closest("button")!, "Reforma");
    expect(screen.getByRole("combobox", { name: "Disciplina" })).toHaveTextContent("Sem disciplina");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          projeto_id: "proj-2",
          projeto_disciplina_id: null,
          retrabalho: false,
        })
      )
    );
  });

  it("em leitura, preserva os dados sem oferecer mudança de disciplina ou classificação", () => {
    const { fechar } = abrir({ projetoFixoId: "proj-1", readOnly: true });
    expect(screen.getByRole("combobox", { name: "Disciplina" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Correção interna/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Fechar", exact: true })[0]);
    expect(fechar).toHaveBeenCalledWith(false);
  });
});
