import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Lancamento } from "../hooks/useLancamentosUnified";

// Painel lateral do lançamento (SPEC 149, fase 3): valor e status no topo, ação de
// pagamento à mão, dados do título e o plano de parcelas inteiro.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
const acesso = { canEdit: true };
vi.mock("@/hooks/useFeatureAccess", () => ({
  useFeatureAccess: () => ({ canView: true, canEdit: acesso.canEdit, isViewerOnly: !acesso.canEdit, isAdmin: false }),
}));
vi.mock("./GrupoParcelaActions", () => ({
  GrupoParcelaActions: ({ onChanged }: { onChanged: () => void }) => (
    <button type="button" onClick={onChanged}>
      acoes-do-grupo
    </button>
  ),
}));

let parcelas = new Map<string, Lancamento[]>();
vi.mock("../hooks/useParcelasDosGrupos", () => ({ useParcelasDosGrupos: () => parcelas }));
let resumos = new Map();
vi.mock("../hooks/useGruposParcelaResumo", () => ({ useGruposParcelaResumo: () => resumos }));

import { LancamentoDetailSheet } from "./LancamentoDetailSheet";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function lanc(p: Partial<Lancamento> = {}): Lancamento {
  return {
    id: "d-1",
    tipo: "despesa",
    data_vencimento: "2099-12-10",
    data_efetivacao: null,
    data_competencia: "2099-12-01",
    descricao: "Licença do software",
    valor: 1200,
    status: "Pendente",
    categoria_id: null,
    categoria_nome: "Software",
    projeto_id: null,
    projeto_nome: "Residencial Aurora",
    centro_custo_id: null,
    conta_id: "c-1",
    conta_nome: "Itaú PJ",
    contraparte_id: "f-1",
    contraparte_tipo: "fornecedor",
    contraparte_nome: "Autodesk",
    forma_pagamento: "Boleto",
    cartao_id: null,
    parcela_numero: null,
    parcela_total: null,
    grupo_parcela: null,
    grupo_tipo: null,
    grupo_status: null,
    grupo_total_original: null,
    tags: null,
    transferencia_par_id: null,
    nota_fiscal: "NF 123",
    observacao: "Renovação anual",
    ...p,
  };
}

function setup(l: Lancamento, extra: Partial<React.ComponentProps<typeof LancamentoDetailSheet>> = {}) {
  const props = {
    onOpenChange: vi.fn(),
    onDelete: vi.fn(),
    onEditInTab: vi.fn(),
    onRegistrarPagamento: vi.fn(),
    onSelect: vi.fn(),
    ...extra,
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LancamentoDetailSheet lancamento={l} open {...props} />
    </QueryClientProvider>
  );
  return props;
}

beforeEach(() => {
  acesso.canEdit = true;
  parcelas = new Map();
  resumos = new Map();
});

describe("LancamentoDetailSheet", () => {
  it("mostra valor, status e os dados do título", () => {
    setup(lanc());
    expect(screen.getByRole("heading", { name: "Licença do software" })).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(screen.getByText("Autodesk")).toBeInTheDocument();
    expect(screen.getByText("Itaú PJ")).toBeInTheDocument();
    expect(screen.getByText("NF 123")).toBeInTheDocument();
    expect(screen.getByText("Renovação anual")).toBeInTheDocument();
    expect(screen.getByText("Residencial Aurora")).toBeInTheDocument();
  });

  it("vencido em aberto aparece como Atrasado mesmo antes do job diário", () => {
    setup(lanc({ data_vencimento: "2020-01-10", status: "Pendente" }));
    expect(screen.getByText("Atrasado")).toBeInTheDocument();
  });

  it("registrar pagamento chama a ação com o lançamento", () => {
    const l = lanc();
    const props = setup(l);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    expect(props.onRegistrarPagamento).toHaveBeenCalledWith(l);
  });

  it("receita oferece registrar recebimento", () => {
    setup(lanc({ tipo: "receita", contraparte_tipo: "cliente" }));
    expect(screen.getByRole("button", { name: "Registrar recebimento" })).toBeInTheDocument();
  });

  it("já pago não oferece registrar pagamento", () => {
    setup(lanc({ status: "Pago", data_efetivacao: "2099-12-09" }));
    expect(screen.queryByRole("button", { name: "Registrar pagamento" })).not.toBeInTheDocument();
    expect(screen.getByText("Pago")).toBeInTheDocument();
  });

  it("sem permissão de edição não mostra ações", () => {
    acesso.canEdit = false;
    setup(lanc());
    expect(screen.queryByRole("button", { name: "Registrar pagamento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
  });

  it("parcelado mostra progresso, saldo e o plano inteiro; clicar troca de parcela", () => {
    const p1 = lanc({ id: "p1", grupo_parcela: "g1", parcela_numero: 1, parcela_total: 3, status: "Pago", valor: 400 });
    const p2 = lanc({ id: "p2", grupo_parcela: "g1", parcela_numero: 2, parcela_total: 3, valor: 400 });
    const p3 = lanc({ id: "p3", grupo_parcela: "g1", parcela_numero: 3, parcela_total: 3, valor: 400 });
    parcelas = new Map([["g1", [p1, p2, p3]]]);
    resumos = new Map([
      [
        "g1",
        {
          totalOriginal: 1200,
          totalPago: 400,
          saldo: 800,
          pagas: 1,
          totalParcelas: 3,
          proximaVenc: "2099-12-10",
          proximaValor: 400,
          status: "parcial",
        },
      ],
    ]);
    const props = setup(p2);
    expect(screen.getByRole("progressbar", { name: "Progresso do parcelamento" })).toHaveAttribute(
      "aria-valuenow",
      "33"
    );
    expect(screen.getByText(/de 3/)).toBeInTheDocument();
    expect(screen.getByRole("button", { current: true })).toHaveTextContent("2/3");
    fireEvent.click(screen.getByRole("button", { name: /^3\/3/ }));
    expect(props.onSelect).toHaveBeenCalledWith(p3);
    expect(screen.getByText("acoes-do-grupo")).toBeInTheDocument();
  });

  it("mudar o grupo pelas ações avisa a lista e fecha o painel", () => {
    const onGroupChanged = vi.fn();
    const props = setup(lanc({ grupo_parcela: "g1", parcela_numero: 1, parcela_total: 2 }), { onGroupChanged });
    fireEvent.click(screen.getByRole("button", { name: "acoes-do-grupo" }));
    expect(onGroupChanged).toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("editar e excluir chamam as ações com o lançamento", () => {
    const l = lanc();
    const props = setup(l);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(props.onEditInTab).toHaveBeenCalledWith(l);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(props.onDelete).toHaveBeenCalledWith(l);
  });

  it("sem lançamento não renderiza nada", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LancamentoDetailSheet lancamento={null} open onOpenChange={vi.fn()} onDelete={vi.fn()} onEditInTab={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sem permissão de edição também esconde as ações do grupo", () => {
    acesso.canEdit = false;
    setup(lanc({ grupo_parcela: "g1", parcela_numero: 1, parcela_total: 2 }));
    expect(screen.queryByRole("button", { name: "acoes-do-grupo" })).not.toBeInTheDocument();
  });
});
