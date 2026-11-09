import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parametrosDaMigration } from "@/test/estimativaFixtures";
import type { AbaSinapi, CelulaBruta, LinhaSinapiGravada } from "../estimativaSinapiImport";
import { SinapiImportacao } from "./SinapiImportacao";

/**
 * SINAPI mensal (SPEC 137, BEZ-69): o ultra admin envia o relatório, vê a prévia com a cobertura por item e
 * só grava quando não há erro. O mês e o regime vêm do próprio arquivo.
 */

let gravadas: LinhaSinapiGravada[] = [];
let abas: AbaSinapi[] = [];
let leituraFalha: Error | null = null;

const { gravarSinapi, toastErro } = vi.hoisted(() => ({
  gravarSinapi: vi.fn(async (..._a: unknown[]) => {}),
  toastErro: vi.fn(),
}));

vi.mock("../estimativaAdmin", () => ({
  useParametrosEstimativa: () => ({
    data: { parametros: parametrosDaMigration(), validadoEm: null, atualizadoEm: "2026-10-19T12:00:00Z" },
    isLoading: false,
    error: null,
  }),
  useSinapiGravado: () => ({ data: gravadas, isLoading: false, error: null, refetch: vi.fn() }),
  lerAbasSinapi: async () => {
    if (leituraFalha) throw leituraFalha;
    return abas;
  },
  gravarSinapi,
}));

vi.mock("../hooks", () => ({
  useAcaoEmpresa: (opts: { run: (e: never) => Promise<unknown> }) => ({
    mutate: (entrada: never, callbacks?: { onSuccess?: () => void }) => {
      void opts.run(entrada).then(() => callbacks?.onSuccess?.());
    },
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: toastErro } }));

const UFS = ["AC", "SP"];
const pad = (c: CelulaBruta[]) => [...c, ...Array(Math.max(0, 5 + UFS.length - c.length)).fill("")];

function planilha(insumos: CelulaBruta[][], mes = "09/2026"): AbaSinapi[] {
  return [
    {
      nome: "ISD",
      celulas: [
        pad(["SINAPI - Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil"]),
        pad(["RELATÓRIO DE PREÇOS DE INSUMOS - ENCARGOS SOCIAIS SEM DESONERAÇÃO"]),
        pad(["Mês de Referência:", mes]),
        pad([]),
        pad([]),
        pad([]),
        pad(["Classificação", "Código do\nInsumo", "Descrição do Insumo", "Unidade", "Origem de\nPreço", ...UFS]),
        ...insumos.map(pad),
      ],
    },
  ];
}

const SPLIT_12: CelulaBruta[] = ["MATERIAL", 42425, "AR-CONDICIONADO SPLIT 12000 BTU/H", "UN", "CR", 2400.5, 2175.13];

const arquivoQualquer = () => new File(["x"], "SINAPI_Referência_2026_09.xlsx");

beforeEach(() => {
  gravadas = [];
  abas = planilha([SPLIT_12]);
  leituraFalha = null;
  gravarSinapi.mockClear();
  toastErro.mockClear();
});

describe("SinapiImportacao", () => {
  it("sem nada importado, explica o efeito e orienta o primeiro passo", () => {
    render(<SinapiImportacao />);
    expect(screen.getByText("Nenhum SINAPI importado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escolher o relatório" })).toBeInTheDocument();
    expect(screen.getByText(/SINAPI_Referência_AAAA_MM\.xlsx/)).toBeInTheDocument();
  });

  it("mostra a prévia com mês, regime e cobertura, e grava ao importar", async () => {
    const user = userEvent.setup();
    render(<SinapiImportacao />);
    await user.upload(screen.getByLabelText("Relatório do SINAPI"), arquivoQualquer());

    expect(await screen.findByText("set/2026")).toBeInTheDocument();
    expect(screen.getAllByText("Sem desoneração").length).toBeGreaterThan(0);
    expect(screen.getByText("2 preços")).toBeInTheDocument();
    expect(screen.getByText("Ar-condicionado split 12.000 BTU")).toBeInTheDocument();
    expect(screen.getByText(/Sem preço em nenhuma UF neste mês/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Importar 2 preços" }));
    await waitFor(() => expect(gravarSinapi).toHaveBeenCalledTimes(1));
    const [linhas, fonte] = gravarSinapi.mock.calls[0] as [{ codigo: number; uf: string; valor: number }[], string];
    expect(linhas.map((l) => [l.codigo, l.uf, l.valor])).toEqual([
      [42425, "AC", 2400.5],
      [42425, "SP", 2175.13],
    ]);
    expect(fonte).toBe("SINAPI set/2026 (SINAPI_Referência_2026_09.xlsx)");
  });

  it("arquivo fora do formato mostra o motivo e não deixa importar", async () => {
    abas = [{ nome: "Menu", celulas: [] }];
    const user = userEvent.setup();
    render(<SinapiImportacao />);
    await user.upload(screen.getByLabelText("Relatório do SINAPI"), arquivoQualquer());
    expect(await screen.findByText(/não tem as abas ISD e ICD/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
    expect(gravarSinapi).not.toHaveBeenCalled();
  });

  it("preço inválido aponta aba e linha e trava a importação", async () => {
    abas = planilha([["MATERIAL", 42425, "AR-CONDICIONADO", "UN", "CR", -5, 2175.13]]);
    const user = userEvent.setup();
    render(<SinapiImportacao />);
    await user.upload(screen.getByLabelText("Relatório do SINAPI"), arquivoQualquer());
    expect(await screen.findByText("Não gravamos nada enquanto houver erro.")).toBeInTheDocument();
    expect(screen.getByText(/Aba ISD, linha 8:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });

  it("falha ao abrir o arquivo avisa e segue sem prévia", async () => {
    leituraFalha = new Error("O arquivo passa de 30 MB.");
    const user = userEvent.setup();
    render(<SinapiImportacao />);
    await user.upload(screen.getByLabelText("Relatório do SINAPI"), arquivoQualquer());
    await waitFor(() => expect(toastErro).toHaveBeenCalled());
    expect(toastErro.mock.calls[0][1]).toEqual({ description: "O arquivo passa de 30 MB." });
    expect(screen.getByText("Nenhum SINAPI importado")).toBeInTheDocument();
  });

  it("mês já importado avisa que importar de novo corrige os preços", async () => {
    gravadas = [
      { codigo: 42425, uf: "SP", regime: "onerado", mes_base: "2026-09-01", created_at: "2026-10-10T10:00:00Z" },
    ];
    const user = userEvent.setup();
    render(<SinapiImportacao />);
    expect(screen.getByText("1 de 5")).toBeInTheDocument();
    await user.upload(screen.getByLabelText("Relatório do SINAPI"), arquivoQualquer());
    expect(await screen.findByText(/já foi importado/)).toBeInTheDocument();
  });

  it("lista os meses já importados", () => {
    gravadas = [
      { codigo: 42425, uf: "SP", regime: "onerado", mes_base: "2026-09-01", created_at: "2026-10-10T10:00:00Z" },
      { codigo: 42425, uf: "RJ", regime: "desonerado", mes_base: "2026-09-01", created_at: "2026-10-10T10:00:00Z" },
    ];
    render(<SinapiImportacao />);
    expect(screen.getByRole("heading", { name: "Meses importados" })).toBeInTheDocument();
    expect(screen.getAllByText("set/2026").length).toBeGreaterThan(1);
  });
});
