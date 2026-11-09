import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import type { Draft, DraftCampos } from "./useChat";

// Folha pelo agente: preview da mesma RPC da plataforma, mês já fechado bloqueia, valores
// editáveis recalculam o total, e o resumo de "fechada" sobrevive a reabrir o chat (as linhas
// vêm do rascunho salvo). Cartão: nome obrigatório, limite com máscara e desfazer.

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  resolve: (() => ({ data: null, count: 0 })) as (q: ChainQuery) => ChainResult,
}));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  return { supabase: { from: chain.from, rpc: h.rpc } };
});
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

import { FolhaCard } from "./FolhaCard";
import { CartaoCard } from "./CartaoCard";

const onConfirmar = vi.fn();
const onCancelar = vi.fn();
const onDesfazer = vi.fn();

function draft(campos: DraftCampos, over: Partial<Draft> = {}): Draft {
  return { runId: "r1", entidade: "folha", campos, custoCreditos: 1, status: "pendente", ...over };
}

function wrap(el: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{el}</MemoryRouter>
    </QueryClientProvider>
  );
}

const montarFolha = (d: Draft) =>
  wrap(<FolhaCard draft={d} onConfirmar={onConfirmar} onCancelar={onCancelar} onDesfazerFolha={onDesfazer} />);

beforeEach(() => {
  vi.clearAllMocks();
  h.resolve = () => ({ data: null, count: 0 });
  h.rpc.mockResolvedValue({
    data: [
      {
        pessoa_id: "p1",
        nome: "Rita Alves",
        salario_fixo: "5000",
        total_area: "120",
        valor_m2: "10",
        total_variavel: "1200",
      },
      {
        pessoa_id: "p2",
        nome: "Davi Melo",
        salario_fixo: null,
        total_area: null,
        valor_m2: null,
        total_variavel: null,
      },
    ],
    error: null,
  });
  onConfirmar.mockResolvedValue("x");
  onCancelar.mockResolvedValue(undefined);
  onDesfazer.mockResolvedValue(undefined);
});

