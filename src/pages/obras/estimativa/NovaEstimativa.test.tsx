import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CUB_FIXTURE, insumosProntos } from "@/test/estimativaFixtures";
import type { Insumos } from "./hooks";
import NovaEstimativa from "./NovaEstimativa";

/**
 * Assistente em quatro passos (SPEC 136): cada passo valida o que é dele, tipo e subtipo mudam as opções
 * seguintes, e a revisão só gera a estimativa quando o cálculo fecha.
 */

let insumos: Insumos = insumosProntos();

const { navegar, criar } = vi.hoisted(() => ({
  navegar: vi.fn(),
  criar: vi.fn(async (..._a: unknown[]) => "nova-id"),
}));

vi.mock("react-router-dom", async (original) => ({
  ...(await original<typeof import("react-router-dom")>()),
  useNavigate: () => navegar,
}));

vi.mock("./hooks", () => ({
  useInsumosDaEstimativa: () => insumos,
  useEstimativa: () => ({ data: undefined, isLoading: false }),
  useCriarEstimativa: () => ({ mutateAsync: criar, isPending: false }),
  useAtualizarEstimativa: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const abrir = () =>
  render(
    <MemoryRouter initialEntries={["/obras/estimativas/nova"]}>
      <NovaEstimativa />
    </MemoryRouter>
  );

beforeEach(() => {
  insumos = insumosProntos();
  navegar.mockClear();
  criar.mockClear();
});

describe("NovaEstimativa", () => {
  it("começa pelo tipo de obra, com residencial, casa e padrão normal", () => {
    abrir();
    expect(screen.getByText("Que obra é essa?")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Residencial/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Casa térrea" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("radio", { name: /^Normal/ })).toHaveAttribute("aria-checked", "true");
  });

  it("padrão sem tabela de preço para o subtipo fica desligado", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("radio", { name: /^Baixo/ }));
    await user.click(screen.getByRole("radio", { name: /Comercial/ }));
    // CSL-8 só tem normal e alto: o baixo escolhido antes passa para o normal, e o baixo não dá mais para escolher.
    expect(screen.getByRole("radio", { name: /^Baixo/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /^Normal/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Sem tabela de preço para este subtipo")).toBeInTheDocument();
  });

  it("sem nome, o passo de local não avança e diz o motivo", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Onde e de que tamanho?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Dê um nome à estimativa")).toBeInTheDocument();
    expect(screen.getByText("Onde e de que tamanho?")).toBeInTheDocument();
  });

  it("área zerada mostra o erro do campo", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Nome da estimativa"), "Casa Teste");
    await user.clear(screen.getByLabelText("Área construída"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Informe um número")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Área construída"), "0");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Informe a área construída")).toBeInTheDocument();
  });

  it("percorre os quatro passos, mostra a fonte na revisão e grava a estimativa", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Nome da estimativa"), "Casa Teste");
    await user.type(screen.getByLabelText("Cliente"), "Maria");
    await user.clear(screen.getByLabelText("Área construída"));
    await user.type(screen.getByLabelText("Área construída"), "150");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("O que a obra tem?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mais vagas" }));
    await user.click(screen.getByRole("button", { name: "Completa" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Confira o que entendemos")).toBeInTheDocument();
    expect(screen.getByText("CUB R1-N · SP · set/2026 · sem desoneração")).toBeInTheDocument();
    expect(screen.getByText(/marcenaria completa/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gerar estimativa" }));

    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1));
    const [nova] = criar.mock.calls[0] as [
      {
        nome: string;
        clienteNome: string;
        ficha: { area: number; vagas: number; marcenaria: string };
        resultado: { provavel: number };
      },
    ];
    expect(nova.nome).toBe("Casa Teste");
    expect(nova.clienteNome).toBe("Maria");
    expect(nova.ficha.area).toBe(150);
    expect(nova.ficha.vagas).toBe(3);
    expect(nova.ficha.marcenaria).toBe("completa");
    expect(nova.resultado.provavel).toBeGreaterThan(0);
    expect(navegar).toHaveBeenCalledWith("/obras/estimativas/nova-id");
  });

  it("a revisão leva de volta ao passo da linha que o usuário quer corrigir", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Nome da estimativa"), "Casa Teste");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: /Editar tamanho/ }));
    expect(screen.getByText("Onde e de que tamanho?")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da estimativa")).toHaveValue("Casa Teste");
  });

  it("trocar para comercial esconde o programa de casa", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("radio", { name: /Comercial/ }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Nome da estimativa"), "Clínica");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.queryByRole("button", { name: "Mais suítes" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Piscina")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais banheiros" })).toBeInTheDocument();
  });

  it("sem nenhum CUB, explica em vez de abrir o assistente", () => {
    insumos = { ...insumosProntos(), cub: [] };
    abrir();
    expect(screen.getByText("O Pilar ainda não tem a tabela do CUB")).toBeInTheDocument();
    expect(screen.queryByText("Que obra é essa?")).not.toBeInTheDocument();
  });

  it("falha ao carregar os insumos mostra o motivo", () => {
    insumos = { estado: "erro", mensagem: "sem permissão" };
    abrir();
    expect(screen.getByText("Não foi possível carregar a tabela de preços")).toBeInTheDocument();
    expect(screen.getByText("sem permissão")).toBeInTheDocument();
  });

  it("o CUB da fixture cobre os subtipos usados nos testes", () => {
    expect(CUB_FIXTURE.some((l) => l.subtipo === "GI")).toBe(true);
  });
});
