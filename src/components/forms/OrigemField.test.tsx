import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OrigemField } from "./OrigemField";

// Select do Radix não abre no jsdom; um <select> nativo exercita a mesma lógica.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
    children: ReactNode;
  }) => (
    <select aria-label="Origem" value={value} disabled={disabled} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">Selecione...</option>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

function Controlado({ inicial = "", onChange }: { inicial?: string; onChange?: (v: string) => void }) {
  const [v, setV] = useState(inicial);
  return (
    <>
      <OrigemField
        id="origem"
        value={v}
        onChange={(n) => {
          setV(n);
          onChange?.(n);
        }}
      />
      <span data-testid="valor">{v}</span>
    </>
  );
}

describe("OrigemField", () => {
  it("opção conhecida grava o próprio texto", () => {
    render(<Controlado />);
    fireEvent.change(screen.getByLabelText("Origem"), { target: { value: "Instagram" } });
    expect(screen.getByTestId("valor")).toHaveTextContent("Instagram");
    expect(screen.queryByLabelText("Origem (outro)")).not.toBeInTheDocument();
  });

  it("'Outro' sem texto ainda abre o campo livre e grava o texto digitado", () => {
    render(<Controlado />);
    fireEvent.change(screen.getByLabelText("Origem"), { target: { value: "Outro" } });
    const livre = screen.getByLabelText("Origem (outro)");
    fireEvent.change(livre, { target: { value: "Feira de engenharia" } });
    expect(screen.getByTestId("valor")).toHaveTextContent("Feira de engenharia");
    expect(screen.getByLabelText("Origem")).toHaveValue("Outro");
  });

  it("valor fora da lista abre em 'Outro' com o texto", () => {
    render(<Controlado inicial="Parceiro antigo" />);
    expect(screen.getByLabelText("Origem")).toHaveValue("Outro");
    expect(screen.getByLabelText("Origem (outro)")).toHaveValue("Parceiro antigo");
    fireEvent.change(screen.getByLabelText("Origem"), { target: { value: "Site" } });
    expect(screen.queryByLabelText("Origem (outro)")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Origem"), { target: { value: "Outro" } });
    expect(screen.getByLabelText("Origem (outro)")).toBeInTheDocument();
  });

  it("valor limpo de fora zera a escolha", () => {
    const { rerender } = render(<OrigemField id="o" value="Google" onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText("Origem")).toHaveValue("Google");
    expect(screen.getByLabelText("Origem")).toBeDisabled();
    rerender(<OrigemField id="o" value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Origem")).toHaveValue("");
  });
});
