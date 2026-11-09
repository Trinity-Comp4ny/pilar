import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EquipeTokensSection } from "./EquipeTokensSection";

const h = vi.hoisted(() => ({
  membros: [] as unknown[],
  solicitacoes: [] as unknown[],
  definir: { mutate: vi.fn(), isPending: false },
  resolver: { mutate: vi.fn(), isPending: false },
}));

vi.mock("../useUsoEquipe", () => ({
  useUsoEquipe: () => ({
    membros: h.membros,
    isLoadingMembros: false,
    errorMembros: null,
    solicitacoes: h.solicitacoes,
    definirLimite: h.definir,
    resolverSolicitacao: h.resolver,
  }),
}));

const ANA = {
  userId: "a",
  nome: "Ana Seed",
  role: "user",
  tokensCiclo: 25000,
  limiteMensal: 50000,
  solicitacaoPendente: false,
};
const BRUNO = { ...ANA, userId: "b", nome: "Bruno Seed", tokensCiclo: 0, limiteMensal: null };

beforeEach(() => {
  vi.clearAllMocks();
  h.membros = [ANA, BRUNO];
  h.solicitacoes = [];
});

describe("EquipeTokensSection", () => {
  it("lista consumo e limites", () => {
    render(<EquipeTokensSection />);
    expect(screen.getAllByText("Ana Seed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10 créditos / mês").length).toBeGreaterThan(0);
    expect(screen.getAllByText("sem limite").length).toBeGreaterThan(0);
    expect(screen.queryByText("Pedidos pendentes")).not.toBeInTheDocument();
  });

  it("edita o limite em créditos e grava em tokens", async () => {
    const user = userEvent.setup();
    render(<EquipeTokensSection />);
    await user.click(screen.getAllByText("10 créditos / mês")[0]);
    const input = screen.getByPlaceholderText("ex: 100 créditos");
    expect(input).toHaveValue(10);
    await user.clear(input);
    const salvar = input.parentElement!.querySelectorAll("button")[0];
    expect(salvar).toBeDisabled();
    await user.type(input, "20");
    await user.click(salvar);
    expect(h.definir.mutate).toHaveBeenCalledWith({ userId: "a", limiteMensal: 100000 });
  });

  it("remove o limite existente", async () => {
    const user = userEvent.setup();
    render(<EquipeTokensSection />);
    await user.click(screen.getAllByText("10 créditos / mês")[0]);
    await user.click(screen.getByTitle("Remover limite"));
    expect(h.definir.mutate).toHaveBeenCalledWith({ userId: "a", limiteMensal: null });
  });

  it("membro sem limite não oferece remover", async () => {
    const user = userEvent.setup();
    render(<EquipeTokensSection />);
    await user.click(screen.getAllByText("sem limite")[0]);
    expect(screen.getByPlaceholderText("ex: 100 créditos")).toHaveValue(null);
    expect(screen.queryByTitle("Remover limite")).not.toBeInTheDocument();
  });

  describe("pedidos pendentes", () => {
    beforeEach(() => {
      h.solicitacoes = [
        {
          id: "s1",
          userId: "b",
          nome: "Bruno Seed",
          mensagem: "preciso para a proposta",
          limiteSugerido: 25000,
          criadaEm: "2026-11-01T10:00:00Z",
        },
        { id: "s2", userId: "c", nome: "Caio", mensagem: null, limiteSugerido: null, criadaEm: "2026-11-02T10:00:00Z" },
      ];
    });

    it("mostra sugestão e mensagem; negar recusa", async () => {
      const user = userEvent.setup();
      render(<EquipeTokensSection />);
      expect(screen.getByText("sugeriu 5 créditos")).toBeInTheDocument();
      expect(screen.getByText('"preciso para a proposta"')).toBeInTheDocument();
      await user.click(screen.getAllByRole("button", { name: "Negar" })[0]);
      expect(h.resolver.mutate).toHaveBeenCalledWith({ solicitacaoId: "s1", aprovar: false });
    });

    it("aprovar com o limite sugerido convertido", async () => {
      const user = userEvent.setup();
      render(<EquipeTokensSection />);
      await user.click(screen.getAllByRole("button", { name: "Aprovar" })[0]);
      expect(screen.getByPlaceholderText("créditos; vazio = sem limite")).toHaveValue(5);
      await user.click(screen.getByRole("button", { name: "Confirmar" }));
      expect(h.resolver.mutate).toHaveBeenCalledWith({ solicitacaoId: "s1", aprovar: true, novoLimite: 25000 });
    });

    it("aprovar sem valor tira o limite; cancelar volta", async () => {
      const user = userEvent.setup();
      render(<EquipeTokensSection />);
      const card = screen.getByText("Caio").closest("div.space-y-2") as HTMLElement;
      await user.click(within(card).getByRole("button", { name: "Aprovar" }));
      await user.click(within(card).getByRole("button", { name: "Cancelar" }));
      await user.click(within(card).getByRole("button", { name: "Aprovar" }));
      await user.click(within(card).getByRole("button", { name: "Confirmar" }));
      expect(h.resolver.mutate).toHaveBeenCalledWith({ solicitacaoId: "s2", aprovar: true, novoLimite: null });
    });
  });
});
