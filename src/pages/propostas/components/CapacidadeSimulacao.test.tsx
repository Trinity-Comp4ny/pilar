import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// Simulação de capacidade da proposta: cruza as disciplinas pedidas com quem
// já atua nelas (projetos_responsaveis) e as horas semanais de cada pessoa.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));

import { CapacidadeSimulacao } from "./CapacidadeSimulacao";

function renderizar(disciplinas: Array<{ disciplina: string; horas_estimadas: number }>, prazo?: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CapacidadeSimulacao disciplinas={disciplinas} prazoEstimadoDias={prazo} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  sb.reset();
  sb.resultado("pessoas.select", {
    data: [
      { id: "p1", nome: "Ana", cargo: "Eng. Estrutural", horas_semanais: 40 },
      { id: "p2", nome: "Bruno", cargo: null, horas_semanais: null },
      { id: "p3", nome: "Carla", cargo: "Eletricista", horas_semanais: 10 },
    ],
    error: null,
  });
  sb.resultado("projetos_responsaveis.select", {
    data: [
      { pessoa_id: "p1", disciplina: "Estrutural" },
      { pessoa_id: "p2", disciplina: "Estrutural" },
      { pessoa_id: "p3", disciplina: "Elétrico" },
    ],
    error: null,
  });
});

describe("CapacidadeSimulacao", () => {
  it("sem disciplinas não renderiza nada", () => {
    const { container } = renderizar([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("usa 12 semanas sem prazo e arredonda o prazo em dias para cima", async () => {
    const { unmount } = renderizar([{ disciplina: "Estrutural", horas_estimadas: 10 }]);
    expect(screen.getByText("Disponibilidade da equipe nas próximas 12 semanas")).toBeInTheDocument();
    unmount();
    renderizar([{ disciplina: "Estrutural", horas_estimadas: 10 }], 15);
    expect(screen.getByText("Disponibilidade da equipe nas próximas 3 semanas")).toBeInTheDocument();
  });

  it("lista quem atua na disciplina com horas livres (sem horas cadastradas assume 40h)", async () => {
    renderizar([{ disciplina: "Estrutural", horas_estimadas: 100 }], 14);
    expect(await screen.findByText(/Ana/)).toHaveTextContent("Ana (Eng. Estrutural)");
    expect(screen.getByText(/Bruno/)).toBeInTheDocument();
    // 2 semanas x 40h = 80h livres para cada uma
    expect(screen.getAllByText("80h livres")).toHaveLength(2);
    // ninguém absorve 100h em 80h livres: alerta da disciplina
    expect(screen.getByText("Nenhuma pessoa tem capacidade suficiente para absorver 100h")).toBeInTheDocument();
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.queryByText("Carla")).not.toBeInTheDocument();
  });

  it("com capacidade suficiente não alerta", async () => {
    renderizar([{ disciplina: "Elétrico", horas_estimadas: 20 }], 14);
    expect(await screen.findByText(/Carla/)).toHaveClass("text-success-strong");
    expect(screen.getByText("20h livres")).toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
  });

  it("disciplina sem ninguém atribuído avisa", async () => {
    renderizar([{ disciplina: "PPCI", horas_estimadas: 8 }]);
    expect(
      await screen.findByText("Nenhuma pessoa atribuída a esta disciplina em projetos ativos")
    ).toBeInTheDocument();
    expect(screen.getByText("Atenção")).toBeInTheDocument();
  });

  it("erro ao buscar pessoas cai no aviso de disciplina sem pessoa", async () => {
    sb.resultado("pessoas.select", { data: null, error: { message: "permission denied" } });
    renderizar([{ disciplina: "Estrutural", horas_estimadas: 8 }]);
    expect(
      await screen.findByText("Nenhuma pessoa atribuída a esta disciplina em projetos ativos")
    ).toBeInTheDocument();
  });

  it("filtra pessoas excluídas e ordena por nome", async () => {
    renderizar([{ disciplina: "Estrutural", horas_estimadas: 1 }]);
    await screen.findByText(/Ana/);
    expect(sb.de("pessoas", "is")[0].args).toEqual(["deleted_at", null]);
    expect(sb.de("pessoas", "order")[0].args).toEqual(["nome"]);
  });
});
