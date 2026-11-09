import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EtiquetasCell, HorasCell, PrazoCell, PrioridadeCell, ProjetoCell, ResponsavelCell } from "./CelulasLista";

/**
 * Células editáveis da lista de Tarefas: modo leitura (disciplina, sem
 * permissão), edição inline e validação de horas. O clique numa célula não
 * pode abrir a linha (stopPropagation).
 */

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const PESSOAS = [
  { id: "pe1", nome: "Rita" },
  { id: "pe2", nome: "Davi" },
];

/** Renderiza dentro de uma "linha" clicável para provar que o clique não vaza. */
function naLinha(ui: React.ReactNode) {
  const onLinha = vi.fn();
  render(<div onClick={onLinha}>{ui}</div>);
  return { onLinha, user: userEvent.setup() };
}

describe("ResponsavelCell", () => {
  it("leitura: nome, contagem ou traço", () => {
    const { rerender } = render(
      <ResponsavelCell responsaveis={[]} pessoas={PESSOAS} editavel={false} onChange={vi.fn()} />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    rerender(<ResponsavelCell responsaveis={PESSOAS} pessoas={PESSOAS} editavel={false} onChange={vi.fn()} />);
    expect(screen.getByText("2 responsáveis")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("marca e desmarca pessoas sem abrir a linha", async () => {
    const onChange = vi.fn();
    const { onLinha, user } = naLinha(
      <ResponsavelCell responsaveis={[PESSOAS[0]]} pessoas={PESSOAS} editavel onChange={onChange} />
    );
    await user.click(screen.getByRole("button", { name: /Rita/ }));
    await user.click(await screen.findByRole("option", { name: /Davi/ }));
    expect(onChange).toHaveBeenLastCalledWith(["pe1", "pe2"]);
    await user.click(screen.getByRole("option", { name: /Rita/ }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(onLinha).not.toHaveBeenCalled();
  });

  it("sem responsável e editável convida a atribuir", () => {
    render(<ResponsavelCell responsaveis={[]} pessoas={PESSOAS} editavel onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Atribuir/ })).toBeInTheDocument();
  });
});

describe("PrazoCell", () => {
  it("rótulos relativos: hoje, amanhã, ontem e data de outro ano", () => {
    const iso = (dias: number) => {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const { rerender } = render(<PrazoCell prazo={iso(0)} atrasado={false} editavel={false} onChange={vi.fn()} />);
    expect(screen.getByText("Hoje")).toBeInTheDocument();
    rerender(<PrazoCell prazo={iso(1)} atrasado={false} editavel={false} onChange={vi.fn()} />);
    expect(screen.getByText("Amanhã")).toBeInTheDocument();
    rerender(<PrazoCell prazo={iso(-1)} atrasado editavel={false} onChange={vi.fn()} />);
    expect(screen.getByText("Ontem")).toHaveClass("text-destructive");
    rerender(<PrazoCell prazo="2020-02-12" atrasado editavel={false} onChange={vi.fn()} />);
    expect(screen.getByText(/12 fev 2020/)).toBeInTheDocument();
  });

  it("prazo inválido ou vazio: traço na leitura e convite na edição", () => {
    const { rerender } = render(<PrazoCell prazo="lixo" atrasado={false} editavel={false} onChange={vi.fn()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    rerender(<PrazoCell prazo={null} atrasado={false} editavel onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Prazo/ })).toBeInTheDocument();
  });

  it("escolhe um dia no calendário e limpa o prazo", async () => {
    const onChange = vi.fn();
    const { onLinha, user } = naLinha(<PrazoCell prazo="2030-03-10" atrasado={false} editavel onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /10 mar/ }));
    const grade = await screen.findByRole("grid");
    await user.click(within(grade).getByText("15"));
    expect(onChange).toHaveBeenCalledWith("2030-03-15");
    await user.click(screen.getByRole("button", { name: /10 mar/ }));
    await user.click(await screen.findByRole("button", { name: "Limpar prazo" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(onLinha).not.toHaveBeenCalled();
  });
});

describe("PrioridadeCell", () => {
  it("leitura mostra o rótulo; edição troca pelo menu", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<PrioridadeCell prioridade="baixa" editavel={false} onChange={onChange} />);
    expect(screen.getByText("Baixa")).toBeInTheDocument();
    expect(screen.queryByTitle("Mudar prioridade")).not.toBeInTheDocument();
    rerender(<PrioridadeCell prioridade="alta" editavel onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByTitle("Mudar prioridade"));
    await user.click(await screen.findByRole("menuitem", { name: "Média" }));
    expect(onChange).toHaveBeenCalledWith("media");
  });
});

describe("ProjetoCell", () => {
  const PROJETOS = [{ id: "p1", nome: "Casa Ipê" }];

  it("leitura sem projeto mostra traço", () => {
    render(<ProjetoCell projetoId={null} projetoNome={null} projetos={PROJETOS} editavel={false} onChange={vi.fn()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("vincula e desvincula projeto", async () => {
    const onChange = vi.fn();
    const { user } = naLinha(
      <ProjetoCell projetoId={null} projetoNome={null} projetos={PROJETOS} editavel onChange={onChange} />
    );
    await user.click(screen.getByRole("button", { name: /Projeto/ }));
    await user.click(await screen.findByRole("option", { name: /Casa Ipê/ }));
    expect(onChange).toHaveBeenCalledWith("p1");
    await user.click(screen.getByRole("button", { name: /Projeto/ }));
    await user.click(await screen.findByRole("option", { name: "Sem projeto" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe("EtiquetasCell", () => {
  it("mostra até duas e o excedente; sem etiqueta em leitura é traço", () => {
    const { rerender } = render(<EtiquetasCell labels={["a", "b", "c"]} editavel={false} onChange={vi.fn()} />);
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByText("c")).not.toBeInTheDocument();
    rerender(<EtiquetasCell labels={[]} editavel={false} onChange={vi.fn()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("editável abre o editor de etiquetas", async () => {
    const { user } = naLinha(<EtiquetasCell labels={[]} editavel onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Etiqueta/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

describe("HorasCell", () => {
  it("leitura sem valor é traço", () => {
    render(<HorasCell valor={null} editavel={false} onChange={vi.fn()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("aceita vírgula decimal e arredonda ao salvar", async () => {
    const onChange = vi.fn();
    const { user } = naLinha(<HorasCell valor={null} editavel onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    const campo = await screen.findByRole("spinbutton");
    fireEvent.change(campo, { target: { value: "1.23456" } });
    fireEvent.blur(campo);
    expect(onChange).toHaveBeenCalledWith(1.235);
  });

  it("valor negativo ou igual ao atual não grava", async () => {
    const onChange = vi.fn();
    const { user } = naLinha(<HorasCell valor={2} editavel onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    const campo = await screen.findByRole("spinbutton");
    expect(campo).toHaveValue(2);
    fireEvent.blur(campo);
    fireEvent.change(campo, { target: { value: "-1" } });
    fireEvent.blur(campo);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("limpar zera as horas", async () => {
    const onChange = vi.fn();
    const { user } = naLinha(<HorasCell valor={1.5} editavel onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("button", { name: "Limpar" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
