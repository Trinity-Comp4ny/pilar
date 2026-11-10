import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

type Comentario = { id: string; texto: string; autor: string; data: string; mencionados?: string[] };
const estado = vi.hoisted(() => ({
  comentarios: [] as Comentario[],
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
}));
const notificarMencao = vi.hoisted(() => vi.fn());
const apagarNotificacoesComentario = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useProjetoAtividades", () => ({
  useProjetoAtividades: () => ({
    comentarios: estado.comentarios,
    salvar: { mutate: estado.mutate, mutateAsync: estado.mutateAsync },
  }),
}));
vi.mock("@/hooks/useComentarioAutoria", () => ({
  useComentarioAutoria: () => ({ autorId: "u-eu", podeExcluir: (c: Comentario) => c.autor === "Eu" }),
}));
vi.mock("@/lib/notificarMencao", () => ({ notificarMencao, apagarNotificacoesComentario }));
vi.mock("./AtividadeComposer", () => ({
  AtividadeComposer: ({ onSubmit }: { onSubmit: (t: string, m: string[]) => void }) => (
    <>
      <button onClick={() => onSubmit("Olá @Ana", ["p1"])}>enviar-com-mencao</button>
      <button onClick={() => onSubmit("Sem menção", [])}>enviar-sem-mencao</button>
    </>
  ),
}));
vi.mock("@/components/atividades/ComentarioCard", () => ({
  ComentarioCard: ({
    comentario,
    destacado,
    onExcluir,
  }: {
    comentario: Comentario;
    destacado?: boolean;
    onExcluir?: () => void;
  }) => (
    <div>
      <p data-destacado={String(!!destacado)}>{comentario.texto}</p>
      {onExcluir && <button onClick={onExcluir}>apagar-{comentario.id}</button>}
    </div>
  ),
}));

import { ProjetoAtividadesPanel } from "./ProjetoAtividadesPanel";

beforeEach(() => {
  estado.comentarios = [];
  estado.mutate.mockReset();
  estado.mutateAsync.mockReset();
  notificarMencao.mockReset();
  apagarNotificacoesComentario.mockReset();
});

describe("ProjetoAtividadesPanel", () => {
  it("sem comentários mostra o vazio", () => {
    render(<ProjetoAtividadesPanel projetoId="p1" pessoas={[]} autorNome="Eu" />);
    expect(screen.getByText("Nenhuma atividade ainda")).toBeInTheDocument();
  });

  it("lista comentários e destaca o do link", () => {
    estado.comentarios = [
      { id: "c1", texto: "primeiro", autor: "A", data: "2026-01-01" },
      { id: "c2", texto: "segundo", autor: "B", data: "2026-01-02" },
    ];
    render(<ProjetoAtividadesPanel projetoId="p1" pessoas={[]} autorNome="Eu" comentarioDestacado="c2" />);
    expect(screen.getByText("primeiro")).toHaveAttribute("data-destacado", "false");
    expect(screen.getByText("segundo")).toHaveAttribute("data-destacado", "true");
  });

  it("adiciona comentário com menção e notifica só depois de salvar", () => {
    estado.comentarios = [{ id: "c1", texto: "antigo", autor: "A", data: "2026-01-01" }];
    render(<ProjetoAtividadesPanel projetoId="p1" pessoas={[{ id: "p1", nome: "Ana" }]} autorNome="Eu" />);
    fireEvent.click(screen.getByText("enviar-com-mencao"));
    const [payload, opts] = estado.mutate.mock.calls[0];
    expect(payload.comentarios).toHaveLength(2);
    const novo = payload.comentarios[1];
    expect(novo).toMatchObject({ texto: "Olá @Ana", autor: "Eu", autorId: "u-eu", mencionados: ["p1"] });
    expect(notificarMencao).not.toHaveBeenCalled();
    opts.onSuccess();
    expect(notificarMencao).toHaveBeenCalledWith("projeto", "p1", ["p1"], "Olá @Ana", novo.id);
  });

  it("sem menção grava mencionados como undefined", () => {
    render(<ProjetoAtividadesPanel projetoId="p1" pessoas={[]} autorNome="Eu" />);
    fireEvent.click(screen.getByText("enviar-sem-mencao"));
    expect(estado.mutate.mock.calls[0][0].comentarios[0].mencionados).toBeUndefined();
  });

  it("só oferece apagar o que o usuário pode apagar, grava a lista sem ele e limpa a notificação", async () => {
    estado.comentarios = [
      { id: "c1", texto: "meu", autor: "Eu", data: "2026-01-01" },
      { id: "c2", texto: "do outro", autor: "B", data: "2026-01-02" },
    ];
    render(<ProjetoAtividadesPanel projetoId="p1" pessoas={[]} autorNome="Eu" />);
    expect(screen.queryByText("apagar-c2")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("apagar-c1"));
    expect(estado.mutateAsync).toHaveBeenCalledWith({ comentarios: [estado.comentarios[1]] });
    await waitFor(() => expect(apagarNotificacoesComentario).toHaveBeenCalledWith("projeto", "p1", "c1"));
  });
});
