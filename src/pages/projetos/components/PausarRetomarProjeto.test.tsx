import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Pausar e retomar o projeto inteiro (spec 141): motivo obrigatório, aviso de quantas
// disciplinas param, antes/depois dos prazos e erro do banco sem fechar o diálogo.

type Resultado = { data: unknown; error: unknown };
const tabelas: Record<string, Resultado> = {};
const rpc = vi.fn();

/** Query builder encadeável: qualquer método devolve o próprio builder; await resolve o resultado da tabela. */
function builder(tabela: string) {
  const alvo: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(alvo, {
    get(_t, prop) {
      if (prop === "then") {
        const r = tabelas[tabela] ?? { data: [], error: null };
        return (ok: (v: Resultado) => unknown, err?: (e: unknown) => unknown) => Promise.resolve(r).then(ok, err);
      }
      return () => proxy;
    },
  });
  return proxy;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => builder(t),
    rpc: (...a: unknown[]) => rpc(...a),
  },
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { PausarProjetoDialog } from "./PausarProjetoDialog";
import { RetomarProjetoDialog } from "./RetomarProjetoDialog";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function diasAtras(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

describe("PausarProjetoDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(tabelas)) delete tabelas[k];
    rpc.mockResolvedValue({ error: null });
  });

  function montar() {
    const onOpenChange = vi.fn();
    render(<PausarProjetoDialog projetoId="proj-1" projetoNome="Edifício Seed" open onOpenChange={onOpenChange} />, {
      wrapper: wrapper(),
    });
    return { onOpenChange };
  }

  it("avisa quantas disciplinas abertas serão pausadas (concluídas e pausadas não contam)", async () => {
    tabelas.projeto_disciplinas = {
      data: [{ status: "Em andamento" }, { status: "Não Iniciado" }, { status: "Concluído" }, { status: "Pausada" }],
      error: null,
    };
    montar();
    expect(await screen.findByText(/2 disciplinas abertas serão pausadas/)).toBeInTheDocument();
  });

  it("sem motivo o botão fica travado e nada é enviado", () => {
    montar();
    const botao = screen.getByRole("button", { name: "Pausar projeto" });
    expect(botao).toBeDisabled();
    fireEvent.click(botao);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("pausa com o motivo, avisa e fecha", async () => {
    const { onOpenChange } = montar();
    fireEvent.change(screen.getByLabelText("Motivo da pausa"), { target: { value: "Cliente suspendeu" } });
    fireEvent.click(screen.getByRole("button", { name: "Pausar projeto" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(rpc).toHaveBeenCalledWith("rpc_pausar_projeto", { p_projeto_id: "proj-1", p_motivo: "Cliente suspendeu" });
    expect(toast.success).toHaveBeenCalledWith("Projeto pausado. Os prazos ficam congelados até você retomar.");
  });

  it("erro P0001 do banco mostra a mensagem dele e mantém aberto", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "P0001", message: "Projeto já está pausado" } });
    const { onOpenChange } = montar();
    fireEvent.change(screen.getByLabelText("Motivo da pausa"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Pausar projeto" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Projeto já está pausado"));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Motivo da pausa")).toHaveValue("x");
  });

  it("erro genérico vira a mensagem padrão", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "42501", message: "permission denied" } });
    montar();
    fireEvent.change(screen.getByLabelText("Motivo da pausa"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Pausar projeto" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível pausar o projeto. Nada foi alterado. Tente de novo.")
    );
  });
});

describe("RetomarProjetoDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(tabelas)) delete tabelas[k];
    rpc.mockResolvedValue({ error: null });
  });

  function montar(props: { etapaDestinoId?: string } = {}) {
    const onOpenChange = vi.fn();
    render(
      <RetomarProjetoDialog projetoId="proj-1" dataPrevisao="2026-12-01" open onOpenChange={onOpenChange} {...props} />,
      { wrapper: wrapper() }
    );
    return { onOpenChange };
  }

  it("sem pausa aberta carregada não deixa retomar", () => {
    tabelas.projeto_pausas = { data: [], error: null };
    montar();
    expect(screen.getByRole("button", { name: "Retomar projeto" })).toBeDisabled();
    expect(screen.getByText("Carregando a pausa do projeto.")).toBeInTheDocument();
  });

  it("mostra o antes e depois dos prazos empurrados pelos dias parados", async () => {
    tabelas.projeto_pausas = {
      data: [{ id: "pz-1", motivo: "x", pausado_em: diasAtras(3), retomado_em: null }],
      error: null,
    };
    tabelas.projeto_disciplina_pausas = {
      data: [{ projeto_disciplinas: { id: "d1", nome: "Estrutural", data_fim: "2026-11-20" } }],
      error: null,
    };
    montar();
    expect(await screen.findByText(/Os prazos avançam 3 dias/)).toBeInTheDocument();
    expect(await screen.findByText("Estrutural")).toBeInTheDocument();
    expect(screen.getByText("23/11/2026")).toBeInTheDocument();
    expect(screen.getByText("Previsão do projeto")).toBeInTheDocument();
    expect(screen.getByText("04/12/2026")).toBeInTheDocument();
  });

  it("retoma para a etapa de destino do arraste e fecha", async () => {
    tabelas.projeto_pausas = {
      data: [{ id: "pz-1", motivo: "x", pausado_em: diasAtras(1), retomado_em: null }],
      error: null,
    };
    const { onOpenChange } = montar({ etapaDestinoId: "etapa-9" });
    const botao = await screen.findByRole("button", { name: "Retomar projeto" });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(rpc).toHaveBeenCalledWith("rpc_retomar_projeto", { p_projeto_id: "proj-1", p_etapa_id: "etapa-9" });
    expect(toast.success).toHaveBeenCalledWith("Projeto retomado. Os prazos avançaram 1 dia.");
  });

  it("erro ao retomar mantém o diálogo aberto", async () => {
    tabelas.projeto_pausas = {
      data: [{ id: "pz-1", motivo: "x", pausado_em: new Date().toISOString(), retomado_em: null }],
      error: null,
    };
    rpc.mockResolvedValueOnce({ error: { message: "x" } });
    const { onOpenChange } = montar();
    expect(await screen.findByText("Pausado hoje. Os prazos não mudam.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retomar projeto" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível retomar o projeto. Nada foi alterado. Tente de novo.")
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
