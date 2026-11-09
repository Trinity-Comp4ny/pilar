import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Lancamento } from "../hooks/useLancamentosUnified";

// Detalhe do lançamento: campos por tipo (receita/despesa), parcela e ações
// (editar, excluir, ações do grupo) só para quem pode editar o financeiro.

const acesso = { canEdit: true };
vi.mock("@/hooks/useFeatureAccess", () => ({ useFeatureAccess: () => acesso }));
vi.mock("./GrupoParcelaActions", () => ({
  GrupoParcelaActions: ({ onChanged }: { onChanged: () => void }) => (
    <button type="button" onClick={onChanged}>
      Ações do grupo
    </button>
  ),
}));

import { LancamentoDetailDialog } from "./LancamentoDetailDialog";

const base: Lancamento = {
  id: "l1",
  tipo: "despesa",
  data_vencimento: "2026-10-10",
  data_efetivacao: null,
  data_competencia: null,
  descricao: "Cimento Votoran",
  valor: 1500,
  status: "Pendente",
  categoria_id: null,
  categoria_nome: null,
  projeto_id: null,
  projeto_nome: null,
  centro_custo_id: null,
  conta_id: null,
  conta_nome: null,
  contraparte_id: null,
  contraparte_tipo: null,
  contraparte_nome: null,
  forma_pagamento: null,
  cartao_id: null,
  parcela_numero: null,
  parcela_total: null,
  grupo_parcela: null,
  grupo_tipo: null as unknown as Lancamento["grupo_tipo"],
  grupo_status: null as unknown as Lancamento["grupo_status"],
  grupo_total_original: null,
  tags: null,
  transferencia_par_id: null,
};

function setup(l: Lancamento | null, extra: Partial<Parameters<typeof LancamentoDetailDialog>[0]> = {}) {
  const props = {
    onOpenChange: vi.fn(),
    onDelete: vi.fn(),
    onEditInTab: vi.fn(),
    onGroupChanged: vi.fn(),
    ...extra,
  };
  const r = render(<LancamentoDetailDialog lancamento={l} open {...props} />);
  return { ...props, ...r };
}

const campo = (rotulo: string) => screen.getByText(rotulo).nextElementSibling as HTMLElement;

beforeEach(() => {
  acesso.canEdit = true;
});

describe("LancamentoDetailDialog", () => {
  it("sem lançamento não renderiza", () => {
    const { container } = setup(null);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("despesa sem dados opcionais mostra traços e parcela 1/1", () => {
    setup(base);
    expect(screen.getByText("Detalhes — Despesa")).toBeInTheDocument();
    expect(campo("Valor")).toHaveTextContent(/− R\$\s?1\.500,00/);
    expect(campo("Pagamento")).toHaveTextContent("—");
    expect(campo("Fornecedor")).toHaveTextContent("—");
    expect(campo("Categoria")).toHaveTextContent("—");
    expect(campo("Parcela")).toHaveTextContent("1/1");
    expect(screen.getByRole("button", { name: /Editar em Despesas/ })).toBeInTheDocument();
  });

  it("receita mostra recebimento, cliente e parcela k/N", () => {
    setup({
      ...base,
      tipo: "receita",
      data_efetivacao: "2026-10-12",
      contraparte_nome: "Construtora Alfa",
      categoria_nome: "Honorários",
      projeto_nome: "Casa Verde",
      forma_pagamento: "PIX",
      parcela_numero: 2,
      parcela_total: 3,
      status: "Recebido",
    });
    expect(screen.getByText("Detalhes — Receita")).toBeInTheDocument();
    expect(campo("Valor")).toHaveTextContent(/\+ R\$\s?1\.500,00/);
    expect(campo("Recebimento")).toHaveTextContent("12/10/2026");
    expect(campo("Cliente")).toHaveTextContent("Construtora Alfa");
    expect(campo("Forma pagto.")).toHaveTextContent("PIX");
    expect(campo("Parcela")).toHaveTextContent("2/3");
    expect(campo("Status")).toHaveTextContent("Recebido");
  });

  it("editar e excluir chamam as ações com o lançamento", () => {
    const { onEditInTab, onDelete } = setup(base);
    fireEvent.click(screen.getByRole("button", { name: /Editar em Despesas/ }));
    expect(onEditInTab).toHaveBeenCalledWith(base);
    fireEvent.click(screen.getByRole("button", { name: /Excluir/ }));
    expect(onDelete).toHaveBeenCalledWith(base);
  });

  it("parcelado mostra as ações do grupo; mudar o grupo fecha e avisa", () => {
    const { onGroupChanged, onOpenChange } = setup({
      ...base,
      grupo_parcela: "g1",
      parcela_numero: 1,
      parcela_total: 2,
    });
    fireEvent.click(screen.getByRole("button", { name: "Ações do grupo" }));
    expect(onGroupChanged).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sem permissão de edição: só leitura, sem ações", () => {
    acesso.canEdit = false;
    setup({ ...base, grupo_parcela: "g1" });
    expect(screen.getByText("Cimento Votoran")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ações do grupo" })).not.toBeInTheDocument();
  });
});
