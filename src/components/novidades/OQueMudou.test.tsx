import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OQueMudou } from "./OQueMudou";

const h = vi.hoisted(() => ({
  comFluxo: [] as unknown[],
  marcar: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/hooks/useNovidades", () => ({
  useNovidades: () => ({ pendentes: { comFluxo: h.comFluxo, temDestaque: h.comFluxo.length > 0 } }),
  useMarcarNovidadesVistas: () => ({ mutate: h.marcar }),
}));
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => h.navigate,
}));

const release = {
  id: "r1",
  sha: "abc1234",
  titulo: "Atualização",
  versao: null,
  publicada_em: "2026-11-10T12:00:00Z",
  nova: true,
  itens: [
    { id: "a", texto: "A fatura agora sai de dentro do projeto", impacto: "fluxo", modulo: null, voce_pediu: true },
    { id: "b", texto: "Exporta em Excel", impacto: "melhoria", modulo: null, voce_pediu: false },
  ],
};

function montar(rota = "/inicio") {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <OQueMudou />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.comFluxo = [];
});

describe("OQueMudou (SPEC 152)", () => {
  it("não abre sem mudança de fluxo nova", () => {
    montar();
    expect(screen.queryByText("O que mudou no Pilar")).not.toBeInTheDocument();
  });

  it("mostra só as mudanças de fluxo, com o selo de quem pediu, e marca como visto ao fechar", async () => {
    h.comFluxo = [release];
    const user = userEvent.setup();
    montar();
    expect(screen.getByText("O que mudou no Pilar")).toBeInTheDocument();
    expect(screen.getByText("A fatura agora sai de dentro do projeto")).toBeInTheDocument();
    expect(screen.getByText("Você pediu")).toBeInTheDocument();
    expect(screen.queryByText("Exporta em Excel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Entendi" }));
    expect(h.marcar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("O que mudou no Pilar")).not.toBeInTheDocument();
  });

  it("leva às outras novidades", async () => {
    h.comFluxo = [release];
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Ver mais 1 novidade" }));
    expect(h.marcar).toHaveBeenCalled();
    expect(h.navigate).toHaveBeenCalledWith("/novidades");
  });

  it("não abre em cima da própria página de Novidades", () => {
    h.comFluxo = [release];
    montar("/novidades");
    expect(screen.queryByText("O que mudou no Pilar")).not.toBeInTheDocument();
  });
});
