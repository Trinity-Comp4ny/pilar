import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FICHA_SOBRADO, insumosProntos, resultadoDoSobrado } from "@/test/estimativaFixtures";
import type { PrecoSinapi } from "@/schemas/estimativaObra";
import type { EstimativaCompleta, Insumos, VersaoEstimativa } from "./hooks";
import EstimativaDetalhe from "./EstimativaDetalhe";

/**
 * Resultado da estimativa (SPEC 136): mexer nas premissas recalcula e grava sozinho, a versão é um
 * snapshot à parte, excluir pede confirmação e as três abas mostram o mesmo cálculo.
 */

let estimativa: EstimativaCompleta | undefined;
let insumos: Insumos = insumosProntos();
let versoes: VersaoEstimativa[] = [];
let podeEditar = true;

const { navegar, atualizar, salvarVersao, excluir } = vi.hoisted(() => ({
  navegar: vi.fn(),
  atualizar: vi.fn(),
  salvarVersao: vi.fn(),
  excluir: vi.fn(),
}));

vi.mock("react-router-dom", async (original) => ({
  ...(await original<typeof import("react-router-dom")>()),
  useNavigate: () => navegar,
}));

vi.mock("./hooks", () => ({
  useEstimativa: () => ({ data: estimativa, isLoading: false }),
  useInsumosDaEstimativa: () => insumos,
  useVersoes: () => ({ data: versoes, isLoading: false }),
  useAtualizarEstimativa: () => ({ mutate: atualizar, mutateAsync: atualizar, isPending: false }),
  useSalvarVersao: () => ({ mutateAsync: salvarVersao, isPending: false }),
  useExcluirEstimativa: () => ({ mutateAsync: excluir, isPending: false }),
}));

vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({
    title,
    tabs,
    actions,
    children,
  }: {
    title: string;
    tabs?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {tabs}
      {actions}
      {children}
    </main>
  ),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => podeEditar }) }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function criarEstimativa(): EstimativaCompleta {
  return {
    id: "est-1",
    nome: "Sobrado Alphaville",
    clienteNome: "Maria",
    status: "rascunho",
    versaoAtual: 0,
    ficha: FICHA_SOBRADO,
    resultado: resultadoDoSobrado(),
    premissas: {},
    obraId: null,
    atualizadoEm: "2026-10-19T12:00:00Z",
    criadoEm: "2026-10-19T12:00:00Z",
  };
}

const abrir = () =>
  render(
    <MemoryRouter initialEntries={["/obras/estimativas/est-1"]}>
      <Routes>
        <Route path="/obras/estimativas/:id" element={<EstimativaDetalhe />} />
      </Routes>
    </MemoryRouter>
  );

// O gráfico de desembolso (recharts) mede o contêiner; o jsdom não tem ResizeObserver.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

beforeEach(() => {
  estimativa = criarEstimativa();
  insumos = insumosProntos();
  versoes = [];
  podeEditar = true;
  navegar.mockClear();
  atualizar.mockReset().mockResolvedValue(undefined);
  salvarVersao.mockReset().mockResolvedValue(undefined);
  excluir.mockReset().mockResolvedValue(undefined);
});

