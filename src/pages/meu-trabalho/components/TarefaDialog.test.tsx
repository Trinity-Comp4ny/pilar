import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TarefaDialog } from "./TarefaDialog";
import type { Etapa } from "../useEtapas";

vi.mock("@/lib/notificarMencao", () => ({ notificarMencao: vi.fn() }));
vi.mock("@/components/ui/responsive-detail-panels", () => ({
  ResponsiveDetailPanels: ({ primary, secondary }: { primary: React.ReactNode; secondary: React.ReactNode }) => (
    <div>
      {primary}
      {secondary}
    </div>
  ),
}));
vi.mock("@/pages/projetos/components/AtividadeComposer", () => ({ AtividadeComposer: () => null }));

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
