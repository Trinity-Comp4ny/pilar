import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { KanbanCard } from "./KanbanCard";
import { KanbanDraggable } from "./KanbanColumn";

function Quadro({ onAbrir }: { onAbrir: () => void }) {
  return (
    <DragDropContext onDragEnd={() => undefined}>
      <Droppable droppableId="coluna">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            <KanbanDraggable id="card-1" index={0}>
              {(isDragging) => <KanbanCard title="Revisar memorial" isDragging={isDragging} onClick={onAbrir} />}
            </KanbanDraggable>
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

const arrastar = (alvo: Element) => {
  fireEvent.mouseDown(alvo, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.mouseMove(window, { button: 0, clientX: 10, clientY: 40 });
};

describe("KanbanDraggable", () => {
  // Feedback da VRZ (17/10): "não consigo mover as tarefas". O título do card é um <button>
  // que ocupa a largura toda, e o dnd não inicia arraste a partir de elemento interativo.
  it("arrasta o card segurando pelo título", () => {
    render(<Quadro onAbrir={vi.fn()} />);
    arrastar(screen.getByRole("button", { name: "Revisar memorial" }));
    expect(document.querySelector(".rotate-1")).not.toBeNull();
  });

  it("clicar no título, sem arrastar, ainda abre o card", () => {
    const onAbrir = vi.fn();
    render(<Quadro onAbrir={onAbrir} />);
    const titulo = screen.getByRole("button", { name: "Revisar memorial" });
    fireEvent.mouseDown(titulo, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseUp(titulo, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.click(titulo);
    expect(onAbrir).toHaveBeenCalledTimes(1);
  });
});
