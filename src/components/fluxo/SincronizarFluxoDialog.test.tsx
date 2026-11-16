import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SincronizarFluxoDialog, type LinhaSincronizacao } from "./SincronizarFluxoDialog";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const linhas: LinhaSincronizacao[] = [
  { id: "o1", nome: "Casa B3", resumo: "2 itens novos · 3 tarefas novas", temAlgo: true },
  { id: "o2", nome: "Sobrado", resumo: "1 tarefa nova", temAlgo: true },
  { id: "o3", nome: "Galpão", resumo: "Já está em dia", temAlgo: false },
];

const abrir = (p: Partial<React.ComponentProps<typeof SincronizarFluxoDialog>> = {}) => {
  const onConfirmar = vi.fn();
  render(
    <SincronizarFluxoDialog
      open
      onOpenChange={vi.fn()}
      tipo="obras"
      nomeFluxo="Residencial"
      carregando={false}
      linhas={linhas}
      pending={false}
      onConfirmar={onConfirmar}
      {...p}
    />
  );
  return { onConfirmar };
};

describe("SincronizarFluxoDialog", () => {
  it("pergunta se quer atualizar e vem com quem tem algo a receber marcado", async () => {
    const { onConfirmar } = abrir();
    expect(screen.getByRole("heading", { name: "Atualizar obras que usam este fluxo?" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Atualizar Galpão" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Atualizar 2" }));
    expect(onConfirmar).toHaveBeenCalledWith(["o1", "o2"]);
  });

  it("desmarcar uma obra tira ela da atualização", async () => {
    const { onConfirmar } = abrir();
    await userEvent.click(screen.getByRole("checkbox", { name: "Atualizar Casa B3" }));
    await userEvent.click(screen.getByRole("button", { name: "Atualizar 1" }));
    expect(onConfirmar).toHaveBeenCalledWith(["o2"]);
  });

  it("nenhuma obra segue o fluxo: explica e não deixa confirmar", () => {
    abrir({ linhas: [] });
    expect(screen.getByText(/Nenhuma obra segue este fluxo ainda/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeDisabled();
  });

  it("todos em dia: avisa e não deixa confirmar", () => {
    abrir({ linhas: [{ id: "o3", nome: "Galpão", resumo: "Já está em dia", temAlgo: false }] });
    expect(screen.getByText(/já estão em dia/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeDisabled();
  });

  it("projetos usam o texto de projetos e o botão Agora não fecha", async () => {
    const onOpenChange = vi.fn();
    abrir({ tipo: "projetos", linhas: [], onOpenChange });
    expect(screen.getByRole("heading", { name: "Atualizar projetos que usam este fluxo?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
