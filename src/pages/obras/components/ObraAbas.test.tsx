import { cloneElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";
import type { ObraResumo } from "@/pages/obras/hooks/useObras";
import type { ObraLancamentoRow } from "@/pages/obras/hooks/useObraConta";
import type { ObraOrcamentoRow } from "@/pages/obras/hooks/useObraOrcamento";

// Abas da obra que leem do banco: estoque, cotações, acessos de campo, visão (timeline +
// Curva S), a fila de cotações pendentes e o gráfico de desembolso. Estado vazio, sem
// permissão de edição, exclusão com confirmação e erro do servidor.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
// O gráfico real precisa de layout; aqui o container tem tamanho fixo para os filhos renderizarem.
vi.mock("recharts", async (original) => {
  const mod = await original<typeof import("recharts")>();
  return {
    ...mod,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      cloneElement(children, { width: 600, height: 240 }),
  };
});

Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { ObraEstoqueTab } from "./ObraEstoqueTab";
import { ObraCotacoesTab } from "./ObraCotacoesTab";
import { ObraAcessosTab } from "./ObraAcessosTab";
import { ObraTimelineTab } from "./ObraTimelineTab";
import { ObraCurvaS } from "./ObraCurvaS";
import { FilaCotacoesPendentes } from "./FilaCotacoesPendentes";
import { ObraDesembolsoChart } from "./ObraDesembolsoChart";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}
const renderiza = (ui: React.ReactElement) => render(ui, { wrapper: wrapper() });

type Tabelas = Record<string, unknown>;
function responderComTabelas(t: Tabelas) {
  fake.responder((c) => (c.op === "select" && c.tabela in t ? { data: t[c.tabela], error: null } : undefined));
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  rpcComEmpresa();
});

