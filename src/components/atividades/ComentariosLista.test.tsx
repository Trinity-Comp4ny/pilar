import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const apagarNotificacoesComentario = vi.hoisted(() => vi.fn());
vi.mock("@/lib/notificarMencao", () => ({ apagarNotificacoesComentario }));
vi.mock("@/hooks/useComentarioAutoria", () => ({
  useComentarioAutoria: () => ({ autorId: "u-eu", podeExcluir: (c: { autor: string }) => c.autor === "Eu" }),
}));
vi.mock("./ComentarioCard", () => ({
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

import { ComentariosLista } from "./ComentariosLista";

const comentarios = [
  { id: "c1", texto: "meu", autor: "Eu", data: "2026-11-10" },
  { id: "c2", texto: "alheio", autor: "Outro", data: "2026-11-10" },
];

beforeEach(() => apagarNotificacoesComentario.mockReset());

describe("ComentariosLista", () => {
  it("vazio mostra o texto de vazio", () => {
    render(<ComentariosLista comentarios={[]} pessoas={[]} vazio="Nada aqui" />);
    expect(screen.getByText("Nada aqui")).toBeInTheDocument();
  });

  it("lixeira só no que o usuário pode apagar; sem onExcluir, em nenhum", () => {
    const { rerender } = render(<ComentariosLista comentarios={comentarios} pessoas={[]} onExcluir={vi.fn()} />);
    expect(screen.getByText("apagar-c1")).toBeInTheDocument();
    expect(screen.queryByText("apagar-c2")).not.toBeInTheDocument();
    rerender(<ComentariosLista comentarios={comentarios} pessoas={[]} />);
    expect(screen.queryByText("apagar-c1")).not.toBeInTheDocument();
  });

  it("com entidade, apaga a notificação depois de gravar a exclusão", async () => {
    const ordem: string[] = [];
    const onExcluir = vi.fn(async () => void ordem.push("gravou"));
    apagarNotificacoesComentario.mockImplementation(async () => void ordem.push("notificacao"));
    render(
      <ComentariosLista
        comentarios={comentarios}
        pessoas={[]}
        onExcluir={onExcluir}
        entidade={{ tipo: "disciplina", id: "d1" }}
      />
    );
    fireEvent.click(screen.getByText("apagar-c1"));
    await waitFor(() => expect(apagarNotificacoesComentario).toHaveBeenCalledWith("disciplina", "d1", "c1"));
    expect(ordem).toEqual(["gravou", "notificacao"]);
  });

  it("sem entidade não mexe em notificação", async () => {
    const onExcluir = vi.fn();
    render(<ComentariosLista comentarios={comentarios} pessoas={[]} onExcluir={onExcluir} />);
    fireEvent.click(screen.getByText("apagar-c1"));
    await waitFor(() => expect(onExcluir).toHaveBeenCalledWith("c1"));
    expect(apagarNotificacoesComentario).not.toHaveBeenCalled();
  });
});
