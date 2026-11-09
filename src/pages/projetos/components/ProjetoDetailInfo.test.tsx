import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Projeto } from "@/types/projetos";

vi.mock("@/hooks/useMoneyMask", () => ({ useMoneyMask: () => (v: number) => `R$ ${v}` }));
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({ value, onChange, minDate }: { value?: string; onChange: (v: string) => void; minDate?: string }) => (
    <input aria-label="Prazo" data-min={minDate ?? ""} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { ProjetoDetailInfo } from "./ProjetoDetailInfo";

// Cabeçalho do projeto: KPIs (cliente, contrato, área, prazo, margem) editáveis
// no lugar quando há permissão, com commit no blur/Enter só se o valor mudou.

const projeto = (p: Partial<Projeto> = {}) =>
  ({
    id: "p1",
    nome: "Aurora",
    cliente_nome: "Construtora",
    valor_contrato: 1000,
    area_m2: 120,
    data_inicio: "2026-01-01",
    data_previsao: "2026-06-30",
    ...p,
  }) as Projeto;

describe("ProjetoDetailInfo", () => {
  it("somente leitura: mostra os valores e a margem", () => {
    render(
      <ProjetoDetailInfo
        projeto={projeto({ cliente_nome: undefined, area_m2: undefined })}
        progress={40}
        margemBrutaPct={-3}
      />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("R$ 1000")).toBeInTheDocument();
    expect(screen.getByText("0 m²")).toBeInTheDocument();
    expect(screen.getByText("-3.0%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Contrato" })).not.toBeInTheDocument();
  });

  it.each([
    [null, "—"],
    [25, "25.0%"],
    [5, "5.0%"],
  ])("margem %s vira %s", (margem, texto) => {
    render(<ProjetoDetailInfo projeto={projeto()} progress={0} margemBrutaPct={margem} />);
    expect(screen.getAllByText(texto).length).toBeGreaterThan(0);
  });

  it("edita contrato, área e prazo; só grava quando muda", () => {
    const onUpdateContrato = vi.fn();
    const onUpdateArea = vi.fn();
    const onUpdatePrazo = vi.fn();
    render(
      <ProjetoDetailInfo
        projeto={projeto()}
        progress={0}
        margemBrutaPct={null}
        canEdit
        onUpdateContrato={onUpdateContrato}
        onUpdateArea={onUpdateArea}
        onUpdatePrazo={onUpdatePrazo}
      />
    );
    const contrato = screen.getByRole("textbox", { name: "Contrato" });
    fireEvent.blur(contrato);
    expect(onUpdateContrato).not.toHaveBeenCalled();
    fireEvent.change(contrato, { target: { value: "2.500,00" } });
    fireEvent.keyDown(contrato, { key: "a" });
    fireEvent.keyDown(contrato, { key: "Enter" });
    fireEvent.blur(contrato);
    expect(onUpdateContrato).toHaveBeenCalledWith(2500);

    const area = screen.getByRole("textbox", { name: "Área" });
    fireEvent.blur(area);
    expect(onUpdateArea).not.toHaveBeenCalled();
    fireEvent.change(area, { target: { value: "150,5" } });
    fireEvent.keyDown(area, { key: "x" });
    fireEvent.keyDown(area, { key: "Enter" });
    fireEvent.blur(area);
    expect(onUpdateArea).toHaveBeenCalledWith(150.5);

    const prazo = screen.getByLabelText("Prazo");
    expect(prazo).toHaveAttribute("data-min", "2026-01-01");
    fireEvent.change(prazo, { target: { value: "2026-07-31" } });
    expect(onUpdatePrazo).toHaveBeenCalledWith("2026-07-31");
  });

  it("área vazia vira zero; projeto sem área e sem datas", () => {
    const onUpdateArea = vi.fn();
    render(
      <ProjetoDetailInfo
        projeto={projeto({ area_m2: undefined, data_inicio: undefined, data_previsao: undefined })}
        progress={0}
        margemBrutaPct={null}
        canEdit
        onUpdateArea={onUpdateArea}
        onUpdatePrazo={vi.fn()}
      />
    );
    const area = screen.getByRole("textbox", { name: "Área" });
    fireEvent.change(area, { target: { value: "abc" } });
    fireEvent.blur(area);
    expect(onUpdateArea).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Prazo")).toHaveAttribute("data-min", "");
  });

  it("valor e área que mudam por fora resincronizam os campos", () => {
    const props = {
      progress: 0,
      margemBrutaPct: null,
      canEdit: true,
      onUpdateContrato: vi.fn(),
      onUpdateArea: vi.fn(),
    };
    const { rerender } = render(<ProjetoDetailInfo projeto={projeto()} {...props} />);
    rerender(<ProjetoDetailInfo projeto={projeto({ valor_contrato: 3000, area_m2: 0 })} {...props} />);
    expect((screen.getByRole("textbox", { name: "Contrato" }) as HTMLInputElement).value).toMatch(/3\.000,00$/);
    expect(screen.getByRole("textbox", { name: "Área" })).toHaveValue("");
  });
});
