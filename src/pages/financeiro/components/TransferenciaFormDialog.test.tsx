import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { sb } from "../testing/supabaseMock";
import { campoInput, campoSelect } from "../testing/dom";

// Transferência entre contas: origem ≠ destino, valor > 0, payload da RPC,
// edição e erro do servidor.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("../testing/supabaseMock")).sb.client,
}));
vi.mock("@/components/ui/select", async () => await import("../testing/nativeSelect"));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { TransferenciaFormDialog } from "./TransferenciaFormDialog";

const TZ_ORIGINAL = process.env.TZ;
beforeAll(() => {
  // Fuso do cliente (UTC−3): "hoje" à noite no Brasil já é amanhã em UTC.
  process.env.TZ = "America/Sao_Paulo";
});
afterAll(() => {
  process.env.TZ = TZ_ORIGINAL;
});

type Props = Partial<React.ComponentProps<typeof TransferenciaFormDialog>>;

function setup(props: Props = {}) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  render(<TransferenciaFormDialog open onOpenChange={onOpenChange} onSaved={onSaved} {...props} />);
  return { onOpenChange, onSaved };
}

async function esperarContas() {
  await waitFor(() =>
    expect(Array.from(campoSelect("Conta de origem *").options).map((o) => o.value)).toContain("c-1")
  );
}

const origem = (v: string) => fireEvent.change(campoSelect("Conta de origem *"), { target: { value: v } });
const destino = (v: string) => fireEvent.change(campoSelect("Conta de destino *"), { target: { value: v } });
const valor = (digitos: string) => fireEvent.change(campoInput("Valor *"), { target: { value: digitos } });
const criar = () => fireEvent.click(screen.getByRole("button", { name: /^(Criar|Atualizar)$/ }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 14, 0));
  vi.clearAllMocks();
  sb.reset();
  sb.resultado("contas.select", {
    data: [
      { id: "c-1", nome: "Itaú PJ" },
      { id: "c-2", nome: "Nubank" },
    ],
    error: null,
  });
  sb.rpcResultado("rpc_criar_transferencia", { data: null, error: null });
  sb.rpcResultado("rpc_editar_transferencia", { data: null, error: null });
});
afterEach(() => vi.useRealTimers());

describe("TransferenciaFormDialog", () => {
  it("sem contas escolhidas não grava", async () => {
    setup();
    await esperarContas();
    valor("10000");
    criar();
    expect(toast.error).toHaveBeenCalledWith("Selecione conta de origem e destino");
    expect(sb.client.rpc).not.toHaveBeenCalled();
  });

  it("só a origem escolhida não grava", async () => {
    setup();
    await esperarContas();
    origem("c-1");
    valor("10000");
    criar();
    expect(toast.error).toHaveBeenCalledWith("Selecione conta de origem e destino");
    expect(sb.client.rpc).not.toHaveBeenCalled();
  });

  it("destino igual à origem fica indisponível na lista", async () => {
    setup();
    await esperarContas();
    origem("c-1");
    const opcao = Array.from(campoSelect("Conta de destino *").options).find((o) => o.value === "c-1");
    expect(opcao?.disabled).toBe(true);
  });

  it("valor vazio ou zero é recusado", async () => {
    setup();
    await esperarContas();
    origem("c-1");
    destino("c-2");
    criar();
    expect(toast.error).toHaveBeenCalledWith("Valor inválido");
    valor("000");
    criar();
    expect(toast.error).toHaveBeenLastCalledWith("Valor inválido");
    expect(sb.client.rpc).not.toHaveBeenCalled();
  });

  it("cria a transferência com o payload exato", async () => {
    const { onSaved, onOpenChange } = setup();
    await esperarContas();
    origem("c-1");
    destino("c-2");
    valor("250075");
    fireEvent.change(campoInput("Descrição"), { target: { value: "  Reserva  " } });
    criar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sb.argsRpc("rpc_criar_transferencia")).toEqual({
      p_conta_origem_id: "c-1",
      p_conta_destino_id: "c-2",
      p_valor: 2500.75,
      p_data: "2026-11-10",
      p_descricao: "Reserva",
      p_status: "Concluída",
      p_observacao: null,
    });
    expect(toast.success).toHaveBeenCalledWith("Transferência criada");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("à noite (UTC já virou o dia) a data padrão continua sendo hoje no fuso local", async () => {
    vi.setSystemTime(new Date(2026, 10, 10, 22, 30)); // 22h30 em São Paulo = 01h30 UTC do dia 11
    const { onSaved } = setup();
    await esperarContas();
    origem("c-1");
    destino("c-2");
    valor("10000");
    criar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sb.argsRpc("rpc_criar_transferencia")).toMatchObject({ p_data: "2026-11-10" });
  });

  it("status Pendente é enviado", async () => {
    const { onSaved } = setup();
    await esperarContas();
    origem("c-2");
    destino("c-1");
    valor("100");
    fireEvent.change(campoSelect("Status"), { target: { value: "Pendente" } });
    criar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sb.argsRpc("rpc_criar_transferencia")).toMatchObject({ p_status: "Pendente", p_valor: 1 });
  });

  it("erro do servidor mantém aberto e avisa", async () => {
    sb.rpcResultado("rpc_criar_transferencia", { data: null, error: { message: "saldo insuficiente" } });
    const { onSaved, onOpenChange } = setup();
    await esperarContas();
    origem("c-1");
    destino("c-2");
    valor("10000");
    criar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", expect.anything()));
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(campoSelect("Conta de origem *")).toHaveValue("c-1");
  });

  it("edição carrega os dados e chama a RPC de edição", async () => {
    const { onSaved } = setup({
      transferencia: {
        id: "t-1",
        conta_id: "c-1",
        contraparte_id: "c-2",
        valor: 300,
        data_vencimento: "2026-10-01T00:00:00",
        descricao: "Aporte",
        status: "Concluída",
        observacao: null,
      },
    });
    await esperarContas();
    expect(screen.getByRole("heading", { name: "Editar transferência" })).toBeInTheDocument();
    expect(campoSelect("Conta de origem *")).toHaveValue("c-1");
    valor("45000");
    criar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sb.argsRpc("rpc_editar_transferencia")).toMatchObject({
      p_id: "t-1",
      p_valor: 450,
      p_data: "2026-10-01",
      p_descricao: "Aporte",
    });
    expect(sb.argsRpc("rpc_criar_transferencia")).toBeUndefined();
    expect(toast.success).toHaveBeenCalledWith("Transferência atualizada");
  });
});
