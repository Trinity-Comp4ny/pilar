import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabaseFake } from "@/hooks/testing/supabaseFake";
import { ReconciliarDialog } from "./ReconciliarDialog";

/** Fila de reconciliação (spec 026): vincular cotações em texto livre ao cadastro. */

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

const proposta = (nome: string, obra = "Obra Centro") => ({
  fornecedor_nome: nome,
  cotacao: { descricao: "Cimento", deleted_at: null, obra: { nome: obra } },
});

beforeEach(() => {
  vi.clearAllMocks();
  supabaseFake.reset();
  supabaseFake.respond("fornecedores", "select", { data: [{ id: "f1", nome: "Concreto Forte Ltda", cnpj: null }] });
});

const abrir = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      <ReconciliarDialog open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  );

describe("ReconciliarDialog", () => {
  it("sem pendências mostra Tudo reconciliado", async () => {
    supabaseFake.respond("obra_cotacao_proposta", "select", { data: [] });
    abrir();
    expect(await screen.findByText("Tudo reconciliado")).toBeInTheDocument();
  });

  it("agrupa por nome, ignora cotação removida e vincula ao fornecedor sugerido", async () => {
    supabaseFake.respond("obra_cotacao_proposta", "select", {
      data: [
        proposta("Concreto Forte"),
        proposta("Concreto Forte"),
        { fornecedor_nome: "Concreto Forte", cotacao: { descricao: "x", deleted_at: "2026-01-01", obra: null } },
      ],
    });
    const user = userEvent.setup();
    abrir();

    expect(await screen.findByText("2 cotações")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Vincular" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Cotações vinculadas ao fornecedor"));
    const [upd] = supabaseFake.callsTo("obra_cotacao_proposta", "update");
    expect(upd.payload).toEqual({ fornecedor_id: "f1" });
    expect(upd.chain).toContainEqual(["eq", ["fornecedor_nome", "Concreto Forte"]]);
    expect(upd.chain).toContainEqual(["is", ["fornecedor_id", null]]);
  });

  it("sem fornecedor escolhido nem sugerido, não vincula e pede a escolha", async () => {
    supabaseFake.respond("obra_cotacao_proposta", "select", { data: [proposta("Xyz Materiais")] });
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByRole("button", { name: "Vincular" }));

    expect(toastError).toHaveBeenCalledWith("Escolha um fornecedor para vincular");
    expect(supabaseFake.callsTo("obra_cotacao_proposta", "update")).toHaveLength(0);
  });

  it("erro do servidor ao vincular avisa e libera o botão", async () => {
    supabaseFake.respond("obra_cotacao_proposta", "select", { data: [proposta("Concreto Forte")] });
    supabaseFake.respond("obra_cotacao_proposta", "update", { error: { message: "x" } });
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByRole("button", { name: "Vincular" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Não foi possível vincular. Tente de novo."));
    expect(screen.getByRole("button", { name: "Vincular" })).toBeEnabled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
