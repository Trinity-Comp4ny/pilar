import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DollarSign } from "lucide-react";
import { KPICard } from "./KPICard";

// Smoke test de render (spec #45): o card de indicador é a peça mais reusada das
// telas de dinheiro. Aqui só se garante que ele renderiza com props mínimas, formata
// número como moeda e respeita o estado de loading, sem mock de dados.
describe("KPICard", () => {
  it("renderiza label e formata value numérico como moeda", () => {
    render(<KPICard label="Saldo" value={1234.5} icon={DollarSign} />);
    expect(screen.getByText("Saldo")).toBeInTheDocument();
    expect(screen.getByText(/R\$/)).toBeInTheDocument();
  });

  it("exibe value string sem formatar", () => {
    render(<KPICard label="Projetos" value="12 ativos" />);
    expect(screen.getByText("12 ativos")).toBeInTheDocument();
  });

  it("em loading não mostra o valor nem o subtitle", () => {
    render(<KPICard label="A receber" value={999} subtitle="não deveria aparecer" loading />);
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
    expect(screen.queryByText("não deveria aparecer")).not.toBeInTheDocument();
  });

  it("com onClick vira botão acessível e dispara ao clicar", async () => {
    const onClick = vi.fn();
    render(<KPICard label="Vencido" value={0} onClick={onClick} />);
    const card = screen.getByRole("button");
    await userEvent.click(card);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
