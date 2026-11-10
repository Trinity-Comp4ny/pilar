import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sb } from "../testing/supabaseMock";
import type { Lancamento } from "../hooks/useLancamentosUnified";

// Operações sobre um grupo de parcelas: editar em aberto, renegociar e quitar
// antecipado. Cada uma chama uma RPC que mexe em várias parcelas de uma vez,
// então valor inválido tem de ser barrado antes de chegar ao banco.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/select", async () => await import("../testing/nativeSelect"));
vi.mock("../hooks/useContasOpcoes", () => ({ useContasOpcoes: () => [{ id: "conta-1", nome: "Itaú PJ" }] }));

import { toast } from "sonner";
import { GrupoParcelaActions } from "./GrupoParcelaActions";

const TZ_ORIGINAL = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Sao_Paulo";
});
afterAll(() => {
  process.env.TZ = TZ_ORIGINAL;
});

const l = {
  id: "d-1",
  tipo: "despesa",
  grupo_parcela: "grp-1",
  grupo_status: "parcial",
  grupo_tipo: "finito",
  grupo_total_original: 1200,
  parcela_numero: 2,
  parcela_total: 12,
} as Lancamento;

function setup(lanc: Lancamento = l) {
  const onChanged = vi.fn();
  const user = userEvent.setup();
  render(<GrupoParcelaActions lancamento={lanc} onChanged={onChanged} />);
  return { onChanged, user };
}

async function abrir(user: ReturnType<typeof userEvent.setup>, item: string) {
  await user.click(screen.getByRole("button", { name: /Operações de grupo/ }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
  return screen.getByRole("dialog");
}

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
});

