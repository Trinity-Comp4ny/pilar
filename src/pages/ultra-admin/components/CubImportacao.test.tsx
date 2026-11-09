import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lerCsv, type LinhaGravada } from "../estimativaCubImport";
import { CubImportacao } from "./CubImportacao";

/**
 * Importação do CUB (SPEC 136, BEZ-13): a planilha com erro mostra as linhas e bloqueia o botão, a boa
 * libera e grava só o que foi lido, e o que já foi importado aparece como aviso e cobertura.
 */

let gravadas: LinhaGravada[] = [];
let falhaNaConsulta = false;

const { gravarCub } = vi.hoisted(() => ({ gravarCub: vi.fn(async (..._a: unknown[]) => {}) }));

vi.mock("../estimativaAdmin", () => ({
  useCubGravado: () => ({
    data: falhaNaConsulta ? undefined : gravadas,
    isLoading: false,
    error: falhaNaConsulta ? new Error("falhou") : null,
    refetch: vi.fn(),
  }),
  gravarCub,
  // O leitor de verdade usa o CSV real; só o Excel precisa do navegador.
  lerCelulas: async (arquivo: File) => lerCsv(await arquivo.text()),
}));

vi.mock("../hooks", () => ({
  useAcaoEmpresa: (opts: { run: (e: never) => Promise<unknown> }) => ({
    mutate: (entrada: never, callbacks?: { onSuccess?: () => void }) => {
      void opts.run(entrada).then(() => callbacks?.onSuccess?.());
    },
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const CSV_COM_ERROS = ["UF;Código;Valor", "SP;R1-A;3.350,00", "MG;R1-A;0,00", "XX;R1-B;2.100,00"].join("\n");
const CSV_OK = ["UF;Código;Valor", "SP;R1-A;3.350,00", "RJ;R1-N;2.650,00"].join("\n");

async function enviar(csv: string) {
  const user = userEvent.setup();
  const entrada = screen.getByLabelText("Planilha do CUB");
  await user.upload(entrada, new File([csv], "cub.csv", { type: "text/csv" }));
  return user;
}

beforeEach(() => {
  gravadas = [];
  falhaNaConsulta = false;
  gravarCub.mockClear();
  // Só o relógio é falso: 19/10/2026, então o mês-base padrão é set/2026.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
});

afterEach(() => vi.useRealTimers());

describe("CubImportacao", () => {
  it("sem nenhum CUB, explica que ninguém consegue estimar e oferece escolher a planilha", () => {
    render(<CubImportacao />);
    expect(screen.getByText("Nenhum CUB importado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escolher a planilha" })).toBeInTheDocument();
  });

  it("planilha com erro lista cada linha e bloqueia o botão de importar", async () => {
    render(<CubImportacao />);
    await enviar(CSV_COM_ERROS);

    expect(await screen.findByText("Não gravamos nada enquanto houver erro.")).toBeInTheDocument();
    expect(screen.getByText(/O valor deve ser maior que zero/)).toBeInTheDocument();
    expect(screen.getByText(/UF "XX" desconhecida/)).toBeInTheDocument();
    expect(screen.getByText("1 pronta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
    expect(gravarCub).not.toHaveBeenCalled();
  });

  it("planilha boa libera o botão e grava as linhas lidas no mês escolhido", async () => {
    render(<CubImportacao />);
    const user = await enviar(CSV_OK);

    const botao = await screen.findByRole("button", { name: "Importar 2 linhas sem desoneração" });
    expect(botao).toBeEnabled();
    await user.click(botao);

    await waitFor(() => expect(gravarCub).toHaveBeenCalledTimes(1));
    const [linhas, fonte] = gravarCub.mock.calls[0] as [
      { uf: string; subtipo: string; padrao: string; valor_m2: number; mes_base: string; regime: string }[],
      string,
    ];
    expect(linhas.map((l) => [l.uf, l.subtipo, l.padrao, l.valor_m2, l.mes_base, l.regime])).toEqual([
      ["SP", "R1", "alto", 3350, "2026-09-01", "onerado"],
      ["RJ", "R1", "normal", 2650, "2026-09-01", "onerado"],
    ]);
    expect(fonte).toBe("Planilha importada: cub.csv");
  });

  it("a prévia diz o regime e o mês que serão gravados", async () => {
    render(<CubImportacao />);
    await enviar(CSV_OK);
    expect(await screen.findByText("Sem desoneração, set/2026")).toBeInTheDocument();
    expect(screen.queryByText(/O nome do arquivo sugere/)).not.toBeInTheDocument();
  });

  it("avisa quando o nome do arquivo sugere o outro regime", async () => {
    render(<CubImportacao />);
    const user = userEvent.setup();
    await user.upload(
      screen.getByLabelText("Planilha do CUB"),
      new File([CSV_OK], "cub-2026-09-com-desoneracao.csv", { type: "text/csv" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O nome do arquivo sugere CUB com desoneração, mas o regime escolhido é sem desoneração"
    );
  });

  it("depois de importar, a prévia some e volta a tela de importação", async () => {
    render(<CubImportacao />);
    const user = await enviar(CSV_OK);
    await user.click(await screen.findByRole("button", { name: "Importar 2 linhas sem desoneração" }));
    await waitFor(() => expect(screen.queryByText("cub.csv")).not.toBeInTheDocument());
  });

  it("planilha sem cabeçalho reconhecível explica o que procurar", async () => {
    render(<CubImportacao />);
    await enviar("a;b\n1;2");
    expect(await screen.findByRole("alert")).toHaveTextContent("Não achamos as colunas UF, valor");
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });

  it("mês que já tem tabela avisa que importar de novo corrige os valores", async () => {
    gravadas = [
      {
        uf: "SP",
        subtipo: "R1",
        padrao: "alto",
        mes_base: "2026-09-01",
        regime: "onerado",
        created_at: "2026-10-02T10:00:00Z",
      },
    ];
    render(<CubImportacao />);
    expect(screen.getByText(/set\/2026 \(sem desoneração\) já tem 1 linha\./)).toBeInTheDocument();
    expect(screen.getByTitle("1 de 27")).toBeInTheDocument();
  });

  it("mês importado só com desoneração não avisa no regime padrão (sem desoneração)", () => {
    gravadas = [
      {
        uf: "SP",
        subtipo: "R1",
        padrao: "alto",
        mes_base: "2026-09-01",
        regime: "desonerado",
        created_at: "2026-10-02T10:00:00Z",
      },
    ];
    render(<CubImportacao />);
    expect(screen.queryByText(/já tem/)).not.toBeInTheDocument();
    expect(screen.getByText("Com desoneração")).toBeInTheDocument();
  });

  it("cobertura marca as UFs com e sem tabela", () => {
    gravadas = [
      {
        uf: "SP",
        subtipo: "R1",
        padrao: "alto",
        mes_base: "2026-09-01",
        regime: "onerado",
        created_at: "2026-10-02T10:00:00Z",
      },
      {
        uf: "RJ",
        subtipo: "R1",
        padrao: "alto",
        mes_base: "2026-09-01",
        regime: "onerado",
        created_at: "2026-10-02T10:00:00Z",
      },
    ];
    render(<CubImportacao />);
    expect(screen.getByTitle("2 de 27")).toBeInTheDocument();
    const lista = screen.getByRole("list", { name: "UFs com e sem tabela" });
    expect(lista).toHaveTextContent("SP com tabela");
    expect(lista).toHaveTextContent("AC sem tabela");
  });

  it("falha na consulta aparece, em vez de fingir que não há CUB", () => {
    falhaNaConsulta = true;
    render(<CubImportacao />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar o CUB já importado");
    expect(screen.queryByText("Nenhum CUB importado")).not.toBeInTheDocument();
  });
});