describe("FolhaCard", () => {
  it("mostra o preview, edita valores e fecha com o total por pessoa", async () => {
    montarFolha(draft({ mes: 7, ano: 2026 }));
    expect(screen.getByText("Fechar folha · jul/2026")).toBeInTheDocument();
    expect(await screen.findByText("Rita Alves")).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith("get_folha_preview", { p_mes: 7, p_ano: 2026 });
    expect(screen.getByText(/R\$\s?6\.200,00/, { selector: "tfoot td" })).toBeInTheDocument();

    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[2], { target: { value: "3000" } });
    fireEvent.change(inputs[1], { target: { value: "" } });
    expect(screen.getByText(/R\$\s?8\.000,00/, { selector: "tfoot td" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Fechar folha/ }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalled());
    expect(onConfirmar.mock.calls[0][2]).toEqual({
      mes: 7,
      ano: 2026,
      linhas: [
        {
          pessoa_id: "p1",
          salario_fixo: 5000,
          total_area_projetada: 120,
          valor_m2: 10,
          adicional_variavel: 0,
          total_receber: 5000,
        },
        {
          pessoa_id: "p2",
          salario_fixo: 3000,
          total_area_projetada: 0,
          valor_m2: 0,
          adicional_variavel: 0,
          total_receber: 3000,
        },
      ],
    });
    expect(toast.success).toHaveBeenCalledWith("Folha fechada");
  });

  it("mês já fechado bloqueia o fechamento", async () => {
    h.resolve = () => ({ data: null, count: 4 });
    montarFolha(draft({ mes: 7, ano: 2026 }));
    expect(await screen.findByText("A folha de jul/2026 já foi fechada.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fechar folha/ })).toBeDisabled();
  });

  it("sem pessoas avisa e não fecha", async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    montarFolha(draft({ mes: 12, ano: 2026 }));
    expect(await screen.findByText("Nenhuma pessoa com folha para dez/2026.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fechar folha/ })).toBeDisabled();
  });

  it("falha ao fechar mostra o motivo da RPC", async () => {
    onConfirmar.mockRejectedValue(new Error("A folha de 7/2026 já foi fechada"));
    montarFolha(draft({ mes: 7, ano: 2026 }));
    await screen.findByText("Rita Alves");
    await userEvent.click(screen.getByRole("button", { name: /Fechar folha/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível fechar a folha", {
        description: "A folha de 7/2026 já foi fechada",
      })
    );
  });

  it("cancelar descarta", async () => {
    montarFolha(draft({ mes: 7, ano: 2026 }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancelar).toHaveBeenCalledWith("r1");
  });

  it("fechada reaberta do histórico conta as pessoas do rascunho salvo, sem refazer o preview", async () => {
    const linhas = [
      {
        pessoa_id: "p1",
        salario_fixo: 1,
        total_area_projetada: 0,
        valor_m2: 0,
        adicional_variavel: 0,
        total_receber: 1,
      },
      {
        pessoa_id: "p2",
        salario_fixo: 1,
        total_area_projetada: 0,
        valor_m2: 0,
        adicional_variavel: 0,
        total_receber: 1,
      },
    ];
    montarFolha(draft({ mes: 7, ano: 2026, linhas }, { status: "criado" }));
    expect(screen.getByText("Folha de jul/2026 fechada · 2 pessoas")).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Ver folha/ })).toHaveAttribute("href", "/gestao/financeiro?tab=folha");
    await userEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    await waitFor(() => expect(onDesfazer).toHaveBeenCalledWith("r1", 7, 2026));
    expect(toast.success).toHaveBeenCalledWith("Fechamento desfeito");
  });

  it("singular de pessoa; desfazer com erro avisa", async () => {
    onDesfazer.mockRejectedValue(new Error("x"));
    montarFolha(
      draft(
        {
          mes: 1,
          ano: 2027,
          linhas: [
            {
              pessoa_id: "p1",
              salario_fixo: 1,
              total_area_projetada: 0,
              valor_m2: 0,
              adicional_variavel: 0,
              total_receber: 1,
            },
          ],
        },
        { status: "criado" }
      )
    );
    expect(screen.getByText("Folha de jan/2027 fechada · 1 pessoa")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível desfazer"));
  });

  it("descartada mostra o estado final", () => {
    montarFolha(draft({ mes: 7, ano: 2026 }, { status: "cancelado" }));
    expect(screen.getByText("Fechamento de folha descartado.")).toBeInTheDocument();
  });
});

describe("CartaoCard", () => {
  const montarCartao = (d: Draft) =>
    wrap(<CartaoCard index={0} draft={d} onConfirmar={onConfirmar} onCancelar={onCancelar} onDesfazer={onDesfazer} />);

  it("nome é obrigatório; cadastra com limite mascarado, tipo e dias", async () => {
    const user = userEvent.setup();
    montarCartao(draft({ limite: 5000 }, { entidade: "cartao" }));
    expect((screen.getByLabelText("Limite") as HTMLInputElement).value).toMatch(/^R\$\s5\.000,00$/);
    await user.click(screen.getByRole("button", { name: /Cadastrar/ }));
    expect(toast.error).toHaveBeenCalledWith("Informe o nome do cartão");
    await user.type(screen.getByLabelText(/Nome/), "Nubank PJ");
    await user.clear(screen.getByLabelText("Limite"));
    await user.type(screen.getByLabelText("Limite"), "800000");
    await user.type(screen.getByLabelText("Dia de fechamento"), "3");
    await user.type(screen.getByLabelText("Dia de vencimento"), "10");
    await user.click(screen.getByLabelText("Tipo"));
    await user.click(await screen.findByRole("option", { name: "Débito" }));
    await user.click(screen.getByRole("button", { name: /Cadastrar/ }));
    await waitFor(() =>
      expect(onConfirmar).toHaveBeenCalledWith("r1", "cartao", {
        nome: "Nubank PJ",
        limite: 8000,
        tipo: "debito",
        dia_fechamento: 3,
        dia_vencimento: 10,
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Cartão cadastrado");
  });

  it("limite apagado vira indefinido; dias apagados também", async () => {
    const user = userEvent.setup();
    montarCartao(draft({ nome: "Visa", dia_fechamento: 5 }, { entidade: "cartao" }));
    await user.clear(screen.getByLabelText("Dia de fechamento"));
    await user.click(screen.getByRole("button", { name: /Cadastrar/ }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalled());
    expect(onConfirmar.mock.calls[0][2]).toMatchObject({ nome: "Visa", tipo: "credito", dia_fechamento: undefined });
  });

  it("falha ao cadastrar orienta a conferir permissão", async () => {
    onConfirmar.mockRejectedValue(new Error("rls"));
    montarCartao(draft({ nome: "Visa" }, { entidade: "cartao" }));
    await userEvent.click(screen.getByRole("button", { name: /Cadastrar/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível cadastrar o cartão", {
        description: "Verifique suas permissões e tente de novo.",
      })
    );
  });

  it("cancelar, criado com desfazer e descartado", async () => {
    const { unmount } = montarCartao(draft({ nome: "Visa" }, { entidade: "cartao" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancelar).toHaveBeenCalledWith("r1");
    unmount();

    const criado = montarCartao(draft({ nome: "Visa" }, { entidade: "cartao", status: "criado", entityId: "car-1" }));
    expect(screen.getByText("Cartão cadastrado")).toBeInTheDocument();
    expect(screen.getByText("Visa")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    await waitFor(() => expect(onDesfazer).toHaveBeenCalledWith("r1", "cartao", "car-1"));
    expect(toast.success).toHaveBeenCalledWith("Cartão removido");
    onDesfazer.mockRejectedValueOnce(new Error("x"));
    await userEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível desfazer"));
    criado.unmount();

    const semId = montarCartao(draft({ nome: "Visa" }, { entidade: "cartao", status: "criado" }));
    onDesfazer.mockClear();
    await userEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    expect(onDesfazer).not.toHaveBeenCalled();
    semId.unmount();

    montarCartao(draft({}, { entidade: "cartao", status: "cancelado" }));
    expect(screen.getByText("Rascunho descartado.")).toBeInTheDocument();
  });
});