describe("EstimativaDetalhe", () => {
  it("mostra nome, status, cliente e a aba de custo com as premissas ao lado", () => {
    abrir();
    expect(screen.getByRole("heading", { level: 1, name: "Sobrado Alphaville" })).toBeInTheDocument();
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma versão salva")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Premissas e versões" })).toBeInTheDocument();
    expect(screen.getByLabelText("Taxa de administração")).toBeInTheDocument();
  });

  it("parâmetros ainda em validação aparecem como aviso", () => {
    abrir();
    expect(screen.getByRole("list", { name: "Avisos da estimativa" })).toBeInTheDocument();
  });

  it("mudar a administração recalcula e grava sozinho depois de uma pausa", async () => {
    const user = userEvent.setup();
    abrir();
    const campo = screen.getByLabelText("Taxa de administração");
    await user.clear(campo);
    await user.type(campo, "15");

    expect(await screen.findByText("Alterações pendentes")).toBeInTheDocument();
    await waitFor(() => expect(atualizar).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const [salvo] = atualizar.mock.calls[0] as [
      { id: string; premissas: { adm: number }; resultado: { provavel: number } },
    ];
    expect(salvo.id).toBe("est-1");
    expect(salvo.premissas.adm).toBe(15);
    expect(salvo.resultado.provavel).not.toBe(resultadoDoSobrado().provavel);
  });

  it("valor fora do limite mostra o motivo e não grava", async () => {
    const user = userEvent.setup();
    abrir();
    const campo = screen.getByLabelText("Taxa de administração");
    await user.clear(campo);
    await user.type(campo, "-5");
    expect(await screen.findByText("Use um valor entre 0% e 40%")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 1000));
    expect(atualizar).not.toHaveBeenCalled();
  });

  it("trocar o padrão grava a ficha com o padrão novo", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: "Médio" }));
    await waitFor(() => expect(atualizar).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const [salvo] = atualizar.mock.calls[0] as [{ ficha: { padrao: string } }];
    expect(salvo.ficha.padrao).toBe("normal");
  });

  it("salvar versão guarda uma nota e fecha o diálogo", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: "Salvar como nova versão" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText(/Nota/), "Com piscina maior");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar versão" }));

    await waitFor(() => expect(salvarVersao).toHaveBeenCalledTimes(1));
    const [nova] = salvarVersao.mock.calls[0] as [{ estimativaId: string; nota: string }];
    expect(nova.estimativaId).toBe("est-1");
    expect(nova.nota).toBe("Com piscina maior");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("versões salvas aparecem com valor e nota", () => {
    versoes = [
      {
        id: "v1",
        versao: 1,
        nota: "Primeira rodada",
        resultado: resultadoDoSobrado(),
        parametrosValidados: false,
        criadoEm: "2026-10-19T12:00:00Z",
      },
    ];
    abrir();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("Primeira rodada")).toBeInTheDocument();
    expect(screen.getByText("parâmetros em validação")).toBeInTheDocument();
  });

  it("excluir pede confirmação antes de apagar e volta para a lista", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(excluir).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole("alertdialog");
    await user.click(within(dialogo).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(excluir).toHaveBeenCalledWith("est-1"));
    expect(navegar).toHaveBeenCalledWith("/obras/estimativas");
  });

  it("sem permissão de edição, esconde editar e excluir", () => {
    podeEditar = false;
    abrir();
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Editar a ficha" })).not.toBeInTheDocument();
  });

  it("as abas trocam entre custo, cronograma e cenários", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("tab", { name: /Cronograma/ }));
    expect(screen.queryByRole("complementary", { name: "Premissas e versões" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Comparar cenários/ }));
    expect(screen.getAllByText(/Padrão baixo/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("tab", { name: /Custo/ }));
    expect(screen.getByRole("complementary", { name: "Premissas e versões" })).toBeInTheDocument();
  });

  it("estimativa inexistente orienta a voltar para a lista", async () => {
    estimativa = undefined;
    const user = userEvent.setup();
    abrir();
    expect(screen.getByText("Esta estimativa não existe ou foi removida")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar às estimativas" }));
    expect(navegar).toHaveBeenCalledWith("/obras/estimativas");
  });

  it("falha ao carregar os preços mostra o motivo", () => {
    insumos = { estado: "erro", mensagem: "sem permissão" };
    abrir();
    expect(screen.getByText("Não foi possível carregar a tabela de preços")).toBeInTheDocument();
    expect(screen.getByText("sem permissão")).toBeInTheDocument();
  });
});