describe("GrupoParcelaActions", () => {
  it("lançamento fora de grupo não mostra nada", () => {
    const { container } = render(
      <GrupoParcelaActions lancamento={{ ...l, grupo_parcela: null }} onChanged={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra resumo do grupo: status, total original e parcela", () => {
    setup();
    expect(screen.getByText("parcial")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s1\.200,00/)).toBeInTheDocument();
    expect(screen.getByText("Parcela 2/12")).toBeInTheDocument();
  });

  describe("editar parcelas em aberto", () => {
    it("envia o novo valor por parcela", async () => {
      sb.rpcResultado("rpc_grupo_parcela_editar_em_aberto", { data: 10, error: null });
      const { user, onChanged } = setup();
      await abrir(user, "Editar parcelas em aberto");
      // MoneyInput: dígitos entram como centavos ("15050" → R$ 150,50).
      await user.type(screen.getByPlaceholderText("Deixe vazio para manter"), "15050");
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(sb.argsRpc("rpc_grupo_parcela_editar_em_aberto")).toMatchObject({
        p_grupo_id: "grp-1",
        p_novo_valor_parcela: 150.5,
      });
      expect(toast.success).toHaveBeenCalledWith("10 parcela(s) atualizada(s)");
    });

    it("valor vazio mantém o valor (não envia)", async () => {
      sb.rpcResultado("rpc_grupo_parcela_editar_em_aberto", { data: 10, error: null });
      const { user, onChanged } = setup();
      await abrir(user, "Editar parcelas em aberto");
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(sb.argsRpc("rpc_grupo_parcela_editar_em_aberto")?.p_novo_valor_parcela).toBeUndefined();
    });

    it.each(["0", "000"])("valor por parcela %s é recusado sem chamar o banco", async (v) => {
      const { user, onChanged } = setup();
      await abrir(user, "Editar parcelas em aberto");
      await user.type(screen.getByPlaceholderText("Deixe vazio para manter"), v);
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(toast.error).toHaveBeenCalledWith("Valor da parcela deve ser maior que zero");
      expect(sb.client.rpc).not.toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
    });

    it("erro do servidor mantém o dialog aberto", async () => {
      sb.rpcResultado("rpc_grupo_parcela_editar_em_aberto", { data: null, error: { message: "x" } });
      const { user, onChanged } = setup();
      await abrir(user, "Editar parcelas em aberto");
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Não foi possível atualizar as parcelas", expect.anything())
      );
      expect(onChanged).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("renegociar", () => {
    async function preencher(user: ReturnType<typeof userEvent.setup>, total: string, n: string) {
      const dlg = await abrir(user, "Renegociar grupo");
      const [totalInput, nInput] = [
        dlg.querySelector("input[inputmode=numeric]") as HTMLInputElement,
        dlg.querySelector("input[type=number]") as HTMLInputElement,
      ];
      if (total) await user.type(totalInput, total);
      if (n) await user.type(nInput, n);
      return dlg;
    }

    it("sem total, parcelas ou data não chama o banco", async () => {
      const { user } = setup();
      await preencher(user, "", "");
      await user.click(screen.getByRole("button", { name: "Renegociar" }));
      expect(toast.error).toHaveBeenCalledWith("Preencha total, parcelas e primeira data");
      expect(sb.client.rpc).not.toHaveBeenCalled();
    });

    async function escolherDia15(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByPlaceholderText("Selecione"));
      const dias = await screen.findAllByRole("button", { name: /15/ });
      await user.click(dias[0]);
    }

    it("renegocia com total, nº de parcelas e primeira data", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 10, 10, 10, 0));
      sb.rpcResultado("rpc_grupo_parcela_renegociar", { data: "grp-2", error: null });
      const { user, onChanged } = setup();
      await preencher(user, "120000", "6");
      await escolherDia15(user);
      await user.click(screen.getByRole("button", { name: "Renegociar" }));
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(sb.argsRpc("rpc_grupo_parcela_renegociar")).toEqual({
        p_grupo_id: "grp-1",
        p_novo_total: 1200,
        p_novo_num_parcelas: 6,
        p_nova_primeira_data: "2026-11-15",
        p_observacao: undefined,
      });
      expect(toast.success).toHaveBeenCalledWith("Grupo renegociado", { description: "Novo grupo: grp-2" });
      vi.useRealTimers();
    });

    it.each(["0", "361"])("nº de parcelas %s é recusado", async (n) => {
      const { user } = setup();
      await preencher(user, "120000", n);
      await escolherDia15(user);
      await user.click(screen.getByRole("button", { name: "Renegociar" }));
      expect(toast.error).toHaveBeenCalledWith("Nº de parcelas deve ser entre 1 e 360");
      expect(sb.client.rpc).not.toHaveBeenCalled();
    });

    it("total preenchido mas sem a primeira data não chama o banco", async () => {
      const { user } = setup();
      await preencher(user, "120000", "6");
      await user.click(screen.getByRole("button", { name: "Renegociar" }));
      expect(toast.error).toHaveBeenCalledWith("Preencha total, parcelas e primeira data");
      expect(sb.client.rpc).not.toHaveBeenCalled();
    });
  });

  describe("quitar antecipado", () => {
    it("data padrão é hoje no fuso local e envia desconto 0 sem quantidade", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 10, 10, 23, 0)); // 23h em SP = dia 11 em UTC
      sb.rpcResultado("rpc_grupo_parcela_quitar_antecipado", { data: 10, error: null });
      const { user, onChanged } = setup({ ...l, conta_id: "conta-1" });
      await abrir(user, "Quitar antecipado");
      await user.click(screen.getByRole("button", { name: "Quitar" }));
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(sb.argsRpc("rpc_grupo_parcela_quitar_antecipado")).toEqual({
        p_grupo_id: "grp-1",
        p_data_pagamento: "2026-11-10",
        p_quantidade: undefined,
        p_desconto_total: 0,
        p_conta_id: "conta-1",
      });
      expect(toast.success).toHaveBeenCalledWith("10 parcela(s) quitada(s)");
      vi.useRealTimers();
    });

    it("envia quantidade e desconto informados", async () => {
      sb.rpcResultado("rpc_grupo_parcela_quitar_antecipado", { data: 3, error: null });
      const { user, onChanged } = setup({ ...l, conta_id: "conta-1" });
      const dlg = await abrir(user, "Quitar antecipado");
      const [qtd] = Array.from(dlg.querySelectorAll("input[type=number]")) as HTMLInputElement[];
      await user.type(qtd, "3");
      await user.type(screen.getByRole("textbox", { name: "Desconto total" }), "4590");
      await user.click(screen.getByRole("button", { name: "Quitar" }));
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(sb.argsRpc("rpc_grupo_parcela_quitar_antecipado")).toMatchObject({
        p_quantidade: 3,
        p_desconto_total: 45.9,
      });
    });

    it("sem conta escolhida não quita (o saldo da conta não bateria)", async () => {
      const { user, onChanged } = setup();
      await abrir(user, "Quitar antecipado");
      await user.click(screen.getByRole("button", { name: "Quitar" }));
      expect(toast.error).toHaveBeenCalledWith("Escolha a conta do pagamento");
      expect(sb.client.rpc).not.toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
    });

    it("escolher a conta envia p_conta_id", async () => {
      sb.rpcResultado("rpc_grupo_parcela_quitar_antecipado", { data: 1, error: null });
      const { user, onChanged } = setup();
      await abrir(user, "Quitar antecipado");
      await user.selectOptions(screen.getByRole("combobox", { name: "Conta" }), "conta-1");
      await user.click(screen.getByRole("button", { name: "Quitar" }));
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(sb.argsRpc("rpc_grupo_parcela_quitar_antecipado")).toMatchObject({ p_conta_id: "conta-1" });
    });

    it("despesa no cartão não pede conta (quem paga é a fatura)", async () => {
      sb.rpcResultado("rpc_grupo_parcela_quitar_antecipado", { data: 1, error: null });
      const { user, onChanged } = setup({ ...l, cartao_id: "cartao-1" });
      await abrir(user, "Quitar antecipado");
      expect(screen.queryByRole("combobox", { name: "Conta" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Quitar" }));
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(sb.argsRpc("rpc_grupo_parcela_quitar_antecipado")?.p_conta_id).toBeUndefined();
    });

    it("quantidade zero é recusada", async () => {
      const { user } = setup();
      const dlg = await abrir(user, "Quitar antecipado");
      const [qtd] = Array.from(dlg.querySelectorAll("input[type=number]")) as HTMLInputElement[];
      await user.type(qtd, "0");
      await user.click(screen.getByRole("button", { name: "Quitar" }));
      expect(toast.error).toHaveBeenCalledWith("Quantidade deve ser um número inteiro maior que zero");
      expect(sb.client.rpc).not.toHaveBeenCalled();
    });
  });
});
