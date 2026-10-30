import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PendenciasTab } from "./PendenciasTab";

const usePendencias = vi.fn();
const useHeartbeat = vi.fn();
const useSemOrcamento = vi.fn();

vi.mock("@/hooks/useEscopos", () => ({
  usePendenciasAgentes: () => usePendencias(),
  useAprovarEscopo: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRejeitarEscopo: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdiarEscopo: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/useFeatureAccess", () => ({ useFeatureAccess: () => ({ canEdit: true }) }));
vi.mock("@/pages/chat/hooks/useAgentHeartbeat", () => ({ useAgentHeartbeat: () => useHeartbeat() }));
vi.mock("@/pages/chat/hooks/useAgentePendencias", () => ({ usePendenciasOrcamentoAusente: () => useSemOrcamento() }));

const montar = () =>
  render(
    <MemoryRouter>
      <PendenciasTab />
    </MemoryRouter>
  );

describe("PendenciasTab: guardião sem orçamento para vigiar", () => {
  beforeEach(() => {
    usePendencias.mockReturnValue({ isLoading: false, data: [] });
    useHeartbeat.mockReturnValue({
      isLoading: false,
      data: { last_run_at: new Date().toISOString(), last_status: "ok", detail: { encontrados: 0, criados: 0 } },
    });
  });

  it("explica que a verificação sem achados vem de projetos sem orçamento e leva ao projeto", () => {
    useSemOrcamento.mockReturnValue({ data: { total: 21, primeiroProjetoId: "p1" } });
    montar();
    expect(screen.getByText(/21 projetos em andamento estão sem orçamento por disciplina/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Definir orçamento/ })).toHaveAttribute("href", "/projetos/p1#escopo");
  });

  it("usa o singular com um projeto", () => {
    useSemOrcamento.mockReturnValue({ data: { total: 1, primeiroProjetoId: "p1" } });
    montar();
    expect(screen.getByText(/1 projeto em andamento está sem orçamento por disciplina/)).toBeInTheDocument();
  });

  it("não mostra o aviso quando todo projeto tem orçamento", () => {
    useSemOrcamento.mockReturnValue({ data: { total: 0, primeiroProjetoId: null } });
    montar();
    expect(screen.queryByText(/sem orçamento por disciplina/)).not.toBeInTheDocument();
  });
});
