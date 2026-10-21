import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { FICHA_SOBRADO, resultadoDoSobrado } from "@/test/estimativaFixtures";
import type { EstimativaResumo } from "./hooks";
import Estimativas from "./Estimativas";

/** Lista das estimativas (SPEC 136): estado vazio que orienta a primeira ação, busca e abertura da linha. */

let lista: EstimativaResumo[] = [];
let carregando = false;
let erro: Error | null = null;
let podeCriar = true;

const { navegar } = vi.hoisted(() => ({ navegar: vi.fn() }));

vi.mock("react-router-dom", async (original) => ({
  ...(await original<typeof import("react-router-dom")>()),
  useNavigate: () => navegar,
}));
vi.mock("./hooks", () => ({
  useEstimativas: () => ({ data: lista, isLoading: carregando, error: erro }),
}));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({
    title,
    search,
    actions,
    children,
  }: {
    title: string;
    search?: { value: string; onChange: (v: string) => void; placeholder?: string };
    actions?: ReactNode;
    children: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {search && (
        <input
          aria-label="Buscar"
          placeholder={search.placeholder}
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
        />
      )}
      {children}
    </main>
  ),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => podeCriar }) }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const estimativa = (id: string, nome: string, cliente: string | null): EstimativaResumo => ({
  id,
  nome,
  clienteNome: cliente,
  leadNome: null,
  propostaTitulo: null,
  status: "rascunho",
  versaoAtual: 0,
  ficha: FICHA_SOBRADO,
  resultado: resultadoDoSobrado(),
  atualizadoEm: "2026-10-19T12:00:00Z",
});

const abrir = () =>
  render(
    <MemoryRouter>
      <Estimativas />
    </MemoryRouter>
  );

beforeEach(() => {
  lista = [];
  carregando = false;
  erro = null;
  podeCriar = true;
  navegar.mockClear();
});

describe("Estimativas", () => {
  it("sem nenhuma estimativa, o estado vazio leva à primeira", async () => {
    const user = userEvent.setup();
    abrir();
    expect(screen.getByText("Estime a primeira obra")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nova estimativa" }));
    expect(navegar).toHaveBeenCalledWith("/obras/estimativas/nova");
  });

  it("sem permissão de criar, o estado vazio não oferece o botão", () => {
    podeCriar = false;
    abrir();
    expect(screen.getByText("Estime a primeira obra")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nova estimativa" })).not.toBeInTheDocument();
  });

  it("lista as estimativas com valor, área e status", () => {
    lista = [estimativa("a", "Sobrado Alphaville", "Maria")];
    abrir();
    expect(screen.getByText("Sobrado Alphaville")).toBeInTheDocument();
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByText("320 m²")).toBeInTheDocument();
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("sem versão")).toBeInTheDocument();
  });

  it("a busca filtra por nome e por cliente", async () => {
    const user = userEvent.setup();
    lista = [estimativa("a", "Sobrado Alphaville", "Maria"), estimativa("b", "Galpão Norte", "Construtora Beta")];
    abrir();
    await user.type(screen.getByLabelText("Buscar"), "beta");
    expect(screen.getByText("Galpão Norte")).toBeInTheDocument();
    expect(screen.queryByText("Sobrado Alphaville")).not.toBeInTheDocument();
  });

  it("clicar na linha abre o resultado", async () => {
    const user = userEvent.setup();
    lista = [estimativa("a", "Sobrado Alphaville", "Maria")];
    abrir();
    await user.click(screen.getByText("Sobrado Alphaville"));
    expect(navegar).toHaveBeenCalledWith("/obras/estimativas/a");
  });

  it("o botão Tabela de preços leva à tabela da empresa", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: "Tabela de preços" }));
    expect(navegar).toHaveBeenCalledWith("/obras/estimativas/precos");
  });

  it("mostra o lead de onde a estimativa nasceu", () => {
    lista = [
      { ...estimativa("a", "Sobrado Alphaville", "Maria"), leadNome: "Família Almeida" },
      estimativa("b", "Galpão", null),
    ];
    abrir();
    expect(screen.getByText("Família Almeida")).toBeInTheDocument();
  });

  it("mostra também a proposta de onde a estimativa nasceu", () => {
    lista = [{ ...estimativa("a", "Sobrado Alphaville", "Maria"), propostaTitulo: "Residência Almeida" }];
    abrir();
    expect(screen.getByText("Proposta: Residência Almeida")).toBeInTheDocument();
  });
});
