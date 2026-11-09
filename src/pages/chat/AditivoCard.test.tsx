import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Draft, DraftCampos } from "./useChat";

// Aditivo pelo agente: nasce rascunho (aprovação na tela do projeto), projeto pela dica de nome,
// valor = custo dos itens + 30%, itens sem descrição ficam de fora do que é gravado.

const h = vi.hoisted(() => ({ projetos: [] as Array<{ id: string; nome: string }> }));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  return { supabase: { from: createSupabaseFrom(() => ({ data: h.projetos })).from } };
});
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

import { AditivoCard } from "./AditivoCard";

const onConfirmar = vi.fn();
const onCancelar = vi.fn();
const onDesfazer = vi.fn();

function montar(
  campos: DraftCampos & { projeto_id?: string; projeto_nome?: string; descricao?: string },
  over: Partial<Draft> = {}
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const draft: Draft = { runId: "r1", entidade: "aditivo", campos, custoCreditos: 1, status: "pendente", ...over };
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AditivoCard
          index={0}
          draft={draft}
          onConfirmar={onConfirmar}
          onCancelar={onCancelar}
          onDesfazer={onDesfazer}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.projetos = [
    { id: "p1", nome: "Residência Lima" },
    { id: "p2", nome: "Galpão Norte" },
  ];
  onConfirmar.mockResolvedValue("esc-1");
  onCancelar.mockResolvedValue(undefined);
  onDesfazer.mockResolvedValue(undefined);
});

describe("AditivoCard", () => {
  it("resolve o projeto pela dica, calcula a margem e grava só itens descritos", async () => {
    const user = userEvent.setup();
    montar({
      projeto_nome: "galpão",
      descricao: "Ampliação do mezanino",
      justificativa: "Cliente pediu",
      itens: [
        { descricao: "Estrutura", disciplina: "Estrutural", horas: 10, custo: 1000 },
        { descricao: "Elétrica", custo: 500 },
      ],
    });
    expect(await screen.findByText("Galpão Norte")).toBeInTheDocument();
    expect(screen.getByText(/Custo dos itens: R\$\s?1\.500,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?1\.950,00/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Adicionar item/ }));
    await user.type(screen.getByLabelText("Item 3 custo"), "100");
    await user.click(screen.getByRole("button", { name: /Criar aditivo/ }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalled());
    const [, entidade, campos] = onConfirmar.mock.calls[0];
    expect(entidade).toBe("aditivo");
    expect(campos).toEqual({
      projeto_id: "p2",
      descricao: "Ampliação do mezanino",
      justificativa: "Cliente pediu",
      itens: [
        { descricao: "Estrutura", disciplina: "Estrutural", horas: 10, custo: 1000 },
        { descricao: "Elétrica", custo: 500 },
      ],
    });
    expect(toast.success).toHaveBeenCalledWith("Aditivo criado (rascunho)");
  });

  it("sem projeto ou sem descrição não cria", async () => {
    const user = userEvent.setup();
    h.projetos = [];
    montar({});
    await user.click(screen.getByRole("button", { name: /Criar aditivo/ }));
    expect(toast.error).toHaveBeenCalledWith("Selecione o projeto");
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("projeto escolhido à mão; descrição em branco é barrada; edita e remove itens", async () => {
    const user = userEvent.setup();
    montar({ itens: [] });
    await user.click(screen.getByLabelText(/Projeto/));
    await user.click(await screen.findByRole("option", { name: "Residência Lima" }));
    await user.click(screen.getByRole("button", { name: /Criar aditivo/ }));
    expect(toast.error).toHaveBeenCalledWith("Descreva o aditivo");

    await user.type(screen.getByLabelText(/Descrição/), "Revisão de layout");
    await user.type(screen.getByLabelText("Item 1 descrição"), "Layout");
    await user.type(screen.getByLabelText("Item 1 disciplina"), "Arquitetura");
    await user.type(screen.getByLabelText("Item 1 custo"), "200");
    await user.clear(screen.getByLabelText("Item 1 custo"));
    await user.click(screen.getByRole("button", { name: /Adicionar item/ }));
    await user.click(screen.getByRole("button", { name: "Remover item 2" }));
    expect(screen.queryByLabelText("Item 2 descrição")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Justificativa/), "Pedido do cliente");
    await user.click(screen.getByRole("button", { name: /Criar aditivo/ }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalled());
    expect(onConfirmar.mock.calls[0][2]).toEqual({
      projeto_id: "p1",
      descricao: "Revisão de layout",
      justificativa: "Pedido do cliente",
      itens: [{ descricao: "Layout", disciplina: "Arquitetura", custo: undefined }],
    });
  });

  it("falha ao criar mostra o motivo", async () => {
    onConfirmar.mockRejectedValue(new Error("Projeto encerrado"));
    montar({ projeto_id: "p1", descricao: "X" });
    await userEvent.click(screen.getByRole("button", { name: /Criar aditivo/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível criar o aditivo", { description: "Projeto encerrado" })
    );
  });

  it("cancelar, criado (valor e desfazer) e descartado", async () => {
    const { unmount } = montar({ projeto_id: "p1", descricao: "X" });
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancelar).toHaveBeenCalledWith("r1");
    unmount();

    const criado = montar(
      { projeto_id: "p1", descricao: "X", itens: [{ descricao: "a", custo: 100 }] },
      { status: "criado", entityId: "esc-1" }
    );
    expect(screen.getByText(/Aditivo criado como rascunho \(R\$\s?130,00\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    await waitFor(() => expect(onDesfazer).toHaveBeenCalledWith("r1", "aditivo", "esc-1"));
    expect(toast.success).toHaveBeenCalledWith("Aditivo desfeito");
    onDesfazer.mockRejectedValueOnce(new Error("x"));
    await userEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível desfazer"));
    criado.unmount();

    const semId = montar({}, { status: "criado" });
    onDesfazer.mockClear();
    await userEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    expect(onDesfazer).not.toHaveBeenCalled();
    semId.unmount();

    montar({}, { status: "cancelado" });
    expect(screen.getByText(/descartado/)).toBeInTheDocument();
  });
});