describe("ObraEstoqueTab", () => {
  const materiais = [
    {
      id: "mat-1",
      nome: "Cimento",
      unidade: "sc",
      categoria: "Básico",
      deleted_at: null,
      movimentos: [
        { id: "mv-1", tipo: "entrada", quantidade: 10, data: "2026-11-01", valor_unitario: 40, obra_frente_id: "et-1", deleted_at: null },
        { id: "mv-2", tipo: "baixa", quantidade: 4, data: "2026-11-03", valor_unitario: null, obra_frente_id: null, deleted_at: null },
      ],
    },
    { id: "mat-2", nome: "Areia", unidade: "m³", categoria: null, deleted_at: null, movimentos: [] },
  ];

  it("vazio com edição oferece registrar movimento", async () => {
    renderiza(<ObraEstoqueTab obraId="obra-1" canEdit />);
    expect(await screen.findByText("Nenhum material ainda")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar movimento" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("vazio sem edição não oferece ação", async () => {
    renderiza(<ObraEstoqueTab obraId="obra-1" canEdit={false} />);
    expect(await screen.findByText("Nenhum material ainda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar movimento" })).not.toBeInTheDocument();
  });

  it("mostra saldo, valor parado e o nome da etapa no movimento", async () => {
    responderComTabelas({
      obra_material: materiais,
      obra_frente: [{ id: "et-1", nivel: "etapa", nome: "Fundação", parent_id: null, ordem: 1, created_at: "x" }],
    });
    renderiza(<ObraEstoqueTab obraId="obra-1" canEdit />);
    expect(await screen.findByText("Cimento")).toBeInTheDocument();
    expect(screen.getByText("Comprado ainda não aplicado")).toBeInTheDocument();
    expect(screen.getByText(/Saldo 6,000 sc/)).toBeInTheDocument();
    expect(await screen.findByText(/Fundação/)).toBeInTheDocument();
    expect(screen.getByText("Entrada 10,000 sc")).toBeInTheDocument();
    expect(screen.getByText("Baixa 4,000 sc")).toBeInTheDocument();
  });

  it("sem edição esconde as ações por material", async () => {
    responderComTabelas({ obra_material: materiais });
    renderiza(<ObraEstoqueTab obraId="obra-1" canEdit={false} />);
    expect(await screen.findByText("Cimento")).toBeInTheDocument();
    expect(screen.queryByTitle("Excluir material")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Registrar movimento/ })).not.toBeInTheDocument();
  });

  it("excluir material pede confirmação e usa o soft delete", async () => {
    responderComTabelas({ obra_material: materiais });
    renderiza(<ObraEstoqueTab obraId="obra-1" canEdit />);
    fireEvent.click((await screen.findAllByTitle("Excluir material"))[0]);
    expect(await screen.findByText("Excluir material?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(fake.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "obra_material", p_id: "mat-1" })
    );
  });

  it("excluir movimento pede confirmação", async () => {
    responderComTabelas({ obra_material: materiais });
    renderiza(<ObraEstoqueTab obraId="obra-1" canEdit />);
    const linha = (await screen.findByText("Baixa 4,000 sc")).closest("li") as HTMLElement;
    const [, excluir] = within(linha).getAllByRole("button");
    fireEvent.click(excluir);
    expect(await screen.findByText("Excluir movimento?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(fake.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "obra_material_mov", p_id: "mv-2" })
    );
  });

  it("editar movimento e lançar no material abrem o diálogo", async () => {
    responderComTabelas({ obra_material: materiais });
    renderiza(<ObraEstoqueTab obraId="obra-1" canEdit />);
    const linha = (await screen.findByText("Entrada 10,000 sc")).closest("li") as HTMLElement;
    fireEvent.click(within(linha).getAllByRole("button")[0]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getAllByTitle("Registrar movimento deste material")[1]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

describe("ObraCotacoesTab", () => {
  const cotacoes = [
    {
      id: "cot-1",
      descricao: "Aço CA-50",
      status: "aberta",
      tipo: "item",
      quantidade: 2,
      unidade: "t",
      obra_frente_id: "et-1",
      prazo_necessidade: "2026-12-01",
      proposta_vencedora_id: null,
      propostas: [
        { id: "p-1", valor: 9000, deleted_at: null, fornecedor: { id: "f", nome: "Gerdau" }, itens: [] },
        { id: "p-2", valor: 8500, deleted_at: null, fornecedor_nome: "Loja", itens: [] },
      ],
    },
    { id: "cot-2", descricao: "Brita", status: "decidida", tipo: "item", quantidade: null, propostas: [] },
  ];

  it("vazio oferece nova cotação", async () => {
    renderiza(<ObraCotacoesTab obraId="obra-1" canEdit />);
    expect(await screen.findByText("Nenhuma cotação ainda")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nova cotação" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("lista com menor valor, detalhes e 'Sem detalhes'", async () => {
    responderComTabelas({
      obra_cotacao: cotacoes,
      obra_frente: [{ id: "et-1", nivel: "etapa", nome: "Estrutura", parent_id: null, ordem: 1, created_at: "x" }],
    });
    renderiza(<ObraCotacoesTab obraId="obra-1" canEdit />);
    expect(await screen.findByText("Aço CA-50")).toBeInTheDocument();
    expect(screen.getByText(/2 propostas/)).toBeInTheDocument();
    expect(screen.getByText(/menor R\$/)).toBeInTheDocument();
    expect(screen.getByText("Sem detalhes")).toBeInTheDocument();
    expect(screen.getByText("Sem propostas")).toBeInTheDocument();
    expect(await screen.findByText(/2 t · Estrutura · até/)).toBeInTheDocument();
  });

  it("clicar no card abre o detalhe", async () => {
    responderComTabelas({ obra_cotacao: cotacoes });
    renderiza(<ObraCotacoesTab obraId="obra-1" canEdit={false} />);
    fireEvent.click(await screen.findByText("Aço CA-50"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByText("Gerdau")).toBeInTheDocument();
  });

  it("excluir cotação pede confirmação; editar abre o formulário", async () => {
    responderComTabelas({ obra_cotacao: cotacoes });
    renderiza(<ObraCotacoesTab obraId="obra-1" canEdit />);
    const card = (await screen.findByText("Brita")).closest(".rounded-2xl") as HTMLElement;
    const [editar, excluir] = within(card).getAllByRole("button");
    fireEvent.click(excluir);
    expect(await screen.findByText("Excluir cotação?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(fake.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "obra_cotacao", p_id: "cot-2" })
    );
    fireEvent.click(editar);
    expect(await screen.findByDisplayValue("Brita")).toBeInTheDocument();
  });
});

describe("ObraAcessosTab", () => {
  it("vazio oferece criar acesso", async () => {
    renderiza(<ObraAcessosTab obraId="obra-1" canEdit />);
    expect(await screen.findByText("Ninguém tem acesso de campo ainda")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Criar acesso" })[0]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("lista status e revoga só os ativos", async () => {
    rpcComEmpresa({
      campo_listar_contas_obra: {
        data: [
          { id: "a-1", nome: "Zé", email: "ze@x", login_gerado: false, ativo: true, convite_pendente: false, ultimo_acesso: "2026-11-01T10:00:00Z" },
          { id: "a-2", nome: "Tião", email: null, login_gerado: true, ativo: true, convite_pendente: true, ultimo_acesso: null },
          { id: "a-3", nome: "Rui", email: "rui@x", login_gerado: false, ativo: false, convite_pendente: false, ultimo_acesso: null },
        ],
        error: null,
      },
    });
    renderiza(<ObraAcessosTab obraId="obra-1" canEdit />);
    expect(await screen.findByText("Zé")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Convite pendente")).toBeInTheDocument();
    expect(screen.getByText("Revogado")).toBeInTheDocument();
    expect(screen.getByText("Sem e-mail (login inventado)")).toBeInTheDocument();
    expect(screen.getByText(/Último acesso/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Revogar" })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Revogar" })[0]);
    expect(await screen.findByText("Revogar acesso de campo?")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Revogar" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Acesso revogado"));
    expect(fake.rpc).toHaveBeenCalledWith("campo_revogar_acesso", { p_account_id: "a-1" });
  });

  it("erro ao revogar mostra o motivo", async () => {
    rpcComEmpresa({
      campo_listar_contas_obra: {
        data: [{ id: "a-1", nome: "Zé", email: "z", login_gerado: false, ativo: true, convite_pendente: false }],
        error: null,
      },
      campo_revogar_acesso: { data: null, error: new Error("sem permissão") },
    });
    renderiza(<ObraAcessosTab obraId="obra-1" canEdit />);
    fireEvent.click(await screen.findByRole("button", { name: "Revogar" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Revogar" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível revogar", { description: "sem permissão" })
    );
  });

  it("sem edição não mostra criar nem revogar", async () => {
    rpcComEmpresa({
      campo_listar_contas_obra: {
        data: [{ id: "a-1", nome: "Zé", email: "z", login_gerado: false, ativo: true, convite_pendente: false }],
        error: null,
      },
    });
    renderiza(<ObraAcessosTab obraId="obra-1" canEdit={false} />);
    expect(await screen.findByText("Zé")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Criar acesso|Revogar/ })).not.toBeInTheDocument();
  });
});

describe("ObraTimelineTab", () => {
  const obra = { id: "obra-1", nome: "Casa", avanco: 40, projeto_id: null } as unknown as ObraResumo;

  it("obra nova: sem fases, sem diário e sem projeto", async () => {
    const irDiario = vi.fn();
    renderiza(<ObraTimelineTab obra={obra} onIrParaDiario={irDiario} />);
    expect(await screen.findByText(/Nenhuma fase ainda/)).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("0 de 0 tarefas concluídas")).toBeInTheDocument();
    expect(screen.getByText(/não está ligada a um projeto/)).toBeInTheDocument();
    expect(screen.getByText(/Defina prazo nas tarefas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar dia" }));
    expect(irDiario).toHaveBeenCalled();
  });

  it("com projeto, fases, diário e marcos", async () => {
    responderComTabelas({
      obra_frente: [
        { id: "f-1", nivel: "fase", nome: "Estrutura", parent_id: null, ordem: 1, created_at: "x" },
        { id: "f-2", nivel: "fase", nome: "Acabamento", parent_id: null, ordem: 2, created_at: "x" },
      ],
      tarefas: [
        { id: "t-1", created_at: "2026-10-01", titulo: "t-1", status: "concluida", obra_frente_id: "f-1", prazo: null },
        { id: "t-2", created_at: "2026-10-02", titulo: "t-2", status: "pendente", obra_frente_id: "f-1", prazo: null },
        { id: "t-3", created_at: "2026-10-03", titulo: "t-3", status: "pendente", obra_frente_id: "f-1", prazo: null },
      ],
      obra_rdo: [{ id: "r-1", data: "2026-11-01", clima: "sol" }],
      marcos_faturamento: [
        { id: "m-1", nome: "Sinal", valor: 1000, data_prevista: "2026-12-01", status: "previsto" },
        { id: "m-2", nome: "Entrega", valor: 5000, data_prevista: null, status: "previsto" },
      ],
    });
    renderiza(<ObraTimelineTab obra={{ ...obra, projeto_id: "proj-1" }} onIrParaDiario={vi.fn()} />);
    expect(await screen.findByText("Sinal")).toBeInTheDocument();
    expect(screen.getByText(/sem data/)).toBeInTheDocument();
    expect(screen.getByText("Obra 40% concluída")).toBeInTheDocument();
    expect(await screen.findByText("Estrutura")).toBeInTheDocument();
    expect(screen.getByText("sem pendências")).toBeInTheDocument();
    expect(screen.getByText("1 de 3 tarefas concluídas")).toBeInTheDocument();
  });

  it("projeto sem marcos avisa", async () => {
    renderiza(<ObraTimelineTab obra={{ ...obra, projeto_id: "proj-1" }} onIrParaDiario={vi.fn()} />);
    expect(await screen.findByText("O projeto não tem marcos cadastrados.")).toBeInTheDocument();
  });
});

describe("ObraCurvaS", () => {
  it("desenha planejado × realizado quando há tarefas com prazo", async () => {
    responderComTabelas({
      tarefas: [
        { id: "t-1", created_at: "2026-10-01", titulo: "t-1", status: "concluida", data_inicio: "2026-10-01", prazo: "2026-10-10", updated_at: "2026-10-09T00:00:00Z" },
        { id: "t-2", created_at: "2026-10-02", titulo: "t-2", status: "pendente", data_inicio: "2026-10-05", prazo: "2026-10-20", updated_at: "2026-10-05T00:00:00Z" },
      ],
      obra_rdo: [{ id: "r-1", data: "2026-10-08" }, { id: "r-2", data: "2026-10-07" }],
      obra_rdo_tarefa: [
        { id: "v-1", rdo_id: "r-1", tarefa_id: "t-1", resultado: "concluiu" },
        { id: "v-2", rdo_id: "r-2", tarefa_id: "t-1", resultado: "concluiu" },
        { id: "v-3", rdo_id: "r-x", tarefa_id: "t-2", resultado: "concluiu" },
        { id: "v-4", rdo_id: "r-1", tarefa_id: "t-2", resultado: "avancou" },
      ],
    });
    const { container } = renderiza(<ObraCurvaS obraId="obra-1" />);
    await waitFor(() => expect(container.querySelector(".recharts-wrapper")).not.toBeNull());
    expect(screen.queryByText(/Defina prazo nas tarefas/)).not.toBeInTheDocument();
  });
});

describe("FilaCotacoesPendentes", () => {
  it("sem pendências não renderiza nada", async () => {
    const { container } = renderiza(<FilaCotacoesPendentes />);
    await waitFor(() => expect(fake.chamadas.length).toBeGreaterThan(0));
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra até 5, marca atrasadas e linka para a aba de cotações", async () => {
    const pend = Array.from({ length: 7 }, (_, i) => ({
      id: `c-${i}`,
      obra_id: `o-${i}`,
      descricao: `Item ${i}`,
      prazo_necessidade: i === 0 ? "2020-01-01" : null,
      created_at: `2026-01-0${i + 1}`,
      obras: { nome: `Obra ${i}` },
    }));
    responderComTabelas({ obra_cotacao: pend });
    renderiza(<FilaCotacoesPendentes />);
    expect(await screen.findByText("Cotações aguardando decisão")).toBeInTheDocument();
    expect(screen.getByText(/atrasada há/)).toBeInTheDocument();
    expect(screen.getAllByText("sem prazo")).toHaveLength(4);
    expect(screen.getByRole("link", { name: /Item 0/ })).toHaveAttribute("href", "/obras/o-0?tab=cotacoes");
    expect(screen.getByRole("link", { name: /\+2 · ver todas/ })).toHaveAttribute("href", "/obras/o-5?tab=cotacoes");
  });
});

describe("ObraDesembolsoChart", () => {
  it("sem despesas mostra a dica", () => {
    renderiza(<ObraDesembolsoChart lancamentos={[]} orcamentos={[]} />);
    expect(screen.getByText(/Lance despesas para ver o desembolso/)).toBeInTheDocument();
  });

  it("com despesas e orçamento desenha a curva e a linha do previsto", () => {
    const lancamentos = [
      { id: "l-1", tipo: "despesa", data: "2026-09-10", valor: 1000 },
      { id: "l-2", tipo: "aporte", data: "2026-09-11", valor: 5000 },
      { id: "l-3", tipo: "despesa", data: "2026-10-10", valor: 2000 },
    ] as unknown as ObraLancamentoRow[];
    const orcamentos = [{ id: "o-1", valor_previsto: 10000 }] as unknown as ObraOrcamentoRow[];
    const { container } = renderiza(<ObraDesembolsoChart lancamentos={lancamentos} orcamentos={orcamentos} />);
    expect(container.querySelector(".recharts-wrapper")).not.toBeNull();
    expect(screen.queryByText(/Lance despesas/)).not.toBeInTheDocument();
  });
});
