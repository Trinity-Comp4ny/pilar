import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parametrosDaMigration } from "@/test/estimativaFixtures";
import { ParametrosEstimativa } from "./ParametrosEstimativa";

/**
 * Parâmetros do motor (SPEC 136, ADR 0063): enquanto não validados, a tela avisa; validar e desfazer
 * passam por confirmação, e o banco só aceita do ultra admin com o segundo fator.
 */

let validadoEm: string | null = null;
let falha = false;

const { validarParametros } = vi.hoisted(() => ({ validarParametros: vi.fn(async (..._a: unknown[]) => {}) }));

vi.mock("../estimativaAdmin", () => ({
  useParametrosEstimativa: () => ({
    data: falha ? undefined : { parametros: parametrosDaMigration(), validadoEm, atualizadoEm: "2026-10-19T12:00:00Z" },
    isLoading: false,
    error: falha ? new Error("sem permissão") : null,
    refetch: vi.fn(),
  }),
  validarParametros,
}));

vi.mock("../hooks", () => ({
  useAcaoEmpresa: (opts: { run: (e: never) => Promise<unknown> }) => ({
    mutate: (entrada: never, callbacks?: { onSettled?: () => void }) => {
      void opts.run(entrada).finally(() => callbacks?.onSettled?.());
    },
    isPending: false,
  }),
}));

beforeEach(() => {
  validadoEm = null;
  falha = false;
  validarParametros.mockClear();
});

describe("ParametrosEstimativa", () => {
  it("em validação: avisa que PDF e anexo ficam desligados e mostra os valores", () => {
    render(<ParametrosEstimativa />);
    expect(screen.getByText(/Parâmetros em validação/)).toBeInTheDocument();
    expect(screen.getByText(/PDF e o anexo à proposta ficam desligados/)).toBeInTheDocument();
    expect(screen.getByText("Estrutura")).toBeInTheDocument();
    expect(screen.getByText("18%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.500 por m²")).toBeInTheDocument();
  });

  it("validar pede confirmação antes de gravar", async () => {
    const user = userEvent.setup();
    render(<ParametrosEstimativa />);
    await user.click(screen.getByRole("button", { name: "Marcar como validados" }));
    expect(validarParametros).not.toHaveBeenCalled();
    expect(await screen.findByText("Marcar os parâmetros como validados?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Validar parâmetros" }));
    await waitFor(() => expect(validarParametros).toHaveBeenCalledWith(true));
  });

  it("cancelar a confirmação não grava nada", async () => {
    const user = userEvent.setup();
    render(<ParametrosEstimativa />);
    await user.click(screen.getByRole("button", { name: "Marcar como validados" }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(validarParametros).not.toHaveBeenCalled();
  });

  it("validado: mostra a data, libera PDF e anexo e deixa desfazer, com confirmação", async () => {
    validadoEm = "2026-11-02T15:00:00Z";
    const user = userEvent.setup();
    render(<ParametrosEstimativa />);
    expect(screen.getByText(/Parâmetros validados/)).toBeInTheDocument();
    expect(screen.queryByText(/Parâmetros em validação/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Desfazer a validação" }));
    expect(await screen.findByText("Desfazer a validação?")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Desfazer a validação" }).at(-1)!);
    await waitFor(() => expect(validarParametros).toHaveBeenCalledWith(false));
  });

  it("falha ao carregar mostra o motivo e oferece tentar de novo", () => {
    falha = true;
    render(<ParametrosEstimativa />);
    expect(screen.getByText("Não foi possível carregar os parâmetros")).toBeInTheDocument();
    expect(screen.getByText("sem permissão")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});
