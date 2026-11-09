import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { labelForPreset, rangeForPreset } from "@/lib/periodo";
import { FiltroPeriodo } from "./FiltroPeriodo";
import { MultiSelectFilter } from "./MultiSelectFilter";

// Select do Radix não abre no jsdom; o cabeçalho do calendário vira <select> nativo.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: ReactNode;
  }) => (
    <select data-testid="caption-select" value={value} onChange={(e) => onValueChange(e.target.value)}>
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

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= vi.fn();
});

describe("MultiSelectFilter", () => {
  const OPCOES = [
    { value: "a", label: "Ana" },
    { value: "b", label: "Bruno" },
  ];

  it("rótulo reflete a seleção e alterna itens", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <MultiSelectFilter label="Responsável" options={OPCOES} selected={[]} onChange={onChange} />
    );
    expect(screen.getByRole("button", { name: /Responsável/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Responsável/ }));
    await user.click(await screen.findByText("Bruno"));
    expect(onChange).toHaveBeenLastCalledWith(["b"]);

    rerender(<MultiSelectFilter label="Responsável" options={OPCOES} selected={["b"]} onChange={onChange} />);
    expect(screen.getByText("Responsável: Bruno")).toBeInTheDocument();
    await user.click(screen.getByText("Bruno", { selector: "[cmdk-item] span" }));
    expect(onChange).toHaveBeenLastCalledWith([]);

    rerender(<MultiSelectFilter label="Responsável" options={OPCOES} selected={["a", "b"]} onChange={onChange} />);
    expect(screen.getByText("Responsável (2)")).toBeInTheDocument();
  });

  it("limpar por clique ou teclado zera a seleção", () => {
    const onChange = vi.fn();
    render(<MultiSelectFilter label="Status" options={OPCOES} selected={["a"]} onChange={onChange} />);
    const limpar = screen.getByRole("button", { name: "Limpar" });
    fireEvent.keyDown(limpar, { key: "a" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(limpar, { key: "Enter" });
    fireEvent.keyDown(limpar, { key: " " });
    fireEvent.click(limpar);
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("FiltroPeriodo", () => {
  it("aplica preset e fecha", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const r = rangeForPreset("mes-atual");
    render(<FiltroPeriodo from={r.from} to={r.to} onChange={onChange} footer={<span>rodapé</span>} active />);
    await user.click(screen.getByRole("button", { name: labelForPreset("mes-atual") }));
    expect(await screen.findByText("rodapé")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: labelForPreset("este-ano") }));
    const ano = rangeForPreset("este-ano");
    expect(onChange).toHaveBeenCalledWith(ano.from, ano.to);
    expect(screen.queryByText("rodapé")).not.toBeInTheDocument();
  });

  it("intervalo personalizado mostra datas e abre direto no calendário", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FiltroPeriodo
        from={new Date(2026, 0, 5)}
        to={new Date(2026, 0, 20)}
        onChange={onChange}
        fromYear={2025}
        toYear={2026}
      />
    );
    await user.click(screen.getByRole("button", { name: "05/01/26 – 20/01/26" }));
    expect(await screen.findByText("Voltar aos períodos")).toBeInTheDocument();
    const [mes, ano] = screen.getAllByTestId("caption-select") as HTMLSelectElement[];
    expect(mes.value).toBe("0");
    expect(ano.value).toBe("2026");
    expect(Array.from(ano.options).map((o) => o.value)).toEqual(["2026", "2025"]);

    // navegação do cabeçalho
    fireEvent.change(mes, { target: { value: "5" } });
    expect((screen.getAllByTestId("caption-select")[0] as HTMLSelectElement).value).toBe("5");
    fireEvent.change(screen.getAllByTestId("caption-select")[1], { target: { value: "2025" } });
    expect((screen.getAllByTestId("caption-select")[1] as HTMLSelectElement).value).toBe("2025");
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect((screen.getAllByTestId("caption-select")[0] as HTMLSelectElement).value).toBe("6");
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect((screen.getAllByTestId("caption-select")[0] as HTMLSelectElement).value).toBe("5");

    // limites da faixa de anos travam as setas
    fireEvent.change(screen.getAllByTestId("caption-select")[0], { target: { value: "0" } });
    expect(screen.getByRole("button", { name: "Mês anterior" })).toBeDisabled();
    fireEvent.change(screen.getAllByTestId("caption-select")[1], { target: { value: "2026" } });
    fireEvent.change(screen.getAllByTestId("caption-select")[0], { target: { value: "11" } });
    expect(screen.getByRole("button", { name: "Próximo mês" })).toBeDisabled();

    await user.click(screen.getByText("Voltar aos períodos"));
    expect(screen.getByRole("button", { name: labelForPreset("tudo") })).toBeInTheDocument();
  });

  it("'Personalizado' começa seleção limpa e aplica ao clicar no dia", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FiltroPeriodo from={undefined} to={undefined} onChange={onChange} presets={["tudo", "custom"]} />);
    await user.click(screen.getByRole("button", { name: labelForPreset("tudo") }));
    await user.click(screen.getByRole("button", { name: labelForPreset("custom") }));
    expect(await screen.findByText("Voltar aos períodos")).toBeInTheDocument();
    const dias = screen.getAllByRole("gridcell").filter((c) => c.textContent === "10");
    await user.click(dias[0].querySelector("button") ?? dias[0]);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toBeInstanceOf(Date);
  });

  it("intervalo só com início é 'Personalizado'", () => {
    render(<FiltroPeriodo from={new Date(2026, 0, 1)} to={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Personalizado" })).toBeInTheDocument();
  });
});
