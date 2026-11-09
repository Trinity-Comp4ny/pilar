import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsoPanel } from "./UsoPanel";

const h = vi.hoisted(() => ({
  uso: {} as Record<string, unknown>,
  isLoading: false,
  error: null as Error | null,
  eventos: [] as unknown[],
  meuUso: { tokensCiclo: 0, limiteMensal: null as number | null },
  solicitar: { mutate: vi.fn(), isPending: false },
  openSettings: vi.fn(),
  closeSettings: vi.fn(),
  role: "user",
  canPessoas: false,
  navigate: vi.fn(),
}));

vi.mock("@/components/settings/useUsoEmpresa", () => ({
  useUsoEmpresa: () => ({ uso: h.uso, isLoading: h.isLoading, error: h.error }),
}));
vi.mock("@/components/settings/useExtratoTokens", () => ({
  useExtratoTokens: () => ({ eventos: h.eventos, isLoading: false, error: null }),
  agentKeyLabel: (k: string) => `rotulo:${k}`,
}));
vi.mock("@/components/settings/useMeuUsoTokens", () => ({ useMeuUsoTokens: () => ({ meuUso: h.meuUso }) }));
vi.mock("@/components/settings/useSolicitarTokens", () => ({ useSolicitarTokens: () => h.solicitar }));
vi.mock("@/components/settings/panels/EquipeTokensSection", () => ({
  EquipeTokensSection: () => <div data-testid="equipe-tokens" />,
}));
vi.mock("@/contexts/SettingsModalContext", () => ({
  useSettingsModal: () => ({ openSettings: h.openSettings, closeSettings: h.closeSettings }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: { role: h.role } }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => h.canPessoas }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("@/components/motion/ReadingRing", () => ({ ReadingRing: () => <div data-testid="carregando" /> }));

const USO_BASE = {
  projetosAtivos: 2,
  obrasAtivas: 4,
  leadsAtivos: 10,
  usuarios: 3,
  maxProjetos: 10,
  maxObras: 5,
  maxLeads: 10,
  maxUsuarios: null,
  planoNome: "Escritório",
  tokensPlano: 50000,
  tokensComprado: 5000,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.uso = { ...USO_BASE };
  h.isLoading = false;
  h.error = null;
  h.eventos = [];
  h.meuUso = { tokensCiclo: 0, limiteMensal: null };
  h.solicitar = { mutate: vi.fn(), isPending: false };
  h.role = "user";
  h.canPessoas = false;
});

describe("UsoPanel", () => {
  it("carregando", () => {
    h.isLoading = true;
    render(<UsoPanel />);
    expect(screen.getByTestId("carregando")).toBeInTheDocument();
  });

  it("erro", () => {
    h.error = new Error("x");
    render(<UsoPanel />);
    expect(screen.getByText(/Não foi possível carregar o uso/)).toBeInTheDocument();
  });

  it("medidores: normal, perto do limite, cheio e ilimitado", () => {
    render(<UsoPanel />);
    expect(screen.getByText("Você está no plano Escritório.")).toBeInTheDocument();
    expect(screen.getByText("Você está perto do limite da sua faixa.")).toBeInTheDocument();
    expect(screen.getByText("Faixa cheia. Suba de plano para abrir mais.")).toBeInTheDocument();
    expect(screen.getByText("· ilimitado", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("10 créditos")).toBeInTheDocument();
    expect(screen.getByText("1 crédito")).toBeInTheDocument();
    // perto da faixa: oferece subir de plano
    expect(screen.getByText("Precisa de mais capacidade?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Comprar mais/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("equipe-tokens")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhum uso de IA registrado ainda.")).toBeInTheDocument();
  });

  it("sem plano convida a assinar", async () => {
    h.uso = { ...USO_BASE, planoNome: null, obrasAtivas: 0, leadsAtivos: 0 };
    render(<UsoPanel />);
    expect(screen.getByText("Sem assinatura ativa no momento.")).toBeInTheDocument();
    expect(screen.getByText("Escolha um plano")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Ver assinatura/ }));
    expect(h.openSettings).toHaveBeenCalledWith("pagamento");
  });

  it("longe dos limites e com plano não mostra o convite", () => {
    h.uso = { ...USO_BASE, obrasAtivas: 0, leadsAtivos: 0 };
    render(<UsoPanel />);
    expect(screen.queryByRole("button", { name: /Ver assinatura/ })).not.toBeInTheDocument();
  });

  it("admin compra mais créditos; quem gere pessoas vê a equipe", async () => {
    h.role = "admin";
    h.canPessoas = true;
    render(<UsoPanel />);
    expect(screen.getByTestId("equipe-tokens")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Comprar mais/ }));
    expect(h.closeSettings).toHaveBeenCalled();
    expect(h.navigate).toHaveBeenCalledWith("/comprar-tokens");
  });

  it("extrato mostra rótulo do agente e quem usou", () => {
    h.eventos = [
      { id: "1", createdAt: "2026-11-01T10:00:00Z", agentKey: "ai_chat", tokensTotal: 2500, userNome: null },
    ];
    render(<UsoPanel />);
    expect(screen.getAllByText("rotulo:ai_chat").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("limite pessoal longe do teto não oferece pedido", () => {
    h.meuUso = { tokensCiclo: 5000, limiteMensal: 50000 };
    render(<UsoPanel />);
    expect(screen.getByText("Seu limite de créditos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pedir mais créditos/ })).not.toBeInTheDocument();
  });

  it("perto do limite pessoal pede mais créditos ao admin", async () => {
    h.meuUso = { tokensCiclo: 50000, limiteMensal: 50000 };
    h.solicitar.mutate.mockImplementation((_v, opts) => opts.onSuccess());
    const user = userEvent.setup();
    render(<UsoPanel />);
    expect(screen.getByText(/Limite pessoal atingido/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Pedir mais créditos/ }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: /Pedir mais créditos/ }));
    await user.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect(h.solicitar.mutate).toHaveBeenLastCalledWith({ mensagem: undefined }, expect.any(Object));

    await user.click(screen.getByRole("button", { name: /Pedir mais créditos/ }));
    await user.type(screen.getByPlaceholderText("Motivo do pedido (opcional)"), "  orçamento grande ");
    await user.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect(h.solicitar.mutate).toHaveBeenLastCalledWith({ mensagem: "orçamento grande" }, expect.any(Object));
    expect(screen.getByRole("button", { name: /Pedir mais créditos/ })).toBeInTheDocument();
  });
});
