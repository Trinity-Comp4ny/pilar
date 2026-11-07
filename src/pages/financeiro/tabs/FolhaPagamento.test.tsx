import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sb } from "../testing/supabaseMock";

// Folha de pagamento: prévia do mês (total = fixo + área × valor/m²), edição de
// uma pessoa no preview, fechamento (payload gravado), marcar como pago (gera a
// despesa) e quem não pode editar.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException: vi.fn(), captureMessage: vi.fn() } }));
const gerarComprovantePDF = vi.fn();
vi.mock("./folha-pagamento/folhaComprovante", () => ({
  gerarComprovantePDF: (...a: unknown[]) => gerarComprovantePDF(...a),
  gerarLoteComprovantesPDF: vi.fn(),
}));
// A toolbar real vai por portal para o cabeçalho da página; aqui renderiza no lugar.
vi.mock("@/components/PageSlots", () => ({
  PageToolbar: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PageTabs: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
const acesso = { canEdit: true };
vi.mock("@/hooks/useFeatureAccess", () => ({
  useFeatureAccess: () => ({ canView: true, canEdit: acesso.canEdit, isViewerOnly: !acesso.canEdit, isAdmin: false }),
}));

import { toast } from "sonner";
import FolhaPagamento from "./FolhaPagamento";

const TZ_ORIGINAL = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Sao_Paulo";
});
afterAll(() => {
  process.env.TZ = TZ_ORIGINAL;
});

const preview = [
  // Ana: 5000 fixo + 320 m² × 2,50 = 5800
  { p_id: "p-ana", p_nome: "Ana Souza", p_cargo: "Engenheira", p_salario_fixo: 5000, p_valor_m2: 2.5, soma_area: 320 },
  // Bruno: só fixo
  { p_id: "p-bruno", p_nome: "Bruno Lima", p_cargo: "Projetista", p_salario_fixo: 3200.5, p_valor_m2: 0, soma_area: 0 },
];

const nbsp = (s: string | null) => (s ?? "").replace(/\u00a0/g, " ");

function setup() {
  const user = userEvent.setup();
  render(<FolhaPagamento />);
  return { user };
}

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  acesso.canEdit = true;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 22, 30));
  sb.rpcResultado("get_user_empresa_id", { data: "emp-1", error: null });
  sb.resultado("projetos.select", { data: [], error: null });
  sb.resultado("folha_pagamento.select", { data: [], error: null });
  sb.resultado("folha_pagamento.insert", { data: null, error: null });
  sb.rpcResultado("get_folha_preview", { data: preview, error: null });
});
afterEach(() => vi.useRealTimers());

async function linha(nome: string) {
  const cel = await screen.findByText(nome);
  return cel.closest("tr") as HTMLTableRowElement;
}

