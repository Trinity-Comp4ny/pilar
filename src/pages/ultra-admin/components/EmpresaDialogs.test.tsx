import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { EmpresaDetalhe } from "../api";
import {
  ArquivarDialog,
  ComecarCobrarDialog,
  CriarEmpresaDialog,
  EditarEmpresaDialog,
  ExcluirDialog,
  SuspenderDialog,
  TornarConvidadaDialog,
} from "./EmpresaDialogs";

// Ações sensíveis sobre empresa no ultra admin: o botão só libera com o nome digitado igual
// (trava contra clique no lugar errado), excluir exige motivo, cobrar exige prazo de 1 a 365,
// e a edição transforma limite em branco/inválido em "sem override" (null).

const base = { open: true, onOpenChange: vi.fn(), isPending: false };

const digitarNome = (v: string) => fireEvent.change(screen.getByLabelText(/para confirmar/), { target: { value: v } });

describe("CriarEmpresaDialog", () => {
  it("exige nome e e-mail válido; manda os dois sem espaços", () => {
    const onConfirm = vi.fn();
    render(<CriarEmpresaDialog {...base} onConfirm={onConfirm} />);
    const criar = screen.getByRole("button", { name: "Criar e convidar dono" });
    expect(criar).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nome da empresa"), { target: { value: "  Alfa Engenharia " } });
    fireEvent.change(screen.getByLabelText("E-mail do dono"), { target: { value: "dono@alfa" } });
    expect(criar).toBeDisabled();

    fireEvent.change(screen.getByLabelText("E-mail do dono"), { target: { value: " dono@alfa.com.br " } });
    expect(criar).toBeEnabled();
    fireEvent.click(criar);
    expect(onConfirm).toHaveBeenCalledWith({ nome: "Alfa Engenharia", ownerEmail: "dono@alfa.com.br" });
  });

  it("nome em branco mantém o botão travado", () => {
    render(<CriarEmpresaDialog {...base} onConfirm={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nome da empresa"), { target: { value: "   " } });
    fireEvent.change(screen.getByLabelText("E-mail do dono"), { target: { value: "a@b.co" } });
    expect(screen.getByRole("button", { name: "Criar e convidar dono" })).toBeDisabled();
  });

  it("fechar e reabrir limpa o formulário", () => {
    const { rerender } = render(<CriarEmpresaDialog {...base} onConfirm={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nome da empresa"), { target: { value: "Alfa" } });
    rerender(<CriarEmpresaDialog {...base} open={false} onConfirm={vi.fn()} />);
    rerender(<CriarEmpresaDialog {...base} onConfirm={vi.fn()} />);
    expect(screen.getByLabelText("Nome da empresa")).toHaveValue("");
  });
});

describe("confirmação com nome", () => {
  it.each([
    ["Suspender", SuspenderDialog, "Suspender Alfa?"],
    ["Arquivar", ArquivarDialog, "Arquivar Alfa?"],
    ["Tornar convidada", TornarConvidadaDialog, "Tornar Alfa convidada?"],
  ] as const)("%s só libera com o nome exato", (botao, Dialog, titulo) => {
    const onConfirm = vi.fn();
    render(<Dialog {...base} empresaNome="Alfa" onConfirm={onConfirm} />);
    expect(screen.getByText(titulo)).toBeInTheDocument();
    const confirmar = screen.getByRole("button", { name: botao });
    digitarNome("alfa");
    expect(confirmar).toBeDisabled();
    digitarNome("  Alfa  ");
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);
    expect(onConfirm).toHaveBeenCalledWith("Alfa");
  });

  it("fechar limpa o nome digitado", () => {
    const { rerender } = render(<SuspenderDialog {...base} empresaNome="Alfa" onConfirm={vi.fn()} />);
    digitarNome("Alfa");
    rerender(<SuspenderDialog {...base} open={false} empresaNome="Alfa" onConfirm={vi.fn()} />);
    rerender(<SuspenderDialog {...base} empresaNome="Alfa" onConfirm={vi.fn()} />);
    expect(screen.getByLabelText(/para confirmar/)).toHaveValue("");
  });
});

describe("ExcluirDialog", () => {
  it("nome certo sem motivo não libera; com motivo manda os dois", () => {
    const onConfirm = vi.fn();
    render(<ExcluirDialog {...base} empresaNome="Alfa" onConfirm={onConfirm} />);
    const excluir = screen.getByRole("button", { name: "Excluir empresa" });
    digitarNome("Alfa");
    expect(excluir).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "   " } });
    expect(excluir).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: " conta de teste " } });
    fireEvent.click(excluir);
    expect(onConfirm).toHaveBeenCalledWith({ confirmName: "Alfa", motivo: "conta de teste" });
  });
});

describe("ComecarCobrarDialog", () => {
  it("prazo padrão de 7 dias; fora de 1..365 ou fracionado trava", () => {
    const onConfirm = vi.fn();
    render(<ComecarCobrarDialog {...base} empresaNome="Alfa" onConfirm={onConfirm} />);
    const prazo = screen.getByLabelText("Prazo para assinar (dias)");
    expect(prazo).toHaveValue(7);
    digitarNome("Alfa");
    const cobrar = screen.getByRole("button", { name: "Começar a cobrar" });
    for (const invalido of ["0", "366", "2.5"]) {
      fireEvent.change(prazo, { target: { value: invalido } });
      expect(cobrar).toBeDisabled();
    }
    fireEvent.change(prazo, { target: { value: "30" } });
    fireEvent.click(cobrar);
    expect(onConfirm).toHaveBeenCalledWith({ confirmName: "Alfa", diasPrazo: 30 });
  });
});

describe("EditarEmpresaDialog", () => {
  const empresa = {
    nome: "Alfa",
    cnpj: "12.345.678/0001-90",
    plano: "pro",
    maxProjetosOverride: 15,
    maxUsuariosOverride: null,
  } as EmpresaDetalhe;

  it("carrega os dados atuais e manda limite em branco como null", () => {
    const onConfirm = vi.fn();
    render(<EditarEmpresaDialog {...base} empresa={empresa} onConfirm={onConfirm} />);
    expect(screen.getByLabelText("Nome")).toHaveValue("Alfa");
    // Com override existente, a seção de limites já abre.
    expect(screen.getByLabelText("Projetos ativos")).toHaveValue(15);
    expect(screen.getByLabelText("Usuários")).toHaveValue(null);

    fireEvent.change(screen.getByLabelText("CNPJ"), { target: { value: "   " } });
    // Negativo/fracionado o próprio input numérico (min=0) barra; em branco vira "padrão do plano".
    fireEvent.change(screen.getByLabelText("Projetos ativos"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Usuários"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onConfirm).toHaveBeenCalledWith({
      nome: "Alfa",
      cnpj: null,
      plano: "pro",
      max_projetos_override: 20,
      max_usuarios_override: null,
    });
  });

  it("nome vazio trava o salvar", () => {
    render(<EditarEmpresaDialog {...base} empresa={empresa} onConfirm={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: " " } });
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("sem override a seção de limites começa fechada", () => {
    render(
      <EditarEmpresaDialog
        {...base}
        empresa={{ ...empresa, maxProjetosOverride: null } as EmpresaDetalhe}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("Projetos ativos")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Limites fora do plano"));
    expect(screen.getByLabelText("Projetos ativos")).toHaveValue(null);
  });
});