describe("EstimativaDetalhe: origem do preço (SPEC 137)", () => {
  const split12: PrecoSinapi = {
    codigo: 42425,
    uf: "SP",
    regime: "onerado",
    mes_base: "2026-09-01",
    valor: 2175.13,
    origem: "CR",
    descricao: "AR-CONDICIONADO SPLIT INVERTER 12000 BTU/H",
    unidade: "UN",
  };

  const botaoInformar = (linha: string) => {
    const tr = screen.getByText(linha).closest("tr");
    if (!tr) throw new Error(`Linha ${linha} não encontrada`);
    return within(tr).getByRole("button", { name: "Informar valor" });
  };

  const comItens = () => {
    estimativa = { ...criarEstimativa(), ficha: { ...FICHA_SOBRADO, itens: { ac12: 2, fv: 8 } } };
    insumos = { ...insumosProntos(), precosSinapi: [split12] };
  };

  it("mostra a origem de cada linha e o resumo de quanto tem fonte verificável", () => {
    comItens();
    abrir();
    expect(screen.getByRole("heading", { name: "De onde vem o preço" })).toBeInTheDocument();
    expect(screen.getByText(/do total tem fonte verificável/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Origem do preço de ar-condicionado split 12\.000 btu.*SINAPI/i })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Origem do preço de piscina.*Provisória/i }).length).toBeGreaterThan(
      0
    );
    expect(screen.getByRole("button", { name: /Origem do preço de energia solar.*A definir/i })).toBeInTheDocument();
  });

  it("clicar na origem SINAPI abre o código, a UF, o mês e o regime", async () => {
    comItens();
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: /Origem do preço de ar-condicionado split 12\.000 btu/i }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("42425 (insumo)")).toBeInTheDocument();
    expect(within(dialogo).getByText("SP · set/2026")).toBeInTheDocument();
    expect(within(dialogo).getByText("sem desoneração")).toBeInTheDocument();
    expect(within(dialogo).getByText(/Derivado de preços coletados/)).toBeInTheDocument();
  });

  it("clicar na origem do CUB mostra a tabela e o valor por m²", async () => {
    comItens();
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: /Origem do preço de base do CUB/i }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/^CUB R1-/)).toBeInTheDocument();
  });

  it("informar o valor de um item a definir recalcula, grava na premissa e vira 'Você informou'", async () => {
    comItens();
    const user = userEvent.setup();
    abrir();
    await user.click(botaoInformar("Energia solar fotovoltaica (8 kWp)"));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText(/Valor \(por kWp\)/), "520000");
    await user.type(within(dialogo).getByLabelText(/Nota/), "Orçamento do integrador");
    await user.click(within(dialogo).getByRole("button", { name: "Usar este valor" }));

    expect(
      await screen.findByRole("button", { name: /Origem do preço de energia solar.*Você informou/i })
    ).toBeInTheDocument();
    await waitFor(() => expect(atualizar).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const [salvo] = atualizar.mock.calls[0] as [
      { premissas: { valores: Record<string, { valor_unitario: number; nota?: string }> } },
    ];
    expect(salvo.premissas.valores.fv).toEqual({ valor_unitario: 5200, nota: "Orçamento do integrador" });
  });

  it("valor zerado não passa e diz o motivo", async () => {
    comItens();
    const user = userEvent.setup();
    abrir();
    await user.click(botaoInformar("Energia solar fotovoltaica (8 kWp)"));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Usar este valor" }));
    expect(within(dialogo).getByText("Informe um valor maior que zero")).toBeInTheDocument();
    expect(atualizar).not.toHaveBeenCalled();
  });

  it("trocar o valor já informado e depois removê-lo volta à fonte seguinte", async () => {
    comItens();
    estimativa = { ...estimativa!, premissas: { valores: { ac12: { valor_unitario: 2600, nota: "fornecedor" } } } };
    const user = userEvent.setup();
    abrir();
    await user.click(
      screen.getByRole("button", { name: /Origem do preço de ar-condicionado split 12\.000 btu.*Você informou/i })
    );
    await user.click(await screen.findByRole("button", { name: "Trocar o valor" }));
    await user.click(await screen.findByRole("button", { name: "Remover o valor informado" }));
    expect(
      await screen.findByRole("button", { name: /Origem do preço de ar-condicionado split 12\.000 btu.*SINAPI/i })
    ).toBeInTheDocument();
  });

  it("sem permissão de edição, o item a definir não oferece informar valor", () => {
    comItens();
    podeEditar = false;
    abrir();
    expect(screen.queryByRole("button", { name: "Informar valor" })).not.toBeInTheDocument();
    expect(screen.getAllByText("A definir").length).toBeGreaterThan(0);
  });

  it("resultado salvo antes da origem abre sem o resumo e com as linhas como provisórias", () => {
    estimativa = { ...criarEstimativa(), resultado: { ...resultadoDoSobrado(), origens: undefined } };
    abrir();
    expect(screen.getAllByRole("button", { name: /Origem do preço de piscina.*Provisória/i }).length).toBeGreaterThan(
      0
    );
  });
});
