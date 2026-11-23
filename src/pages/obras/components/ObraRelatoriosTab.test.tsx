import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake } from "@/pages/obras/testing/supabaseFake";

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
vi.mock("./RelatorioClienteDialog", () => ({ RelatorioClienteDialog: () => <div>financeiro aberto</div> }));

import { ObraRelatoriosTab } from "./ObraRelatoriosTab";

const rdos = [
  { id: "r-1", obra_id: "o-1", data: "2026-11-18", atividades: "Laje do segundo piso", clima: null },
  { id: "r-2", obra_id: "o-1", data: "2026-01-05", atividades: "Fundação", clima: null },
];

function montar(props: { financeiro?: boolean; diario?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  render(
    <ObraRelatoriosTab
      obraId="o-1"
      obraNome="Casa Alfa"
      mostrarFinanceiro={props.financeiro ?? true}
      mostrarDiario={props.diario ?? true}
    />,
    { wrapper: Wrapper }
  );
}

describe("ObraRelatoriosTab", () => {
  beforeEach(() => {
    fake.reset();
    fake.responder((c) => (c.tabela === "obra_rdo" && c.op === "select" ? { data: rdos, error: null } : undefined));
  });

  it("mostra só os relatórios a que a pessoa tem acesso", () => {
    montar({ financeiro: false });
    expect(screen.queryByText("Prestação de contas")).not.toBeInTheDocument();
    expect(screen.getByText("Diário por período")).toBeInTheDocument();
  });

  it("abre a prestação de contas", () => {
    montar({ diario: false });
    fireEvent.click(screen.getByRole("button", { name: "Abrir relatório" }));
    expect(screen.getByText("financeiro aberto")).toBeInTheDocument();
  });

  it("conta os dias do período, avisa período inválido e abre o diário", async () => {
    montar({ financeiro: false });
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-11-30" } });
    expect(await screen.findByText("1 dia registrado no período.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-10-01" } });
    expect(screen.getByText("Escolha um período válido.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir relatório" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-11-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Abrir relatório" }));
    expect(await screen.findByText("Laje do segundo piso")).toBeInTheDocument();
    expect(screen.queryByText("Fundação")).not.toBeInTheDocument();
  });
});
