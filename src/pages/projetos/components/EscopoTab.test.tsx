import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EscopoRow, OrcamentoFaseRow } from "@/hooks/useEscopos";

// Aba Escopo (specs 081/083): orçamento por disciplina editável e aditivos com
// aprovar/rejeitar sob confirmação. Sem permissão de edição, só leitura.

const salvarFase = vi.fn();
const aprovar = vi.fn();
const rejeitar = vi.fn();
let escopos: EscopoRow[] = [];
let fases: OrcamentoFaseRow[] = [];
let carregando = false;

vi.mock("@/hooks/useEscopos", () => ({
  useEscopos: () => ({ data: escopos, isLoading: carregando }),
  useOrcamentoFases: () => ({ data: fases, isLoading: false }),
  useSalvarOrcamentoFase: () => ({ mutateAsync: salvarFase, isPending: false }),
  useAprovarEscopo: () => ({ mutateAsync: aprovar, isPending: false }),
  useRejeitarEscopo: () => ({ mutateAsync: rejeitar, isPending: false }),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { EscopoTab } from "./EscopoTab";

const aditivo = (over: Partial<EscopoRow> = {}) =>
  ({
    id: "esc-1",
    projeto_id: "proj-1",
    tipo: "aditivo",
    status: "pendente_aprovacao",
    descricao: "Aditivo de fundações",
    justificativa: "Solo pior que o previsto",
    valor_aditivo: 15000,
    custo_estimado: 9000,
    pode_ver_valor: true,
    created_by: "u1",
    created_at: "2026-10-01T10:00:00Z",
    escopo_itens: [],
    ...over,
  }) as unknown as EscopoRow;

describe("EscopoTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    escopos = [];
    fases = [];
    carregando = false;
    salvarFase.mockResolvedValue(undefined);
    aprovar.mockResolvedValue(undefined);
    rejeitar.mockResolvedValue(undefined);
  });

  it("sem disciplinas e sem aditivos mostra os dois estados vazios", () => {
    render(<EscopoTab projetoId="proj-1" canEdit disciplinas={[]} />);
    expect(screen.getByText(/ainda não tem disciplinas cadastradas/)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum aditivo por aqui ainda/)).toBeInTheDocument();
  });

  it("carregando não mostra conteúdo", () => {
    carregando = true;
    render(<EscopoTab projetoId="proj-1" canEdit disciplinas={["Estrutural"]} />);
    expect(screen.queryByText("Orçamento por disciplina")).not.toBeInTheDocument();
  });

  it("linha de orçamento só mostra Salvar depois de editar e grava horas e custo", async () => {
    fases = [{ disciplina: "Estrutural", horas_estimadas: 10, custo_hora: 100, custo_estimado: 1000 }];
    render(<EscopoTab projetoId="proj-1" canEdit disciplinas={["Estrutural"]} />);
    expect(screen.queryByRole("button", { name: /Salvar/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Horas estimadas — Estrutural"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Orçamento de Estrutural atualizado"));
    expect(salvarFase).toHaveBeenCalledWith({ disciplina: "Estrutural", horasEstimadas: 25, custoHora: 100 });
  });

  it("horas inválidas (vazio) gravam zero, não NaN", async () => {
    fases = [{ disciplina: "MEP", horas_estimadas: 10, custo_hora: 50, custo_estimado: 500 }];
    render(<EscopoTab projetoId="proj-1" canEdit disciplinas={["MEP"]} />);
    fireEvent.change(screen.getByLabelText("Horas estimadas — MEP"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(salvarFase).toHaveBeenCalledWith(expect.objectContaining({ horasEstimadas: 0 })));
  });

  it("erro ao salvar orçamento avisa e mantém o valor digitado", async () => {
    salvarFase.mockRejectedValueOnce(new Error("x"));
    render(<EscopoTab projetoId="proj-1" canEdit disciplinas={["Civil"]} />);
    fireEvent.change(screen.getByLabelText("Horas estimadas — Civil"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar o orçamento de Civil"));
    expect(screen.getByLabelText("Horas estimadas — Civil")).toHaveValue(8);
  });

  it("sem permissão: campos travados e nenhum botão de aprovar/rejeitar", () => {
    escopos = [aditivo()];
    render(<EscopoTab projetoId="proj-1" canEdit={false} disciplinas={["Civil"]} />);
    expect(screen.getByLabelText("Horas estimadas — Civil")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rejeitar" })).not.toBeInTheDocument();
  });

  it("sem acesso ao financeiro não aprova: avisa quem aprova", () => {
    escopos = [aditivo({ pode_ver_valor: false, valor_aditivo: null })];
    render(<EscopoTab projetoId="proj-1" canEdit disciplinas={[]} />);
    expect(screen.getByText(/A aprovação fica com quem tem acesso ao financeiro/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
  });

  it("aditivo já aprovado não oferece ações", () => {
    escopos = [aditivo({ status: "aprovado" })];
    render(<EscopoTab projetoId="proj-1" canEdit disciplinas={[]} />);
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
  });

  it("aprovar pede confirmação e só grava ao confirmar", async () => {
    escopos = [aditivo()];
    render(<EscopoTab projetoId="proj-1" canEdit disciplinas={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    expect(screen.getByText("Aprovar aditivo")).toBeInTheDocument();
    expect(aprovar).not.toHaveBeenCalled();

    const botoes = screen.getAllByRole("button", { name: "Aprovar" });
    fireEvent.click(botoes[botoes.length - 1]);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Aditivo aprovado — contrato e orçamento atualizados")
    );
    expect(aprovar).toHaveBeenCalledWith({ escopoId: "esc-1", projetoId: "proj-1" });
  });

  it("cancelar a confirmação de aprovar não grava", () => {
    escopos = [aditivo()];
    render(<EscopoTab projetoId="proj-1" canEdit disciplinas={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(aprovar).not.toHaveBeenCalled();
  });

  it("falha ao aprovar avisa erro", async () => {
    aprovar.mockRejectedValueOnce(new Error("x"));
    escopos = [aditivo()];
    render(<EscopoTab projetoId="proj-1" canEdit disciplinas={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    const botoes = screen.getAllByRole("button", { name: "Aprovar" });
    fireEvent.click(botoes[botoes.length - 1]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível aprovar o aditivo"));
  });

  it("rejeitar confirma e grava; falha avisa", async () => {
    escopos = [aditivo()];
    render(<EscopoTab projetoId="proj-1" canEdit disciplinas={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));
    expect(screen.getByText("Rejeitar aditivo")).toBeInTheDocument();
    const botoes = screen.getAllByRole("button", { name: "Rejeitar" });
    fireEvent.click(botoes[botoes.length - 1]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Aditivo rejeitado"));
    expect(rejeitar).toHaveBeenCalledWith({ escopoId: "esc-1", projetoId: "proj-1" });

    rejeitar.mockRejectedValueOnce(new Error("x"));
    fireEvent.click(screen.getAllByRole("button", { name: "Rejeitar" })[0]);
    const de_novo = screen.getAllByRole("button", { name: "Rejeitar" });
    fireEvent.click(de_novo[de_novo.length - 1]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível rejeitar o aditivo"));
  });
});
