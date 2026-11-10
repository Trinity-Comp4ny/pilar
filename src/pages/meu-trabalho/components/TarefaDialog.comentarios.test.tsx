import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Etapa } from "../useEtapas";
import type { TarefaItem } from "../hooks";

const apagarNotificacoesComentario = vi.hoisted(() => vi.fn());
vi.mock("@/lib/notificarMencao", () => ({ notificarMencao: vi.fn(), apagarNotificacoesComentario }));
vi.mock("@/hooks/useComentarioAutoria", () => ({
  useComentarioAutoria: () => ({ autorId: "u-eu", podeExcluir: () => true }),
}));
vi.mock("@/components/atividades/ComentarioCard", () => ({
  ComentarioCard: ({
    comentario,
    onExcluir,
  }: {
    comentario: { id: string; texto: string };
    onExcluir?: () => void;
  }) => (
    <div>
      <p>{comentario.texto}</p>
      {onExcluir && <button onClick={onExcluir}>apagar-{comentario.id}</button>}
    </div>
  ),
}));
vi.mock("@/components/ui/responsive-detail-panels", () => ({
  ResponsiveDetailPanels: ({ primary, secondary }: { primary: React.ReactNode; secondary: React.ReactNode }) => (
    <div>
      {primary}
      {secondary}
    </div>
  ),
}));
vi.mock("@/pages/projetos/components/AtividadeComposer", () => ({ AtividadeComposer: () => null }));

import { TarefaDialog } from "./TarefaDialog";

const etapas: Etapa[] = [{ id: "e1", nome: "A fazer", ordem: 0, cor: null, bucket: "a_fazer" }];

const tarefa = {
  id: "t1",
  numero: 1,
  titulo: "Revisar prancha",
  descricao: null,
  status: "a_fazer",
  prioridade: "media",
  created_by: "u-eu",
  responsavel_id: null,
  responsaveis: [],
  projeto_id: null,
  etapa_id: "e1",
  obra_id: null,
  obra_frente_id: null,
  prazo: null,
  horas_estimadas: null,
  horas_reais: null,
  labels: [],
  links: [],
  comentarios: [
    { id: "c1", texto: "primeiro", autor: "Eu", data: "2026-11-10" },
    { id: "c2", texto: "segundo", autor: "Eu", data: "2026-11-10" },
  ],
  projeto: null,
} as unknown as TarefaItem;

beforeEach(() => apagarNotificacoesComentario.mockReset());

describe("TarefaDialog: apagar comentário", () => {
  it("tira da lista na hora e só limpa a notificação depois do Salvar gravar", async () => {
    const onSave = vi.fn().mockResolvedValue("t1");
    render(
      <TarefaDialog
        open
        onOpenChange={vi.fn()}
        tarefa={tarefa}
        pessoas={[]}
        projetos={[]}
        etapas={etapas}
        defaultResponsavelId={null}
        autorNome="Eu"
        onSave={onSave}
        saving={false}
      />
    );

    fireEvent.click(screen.getByText("apagar-c1"));
    expect(screen.queryByText("primeiro")).not.toBeInTheDocument();
    expect(apagarNotificacoesComentario).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(apagarNotificacoesComentario).toHaveBeenCalledWith("tarefa", "t1", "c1"));
    expect(onSave.mock.calls[0][0].comentarios.map((c: { id: string }) => c.id)).toEqual(["c2"]);
  });
});
