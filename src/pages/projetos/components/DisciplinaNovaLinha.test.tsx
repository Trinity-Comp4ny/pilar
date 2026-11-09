import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { Table, TableBody } from "@/components/ui/table";
import { DisciplinaNovaLinha } from "./DisciplinaNovaLinha";

function Harness({ onAdd, onCancel }: { onAdd: () => void; onCancel: () => void }) {
  const [value, setValue] = useState({ disciplina: "", responsavel_id: "" });
  return (
    <Table>
      <TableBody>
        <DisciplinaNovaLinha
          value={value}
          onChange={(fn) => setValue(fn)}
          disciplinasCatalog={[{ id: "c1", nome: "Estrutural" }]}
          pessoas={[{ id: "p1", nome: "Ana" }]}
          onAdd={onAdd}
          onCancel={onCancel}
        />
      </TableBody>
    </Table>
  );
}

describe("DisciplinaNovaLinha", () => {
  it("só habilita adicionar com disciplina e responsável escolhidos", () => {
    const onAdd = vi.fn();
    const onCancel = vi.fn();
    render(<Harness onAdd={onAdd} onCancel={onCancel} />);
    const adicionar = screen.getByRole("button", { name: "Adicionar disciplina" });
    expect(adicionar).toBeDisabled();

    const [disc, resp] = screen.getAllByRole("combobox");
    fireEvent.keyDown(disc, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Estrutural" }));
    expect(adicionar).toBeDisabled();

    fireEvent.keyDown(resp, { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Ana" }));
    expect(adicionar).toBeEnabled();

    fireEvent.click(adicionar);
    expect(onAdd).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