describe("FolhaPagamento: prévia", () => {
  it("calcula variável e total por pessoa e o total da folha", async () => {
    setup();
    const ana = await linha("Ana Souza");
    expect(nbsp(ana.textContent)).toContain("R$ 5.800,00");
    expect(sb.argsRpc("get_folha_preview")).toEqual({ p_mes: 11, p_ano: 2026 });
    const bruno = await linha("Bruno Lima");
    expect(nbsp(bruno.textContent)).toContain("R$ 3.200,50");
    // 5800 + 3200,50
    await waitFor(() => expect(nbsp(document.body.textContent)).toContain("R$ 9.000,50"));
  });

  it("mês sem ninguém mostra a mensagem de vazio e não oferece fechar", async () => {
    sb.rpcResultado("get_folha_preview", { data: [], error: null });
    setup();
    expect(await screen.findByText("Nenhum registro encontrado para este período.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fechar folha/ })).not.toBeInTheDocument();
  });

  it("erro ao carregar mostra o estado de erro e avisa", async () => {
    sb.rpcResultado("get_folha_preview", { data: null, error: { message: "x" } });
    setup();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao carregar dados"));
  });

  it("editar o salário no preview recalcula o total (não fica preso ao antigo)", async () => {
    const { user } = setup();
    await user.click(await screen.findByLabelText("Ver detalhes de Ana Souza"));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dlg = screen.getByRole("dialog");
    const [salario] = within(dlg).getAllByRole("spinbutton");
    await user.clear(salario);
    await user.type(salario, "6000");
    expect(within(dlg).queryByText(/Total ajustado manualmente/)).not.toBeInTheDocument();
    await user.click(within(dlg).getByRole("button", { name: "Salvar alterações" }));

    const ana = await linha("Ana Souza");
    // 6000 + 800 = 6800, marcado como editado
    expect(nbsp(ana.textContent)).toContain("R$ 6.800,00");
    expect(toast.success).toHaveBeenCalledWith("Alterações salvas no preview");
  });

  it("editar a área recalcula variável e total", async () => {
    const { user } = setup();
    await user.click(await screen.findByLabelText("Ver detalhes de Ana Souza"));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dlg = screen.getByRole("dialog");
    const [, area] = within(dlg).getAllByRole("spinbutton");
    await user.clear(area);
    await user.type(area, "100");
    await user.click(within(dlg).getByRole("button", { name: "Salvar alterações" }));
    const ana = await linha("Ana Souza");
    // 5000 + 100 × 2,50 = 5250
    expect(nbsp(ana.textContent)).toContain("R$ 5.250,00");
  });

  it("total ajustado à mão é respeitado e sinalizado", async () => {
    const { user } = setup();
    await user.click(await screen.findByLabelText("Ver detalhes de Ana Souza"));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dlg = screen.getByRole("dialog");
    const [, , total] = within(dlg).getAllByRole("spinbutton");
    await user.clear(total);
    await user.type(total, "6100");
    expect(within(dlg).getByText(/Total ajustado manualmente/)).toBeInTheDocument();
    await user.click(within(dlg).getByRole("button", { name: "Salvar alterações" }));
    expect(nbsp((await linha("Ana Souza")).textContent)).toContain("R$ 6.100,00");
  });
});

describe("FolhaPagamento: fechar o mês", () => {
  it("grava um registro por pessoa com os valores da prévia", async () => {
    const { user } = setup();
    await linha("Ana Souza");
    await user.click(screen.getByRole("button", { name: /Fechar folha/ }));
    const dlg = screen.getByRole("dialog");
    expect(nbsp(dlg.textContent)).toContain("2 pessoas, totalizando R$ 9.000,50");
    await user.click(within(dlg).getByRole("button", { name: /Confirmar fechamento/ }));

    await waitFor(() => expect(sb.de("folha_pagamento", "insert")).toHaveLength(1));
    const payload = sb.de("folha_pagamento", "insert")[0].args[0] as Array<Record<string, unknown>>;
    expect(payload).toEqual([
      expect.objectContaining({
        empresa_id: "emp-1",
        pessoa_id: "p-ana",
        mes: 11,
        ano: 2026,
        salario_fixo: 5000,
        total_area_projetada: 320,
        valor_m2: 2.5,
        adicional_variavel: 800,
        total_receber: 5800,
        status: "pendente",
      }),
      expect.objectContaining({ pessoa_id: "p-bruno", adicional_variavel: 0, total_receber: 3200.5 }),
    ]);
    expect(toast.success).toHaveBeenCalledWith("Folha fechada com sucesso!", {
      description: "Os registros para Novembro/2026 foram salvos.",
    });
  });

  it("erro ao fechar avisa", async () => {
    sb.resultado("folha_pagamento.insert", { data: null, error: { message: "duplicate" } });
    const { user } = setup();
    await linha("Ana Souza");
    await user.click(screen.getByRole("button", { name: /Fechar folha/ }));
    await user.click(screen.getByRole("button", { name: /Confirmar fechamento/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao fechar folha"));
  });

  it("sem permissão de edição não oferece fechar", async () => {
    acesso.canEdit = false;
    setup();
    await linha("Ana Souza");
    expect(screen.queryByRole("button", { name: /Fechar folha/ })).not.toBeInTheDocument();
  });
});

describe("FolhaPagamento: mês fechado", () => {
  const fechada = [
    {
      id: "f-ana",
      pessoa_id: "p-ana",
      mes: 11,
      ano: 2026,
      salario_fixo: 5000,
      valor_m2: 2.5,
      total_area_projetada: 320,
      adicional_variavel: 800,
      total_receber: 5800,
      status: "pendente",
      data_pagamento: null,
    },
  ];

  beforeEach(() => {
    sb.resultado("folha_pagamento.select", { data: fechada, error: null });
    sb.resultado("pessoas.select", { data: [{ id: "p-ana", nome: "Ana Souza", cargo: "Engenheira" }], error: null });
    sb.resultado("folha_pagamento.update", { data: null, error: null });
    sb.resultado("categorias_financeiras.select", {
      data: [{ id: "cat-folha", nome: "Folha de Pagamento" }],
      error: null,
    });
    sb.resultado("despesas.select", { data: null, error: null });
    sb.resultado("despesas.insert", { data: null, error: null });
  });

  it("marcar como pago gera a despesa da folha com data local de hoje", async () => {
    const { user } = setup();
    const ana = await linha("Ana Souza");
    expect(screen.getByText("Folha fechada")).toBeInTheDocument();
    await user.click(within(ana).getByRole("button", { name: /pendente/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Marcar como pago" }));

    await waitFor(() => expect(sb.de("despesas", "insert")).toHaveLength(1));
    expect(sb.de("folha_pagamento", "update")[0].args[0]).toEqual({ status: "pago" });
    const [despesa] = sb.de("despesas", "insert")[0].args[0] as Array<Record<string, unknown>>;
    expect(despesa).toMatchObject({
      descricao: "Folha de Pagamento Novembro/2026 - Ana Souza",
      valor: 5800,
      status: "Pago",
      categoria_id: "cat-folha",
      data_vencimento: "2026-11-10",
      data_pagamento: "2026-11-10",
    });
    expect(toast.success).toHaveBeenCalledWith("Status atualizado", expect.anything());
  });

  it("despesa da folha que já existe não é duplicada (nem com duplicata antiga)", async () => {
    sb.resultado("despesas.select", { data: [{ id: "d-ja" }], error: null });
    const { user } = setup();
    const ana = await linha("Ana Souza");
    await user.click(within(ana).getByRole("button", { name: /pendente/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Marcar como pago" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(sb.de("despesas", "insert")).toHaveLength(0);
    expect(sb.de("despesas", "limit")[0].args).toEqual([1]);
    expect(sb.de("despesas", "maybeSingle")).toHaveLength(0);
  });

  describe("voltar de pago para pendente", () => {
    const paga = [{ ...fechada[0], status: "pago", data_pagamento: "2026-11-05" }];

    it("exclui (soft) a despesa gerada no pagamento", async () => {
      sb.resultado("folha_pagamento.select", { data: paga, error: null });
      sb.resultado("despesas.select", { data: [{ id: "d-folha" }], error: null });
      const { user } = setup();
      const ana = await linha("Ana Souza");
      await user.click(within(ana).getByRole("button", { name: /pago/ }));
      await user.click(await screen.findByRole("menuitem", { name: /pendente/i }));

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Status atualizado", expect.anything()));
      expect(sb.de("folha_pagamento", "update")[0].args[0]).toEqual({ status: "pendente" });
      expect(sb.de("despesas", "eq").map((c) => c.args)).toEqual([
        ["descricao", "Folha de Pagamento Novembro/2026 - Ana Souza"],
        ["valor", 5800],
        ["observacao", "Lançamento automático de Folha de Pagamento"],
      ]);
      expect(sb.argsRpc("rpc_soft_delete")).toEqual({ p_tabela: "despesas", p_id: "d-folha" });
      expect(sb.de("despesas", "delete")).toHaveLength(0);
      expect(sb.de("despesas", "insert")).toHaveLength(0);
    });

    it("falha ao excluir a despesa devolve a folha para pago", async () => {
      sb.resultado("folha_pagamento.select", { data: paga, error: null });
      sb.resultado("despesas.select", { data: [{ id: "d-folha" }], error: null });
      sb.rpcResultado("rpc_soft_delete", { data: null, error: { message: "Registro não encontrado" } });
      const { user } = setup();
      const ana = await linha("Ana Souza");
      await user.click(within(ana).getByRole("button", { name: /pago/ }));
      await user.click(await screen.findByRole("menuitem", { name: /pendente/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "Erro ao atualizar status. A alteração foi revertida, tente novamente."
        )
      );
      const updates = sb.de("folha_pagamento", "update").map((c) => c.args[0]);
      expect(updates).toEqual([{ status: "pendente" }, { status: "pago" }]);
    });
  });

  it("falha ao gerar a despesa reverte o status da folha", async () => {
    sb.resultado("despesas.insert", { data: null, error: { message: "rls" } });
    const { user } = setup();
    const ana = await linha("Ana Souza");
    await user.click(within(ana).getByRole("button", { name: /pendente/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Marcar como pago" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Erro ao atualizar status. A alteração foi revertida, tente novamente.")
    );
    const updates = sb.de("folha_pagamento", "update").map((c) => c.args[0]);
    expect(updates).toEqual([{ status: "pago" }, { status: "pendente" }]);
  });

  it("baixar comprovante busca CPF/PIX sob demanda e lê o formato do cadastro", async () => {
    sb.rpcResultado("get_folha_pessoas_pii", {
      data: [{ pessoa_id: "p-ana", cpf: "123.456.789-00", chaves_pix: [{ chave: "ana@x.com", tipo: "email" }] }],
      error: null,
    });
    const { user } = setup();
    await linha("Ana Souza");
    await user.click(screen.getByRole("button", { name: "Baixar comprovante de Ana Souza" }));
    await waitFor(() => expect(gerarComprovantePDF).toHaveBeenCalled());
    expect(gerarComprovantePDF.mock.calls[0][0]).toMatchObject({
      p_cpf: "123.456.789-00",
      p_chave_pix: "ana@x.com",
      v_total: 5800,
    });
  });
});
