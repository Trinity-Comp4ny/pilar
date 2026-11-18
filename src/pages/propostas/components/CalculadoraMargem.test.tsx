import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CalculadoraMargem, simulacaoInicial } from "./CalculadoraMargem";
import { CONFIG_COMERCIAL_PADRAO, type ConfigComercial } from "../hooks/useConfigComercial";

const config: ConfigComercial = {
  ...CONFIG_COMERCIAL_PADRAO,
  aliquotaImpostoPct: 6,
  margemAlvoPct: 30,
  margemMinimaPct: 15,
};

const renderCalc = (over: Partial<React.ComponentProps<typeof CalculadoraMargem>> = {}) => {
  const props = {
    custo: 7000,
    precoTabela: 10000,
    config,
    value: simulacaoInicial(config),
    onChange: vi.fn(),
    onAplicarPreco: vi.fn(),
    onSalvarPadrao: vi.fn(),
    ...over,
  };
  render(<CalculadoraMargem {...props} />);
  return props;
};

describe("CalculadoraMargem", () => {
  it("mostra margem líquida e semáforo", () => {
    renderCalc();
    // 1 - 0,7 - 0,06 = 24%: acima do mínimo, abaixo do alvo
    expect(screen.getByText(/Margem apertada: 24,0%/)).toBeInTheDocument();
  });

  it("aplica o preço sugerido só por ação explícita", () => {
    const props = renderCalc();
    expect(props.onAplicarPreco).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Usar este valor" }));
    expect(props.onAplicarPreco).toHaveBeenCalledWith(10937.5);
  });

  it("sem custo, orienta em vez de calcular", () => {
    renderCalc({ custo: 0 });
    expect(screen.getByText(/Informe horas e custo\/hora/)).toBeInTheDocument();
  });

  it("avisa quando margem, imposto e taxa fecham 100%", () => {
    renderCalc({ value: { ...simulacaoInicial(config), margemAlvoPct: 95 } });
    expect(screen.getByText(/não existe preço que feche a conta/)).toBeInTheDocument();
  });
});
