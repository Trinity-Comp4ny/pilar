import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sb } from "@/pages/financeiro/testing/supabaseMock";

// Faturamento depois de converter a proposta em projeto: parcelas mensais
// (última absorve o arredondamento), por marcos do projeto ou manual.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { SmartInvoiceDialog } from "./SmartInvoiceDialog";

const marcos = [
  { id: "m1", nome: "Anteprojeto", valor: 3000, data_prevista: "2026-12-10", status: "Previsto", receita_id: null },
  { id: "m2", nome: "Executivo", valor: 7000, data_prevista: null, status: "Previsto", receita_id: "rec-old" },
];

function setup(valor = 1000) {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SmartInvoiceDialog open onClose={onClose} projetoId="proj-1" propostaValor={valor} propostaNome="Casa Verde" />
    </QueryClientProvider>
  );
  return { onClose };
}

const linhasPreview = () => within(screen.getAllByRole("table")[0]).getAllByRole("row").slice(1);

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 0, 31, 12));
  sb.rpcResultado("get_user_empresa_id", { data: "emp-1", error: null });
  sb.resultado("marcos_faturamento.select", { data: marcos, error: null });
  sb.resultado("receitas.insert", { data: [{ id: "r1" }, { id: "r2" }], error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SmartInvoiceDialog: parcelas", () => {
  it("à vista: uma parcela com o valor cheio", () => {
    setup();
    expect(linhasPreview()).toHaveLength(1);
    expect(linhasPreview()[0]).toHaveTextContent(/1\s*31\/01\/2026\s*R\$\s?1\.000,00/);
    expect(screen.getByRole("button", { name: "Confirmar (1 parcela)" })).toBeEnabled();
  });

  it("divide em 3 com a última absorvendo o arredondamento e vencimentos mensais", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Quantidade de parcelas"), { target: { value: "3" } });
    const linhas = linhasPreview();
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toHaveTextContent(/R\$\s?333,33/);
    expect(linhas[1]).toHaveTextContent(/R\$\s?333,33/);
    expect(linhas[2]).toHaveTextContent(/R\$\s?333,34/);
    // 31/01 + 1 mês cai no último dia de fevereiro
    expect(linhas[1]).toHaveTextContent("28/02/2026");
    expect(screen.getByRole("button", { name: "Confirmar (3 parcelas)" })).toBeInTheDocument();
  });

  it("quantidade fica entre 1 e 60", () => {
    setup();
    const qtd = screen.getByLabelText("Quantidade de parcelas");
    fireEvent.change(qtd, { target: { value: "0" } });
    expect(qtd).toHaveValue(1);
    fireEvent.change(qtd, { target: { value: "500" } });
    expect(qtd).toHaveValue(60);
    fireEvent.change(qtd, { target: { value: "abc" } });
    expect(qtd).toHaveValue(1);
  });

  it("cria as receitas parceladas no mesmo grupo e fecha", async () => {
    const { onClose } = setup(1000);
    fireEvent.change(screen.getByLabelText("Quantidade de parcelas"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar (2 parcelas)" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const rows = sb.de("receitas", "insert")[0].args[0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      descricao: "Casa Verde (1/2)",
      valor: 500,
      data_vencimento: "2026-01-31",
      status: "Pendente",
      empresa_id: "emp-1",
      projeto_id: "proj-1",
      parcela_numero: 1,
      parcela_total: 2,
    });
    expect(rows[1]).toMatchObject({ descricao: "Casa Verde (2/2)", data_vencimento: "2026-02-28", parcela_numero: 2 });
    expect(rows[0].grupo_parcela).toBeTruthy();
    expect(rows[1].grupo_parcela).toBe(rows[0].grupo_parcela);
    expect(toast.success).toHaveBeenCalledWith("Faturas criadas com sucesso");
  });

  it("à vista não preenche grupo de parcela", async () => {
    const { onClose } = setup(1000);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar (1 parcela)" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sb.de("receitas", "insert")[0].args[0]).toEqual([
      expect.objectContaining({
        descricao: "Casa Verde",
        grupo_parcela: null,
        parcela_numero: null,
        parcela_total: null,
      }),
    ]);
  });

  it("proposta sem valor não deixa confirmar", () => {
    setup(0);
    expect(screen.getByRole("button", { name: "Confirmar (1 parcela)" })).toBeDisabled();
  });

  it("usuário sem empresa: não insere e avisa o erro", async () => {
    sb.rpcResultado("get_user_empresa_id", { data: null, error: null });
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar (1 parcela)" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith("Não foi possível criar as faturas", expect.anything());
    expect(sb.de("receitas", "insert")).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("erro do banco ao inserir mantém o diálogo aberto e avisa", async () => {
    sb.resultado("receitas.insert", { data: null, error: { message: "new row violates row-level security policy" } });
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar (1 parcela)" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível criar as faturas", {
        description: "Você não tem permissão para realizar esta ação.",
      })
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("SmartInvoiceDialog: marcos", () => {
  const escolherMarcos = () => fireEvent.click(screen.getByRole("radio", { name: /Por marcos do projeto/ }));

  it("lista os marcos do projeto e sinaliza o que já tem receita", async () => {
    setup();
    escolherMarcos();
    expect(await screen.findByText("Anteprojeto")).toBeInTheDocument();
    const linhaExecutivo = screen.getByText("Executivo").closest("tr") as HTMLElement;
    expect(within(linhaExecutivo).getByText("Vinculado")).toBeInTheDocument();
    const linhaAnte = screen.getByText("Anteprojeto").closest("tr") as HTMLElement;
    expect(within(linhaAnte).queryByText("Vinculado")).not.toBeInTheDocument();
    expect(sb.de("marcos_faturamento", "eq")[0].args).toEqual(["projeto_id", "proj-1"]);
    expect(screen.getByRole("button", { name: "Confirmar (0 marcos)" })).toBeDisabled();
  });

  it("sem marcos cadastrados orienta a cadastrar", async () => {
    sb.resultado("marcos_faturamento.select", { data: [], error: null });
    setup();
    escolherMarcos();
    expect(await screen.findByText(/Nenhum marco cadastrado neste projeto/)).toBeInTheDocument();
  });

  it("erro ao buscar marcos cai no estado vazio", async () => {
    sb.resultado("marcos_faturamento.select", { data: null, error: { message: "boom" } });
    setup();
    escolherMarcos();
    expect(await screen.findByText(/Nenhum marco cadastrado neste projeto/)).toBeInTheDocument();
  });

  it("cria uma receita por marco marcado e vincula o marco", async () => {
    const { onClose } = setup();
    escolherMarcos();
    fireEvent.click(await screen.findByText("Anteprojeto"));
    fireEvent.click(screen.getByText("Executivo"));
    // clicar de novo na linha desmarca; marcar outra vez
    fireEvent.click(screen.getByText("Executivo"));
    expect(screen.getByRole("button", { name: "Confirmar (1 marco)" })).toBeEnabled();
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar (2 marcos)" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const rows = sb.de("receitas", "insert")[0].args[0] as Array<Record<string, unknown>>;
    expect(rows).toEqual([
      expect.objectContaining({ descricao: "Casa Verde — Anteprojeto", valor: 3000, data_vencimento: "2026-12-10" }),
      // marco sem data prevista vence hoje
      expect.objectContaining({ descricao: "Casa Verde — Executivo", valor: 7000, data_vencimento: "2026-01-31" }),
    ]);
    const updates = sb.de("marcos_faturamento", "update").map((c) => c.args[0]);
    expect(updates).toEqual([{ receita_id: "r1" }, { receita_id: "r2" }]);
  });
});

describe("SmartInvoiceDialog: manual", () => {
  it("só fecha, sem criar nada", () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("radio", { name: /Vou criar manualmente/ }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Fechar" }).find((b) => b.textContent === "Fechar") as HTMLElement
    );
    expect(onClose).toHaveBeenCalled();
    expect(sb.de("receitas", "insert")).toHaveLength(0);
  });

  it("cancelar fecha", () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
  });
});
