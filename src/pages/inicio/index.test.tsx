import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * Tela /inicio: estados do painel (carregando, erro com nova tentativa, dado),
 * modo de edição, saudação pelo primeiro nome e a porta dos agentes (só com
 * permissão, sem mandar o texto para a analytics).
 */

type Painel = {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  data: unknown;
  dataUpdatedAt: number;
  refetch: ReturnType<typeof vi.fn>;
};

const h = vi.hoisted(() => ({
  painel: {} as Painel,
  can: new Set<string>(["ai_chat"]),
  profile: { id: "u1", first_name: " Ana " } as { id: string; first_name: string | null } | null,
  track: vi.fn(),
  salvar: vi.fn(),
  restaurar: vi.fn(),
  tentarDeNovo: vi.fn(),
}));

vi.mock("@/pages/inicio/hooks/usePainelGestao", () => ({ usePainelGestao: () => h.painel }));
vi.mock("@/pages/inicio/hooks/usePainelLayout", () => ({
  usePainelLayout: (padrao: unknown) => ({
    layout: padrao,
    salvar: h.salvar,
    restaurarPadrao: h.restaurar,
    salvando: false,
  }),
}));
vi.mock("@/pages/inicio/hooks/useResumoSemanal", () => ({
  useResumoSemanal: () => ({ estado: "pronto", resumo: null, erro: null, tentarDeNovo: h.tentarDeNovo }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: h.profile }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (f: string) => h.can.has(f) }) }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: h.track } }));
vi.mock("@/components/ui/sidebar", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/sidebar")>()),
  useSidebar: () => ({ state: "expanded", isMobile: false, open: true, setOpenMobile: vi.fn() }),
}));
vi.mock("@/components/ModuleChipNav", () => ({ ModuleChipNav: () => null }));
// O cartão de boas-vindas tem teste próprio (CartaoBoasVindas.test.tsx).
vi.mock("./CartaoBoasVindas", () => ({ CartaoBoasVindas: () => null }));
vi.mock("./CartaoPendenciasAgentes", () => ({ CartaoPendenciasAgentes: () => <div data-testid="pendencias" /> }));
vi.mock("./hero/HeroInicio", () => ({
  HeroInicio: (p: { nome: string | null; tema: string; editando: boolean; acoes: ReactNode }) => (
    <header data-testid="hero">
      {p.nome ?? "sem nome"}|{p.tema}|{String(p.editando)}
      {p.acoes}
    </header>
  ),
}));
vi.mock("./painel/PainelGrid", () => ({
  PainelGrid: (p: {
    editando: boolean;
    layout: { w: string }[];
    onEditar: (v: boolean) => void;
    hero: (acoes: ReactNode) => ReactNode;
  }) => (
    <div data-testid="grade" data-editando={String(p.editando)}>
      {p.hero(<span>ações</span>)}
      {p.layout.map((i) => i.w).join(",")}
      <button onClick={() => p.onEditar(false)}>Concluir</button>
    </div>
  ),
}));

import Inicio from "./index";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function Agentes() {
  const { state } = useLocation();
  return <div data-testid="agentes">{JSON.stringify(state)}</div>;
}

function renderInicio() {
  render(
    <MemoryRouter initialEntries={["/inicio"]}>
      <Routes>
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/agentes" element={<Agentes />} />
      </Routes>
    </MemoryRouter>
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  h.can = new Set(["ai_chat"]);
  h.profile = { id: "u1", first_name: " Ana " };
  h.painel = {
    isLoading: false,
    isError: false,
    isFetching: false,
    data: { ok: true },
    dataUpdatedAt: Date.now(),
    refetch: vi.fn().mockResolvedValue(undefined),
  };
});

describe("Início", () => {
  it("com dado mostra a grade com o layout padrão e a saudação pelo primeiro nome", () => {
    renderInicio();
    const grade = screen.getByTestId("grade");
    expect(grade).toHaveTextContent("projetos_numeros,gestao_propostas_numeros");
    expect(screen.getByTestId("hero")).toHaveTextContent("Ana|verde|false");
    expect(screen.getByTestId("pendencias")).toBeInTheDocument();
  });

  it("carregando mostra o cabeçalho sem a grade", () => {
    h.painel.isLoading = true;
    h.painel.data = undefined;
    h.profile = { id: "u1", first_name: "   " };
    renderInicio();
    expect(screen.queryByTestId("grade")).not.toBeInTheDocument();
    expect(screen.getByTestId("hero")).toHaveTextContent("sem nome");
  });

  it("erro oferece tentar de novo, que refaz a consulta", async () => {
    h.painel.isError = true;
    h.painel.data = undefined;
    const user = renderInicio();
    expect(screen.getByText(/Não foi possível carregar o painel/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(h.painel.refetch).toHaveBeenCalledOnce();
  });

  it("sem dado e sem erro não mostra grade nem erro", () => {
    h.painel.data = undefined;
    renderInicio();
    expect(screen.queryByTestId("grade")).not.toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível/)).not.toBeInTheDocument();
  });

  it("atualizar pelo selo de frescor refaz a consulta", async () => {
    const user = renderInicio();
    await user.click(screen.getByRole("button", { name: "Atualizar dados agora" }));
    expect(h.painel.refetch).toHaveBeenCalledOnce();
  });

  it("personalizar entra em edição e esconde a porta dos agentes; concluir volta", async () => {
    const user = renderInicio();
    await user.click(screen.getByRole("button", { name: "Personalizar" }));
    expect(screen.getByTestId("grade")).toHaveAttribute("data-editando", "true");
    expect(screen.queryByRole("button", { name: "Personalizar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Agentes" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("pendencias")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Concluir" }));
    expect(screen.getByTestId("grade")).toHaveAttribute("data-editando", "false");
  });

  it("sem permissão de agentes não mostra a porta nem as pendências", () => {
    h.can = new Set();
    renderInicio();
    expect(screen.queryByRole("region", { name: "Agentes" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("pendencias")).not.toBeInTheDocument();
  });

  it("perguntar leva o texto aos agentes e a analytics só sabe que houve texto", async () => {
    const user = renderInicio();
    await user.type(screen.getByRole("textbox", { name: "Perguntar aos agentes" }), "  quanto faturei?  ");
    await user.click(screen.getByRole("button", { name: "Abrir conversa com os agentes" }));
    expect(screen.getByTestId("agentes")).toHaveTextContent('{"prompt":"quanto faturei?"}');
    expect(h.track).toHaveBeenCalledWith("inicio_agentes_abrir", { origem: "barra_inicio", com_texto: true });
  });

  it("perguntar em branco abre os agentes sem estado", async () => {
    const user = renderInicio();
    await user.type(screen.getByRole("textbox", { name: "Perguntar aos agentes" }), "   {Enter}");
    expect(screen.getByTestId("agentes")).toHaveTextContent("null");
    expect(h.track).toHaveBeenCalledWith("inicio_agentes_abrir", { origem: "barra_inicio", com_texto: false });
  });
});
