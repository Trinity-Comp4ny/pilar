import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValoresOcultosProvider } from "@/contexts/ValoresOcultosContext";
import { LeadsKPIsResumo } from "./LeadsKPIs";
import type { Lead } from "@/hooks/useLeads";

const lead = { id: "l1", status: "Novo", valor_estimado: 50000, previsao_fechamento: null } as unknown as Lead;

describe("LeadsKPIsResumo", () => {
  afterEach(() => localStorage.clear());

  it("mostra o valor no funil", () => {
    render(<LeadsKPIsResumo leads={[lead]} propostasByLead={new Map()} />);
    expect(screen.getByText(/no funil/)).toHaveTextContent("R$");
    expect(screen.getByText(/no funil/)).not.toHaveTextContent("••••");
  });

  it("com 'ocultar valores' ligado, mascara o valor como os cards", () => {
    localStorage.setItem("pilar:valores-ocultos", "1");
    render(
      <ValoresOcultosProvider>
        <LeadsKPIsResumo leads={[lead]} propostasByLead={new Map()} />
      </ValoresOcultosProvider>
    );
    expect(screen.getByText(/no funil/)).toHaveTextContent("R$ •••• no funil");
  });
});
