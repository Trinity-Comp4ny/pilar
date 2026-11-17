import { clicarAcao } from "@/test/acoesLinha";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { PageSlotsContext } from "@/components/pageSlotsContext";
import type { Pessoa } from "../types";
import { PessoaTable } from "./PessoaTable";

/**
 * Tabela da Equipe: busca local tolerante (acento, ordem de letras, dígitos de
 * CPF/telefone), filtro de cargo deduplicado, CPF sempre mascarado e ações só
 * para admin. A toolbar vive num portal do PageLayout; aqui o slot é um div.
 */

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function ComSlot({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return (
    <PageSlotsContext.Provider value={{ toolbarEl: el, tabsEl: null }}>
      <div ref={setEl} data-testid="toolbar" />
      {children}
    </PageSlotsContext.Provider>
  );
}

const base = (p: Partial<Pessoa> & Pick<Pessoa, "id" | "nome">): Pessoa => ({
  cpf: "",
  tipo_contrato: "clt",
  cargo: "",
  telefone: "",
  email: "",
  ...p,
});

const PESSOAS: Pessoa[] = [
  base({
    id: "p1",
    nome: "João Conceição",
    cargo: "Arquiteto",
    email: "joao@seed.test",
    cpf: "529.982.247-25",
    telefone: "(11) 98888-7777",
  }),
  base({ id: "p2", nome: "Rita Alves", cargo: "arquiteto ", tipo_contrato: "pj", status: "inativo" }),
  base({ id: "p3", nome: "Davi Melo", cargo: "Projetista", tipo_contrato: "desconhecido" }),
];

function renderTabela(props: Partial<Parameters<typeof PessoaTable>[0]> = {}) {
  const handlers = { onRowClick: vi.fn(), onEditClick: vi.fn(), onDeleteClick: vi.fn() };
  render(
    <ComSlot>
      <PessoaTable pessoas={PESSOAS} isLoading={false} isAdmin={false} {...handlers} {...props} />
    </ComSlot>
  );
  return { ...handlers, user: userEvent.setup() };
}

const linhas = () => screen.getAllByRole("row").slice(1);
const busca = () => screen.getByRole("textbox", { name: /Buscar por nome/ });

describe("PessoaTable", () => {
  it("lista todos com contador, sem CPF na tabela e tipo desconhecido como texto cru", () => {
    renderTabela();
    expect(linhas()).toHaveLength(3);
    expect(screen.getByText("3 de 3")).toBeInTheDocument();
    expect(screen.queryByText("***.***.***-25")).not.toBeInTheDocument();
    expect(screen.queryByText("529.982.247-25")).not.toBeInTheDocument();
    expect(screen.getByText("desconhecido")).toBeInTheDocument();
    // Status ausente vale "ativo"; inativo aparece rotulado.
    expect(screen.getAllByText("Ativo").length).toBeGreaterThan(0);
  });

  it("busca ignora acento e caixa e aceita letras fora de sequência contígua", async () => {
    const { user } = renderTabela();
    await user.type(busca(), "conceicao");
    expect(linhas()).toHaveLength(1);
    expect(screen.getByText("1 de 3")).toBeInTheDocument();
    await user.clear(busca());
    await user.type(busca(), "rtlv"); // r-i-t-a a-l-v: subsequência de "rita alves"
    expect(within(linhas()[0]).getByText("Rita Alves")).toBeInTheDocument();
  });

  it("busca por dígitos casa CPF e telefone mesmo com máscara", async () => {
    const { user } = renderTabela();
    await user.type(busca(), "98224");
    expect(linhas()).toHaveLength(1);
    await user.clear(busca());
    await user.type(busca(), "988887777");
    expect(within(linhas()[0]).getByText("João Conceição")).toBeInTheDocument();
  });

  it("busca sem resultado mostra o vazio de filtro, não o de cadastro", async () => {
    const { user } = renderTabela();
    await user.type(busca(), "zzzz");
    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum membro cadastrado")).not.toBeInTheDocument();
    expect(screen.getByText("0 de 3")).toBeInTheDocument();
  });

  it("filtro de cargo deduplica variações e filtra pelo valor normalizado", async () => {
    const { user } = renderTabela();
    await user.click(within(screen.getByTestId("toolbar")).getByRole("button", { name: "Cargo" }));
    const lista = await screen.findByRole("listbox", { name: "Cargo" });
    const opcoes = within(lista)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opcoes).toEqual(["Todos os cargos", "Arquiteto", "Projetista"]);
    await user.click(within(lista).getByRole("option", { name: "Arquiteto" }));
    expect(linhas()).toHaveLength(2);
    expect(screen.queryByText("Davi Melo")).not.toBeInTheDocument();
  });

  it("lista vazia mostra o vazio de cadastro", () => {
    renderTabela({ pessoas: [] });
    expect(screen.getByText("Nenhum membro cadastrado")).toBeInTheDocument();
  });

  it("não-admin não vê ações; clicar na linha abre o detalhe", async () => {
    const { user, onRowClick } = renderTabela();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Ações" })).not.toBeInTheDocument();
    await user.click(screen.getByText("Davi Melo"));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: "p3" }));
  });

  it("admin edita e exclui sem disparar o clique da linha", async () => {
    const { user, onRowClick, onEditClick, onDeleteClick } = renderTabela({ isAdmin: true });
    const linha = linhas().find((r) => within(r).queryByText("Rita Alves"))!;
    await clicarAcao(user, linha, "Editar");
    expect(onEditClick).toHaveBeenCalledWith(expect.objectContaining({ id: "p2" }));
    await clicarAcao(user, linha, "Excluir");
    expect(onDeleteClick).toHaveBeenCalledWith("p2");
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("carregando não mostra o vazio", () => {
    renderTabela({ pessoas: [], isLoading: true });
    expect(screen.queryByText("Nenhum membro cadastrado")).not.toBeInTheDocument();
  });
});
