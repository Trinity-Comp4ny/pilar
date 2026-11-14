import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { sb } from "@/pages/financeiro/testing/supabaseMock";
import type { ClienteReceita } from "@/pages/cliente/useClienteProjetoData";

// Conteúdo do portal do cliente: parcelas e progresso de pagamento, linha do tempo
// das etapas, cartão de pendências (atraso pela data LOCAL) e entregas para
// aprovar ou pedir revisão (cliente por token; equipe lendo direto).

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/financeiro/testing/supabaseMock")).sb.client,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: vi.fn() }));
const portal = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("@/hooks/useClienteAuth", () => ({ getPortalToken: () => portal.token }));

import { toast } from "sonner";
import { reportInvokeError } from "@/lib/monitoring";
import { FinanceiroContent } from "./PortalFinanceiro";
import { TimelineContent } from "./PortalTimeline";
import { BadgePendencias, PendenciasCard } from "./PendenciasCard";
import { EntregasContent } from "./PortalEntregas";

const TZ_ORIGINAL = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Sao_Paulo";
});
afterAll(() => {
  process.env.TZ = TZ_ORIGINAL;
});

beforeEach(() => {
  vi.clearAllMocks();
  sb.reset();
  portal.token = null;
  vi.useFakeTimers({ toFake: ["Date"] });
  // 22h30 em SP: em UTC já é dia 11.
  vi.setSystemTime(new Date(2026, 10, 10, 22, 30));
});
afterEach(() => vi.useRealTimers());

const nb = (s: string | null | undefined) => (s ?? "").replace(/\u00a0/g, " ");

function receita(p: Partial<ClienteReceita>): ClienteReceita {
  return {
    id: "r1",
    descricao: "Parcela 1",
    valor: 1000,
    data_vencimento: "2026-11-20",
    data_recebimento: null,
    status: "Pendente",
    ...p,
  };
}

describe("FinanceiroContent", () => {
  it("resume total, pago e pendente, mostra o progresso e o status de cada parcela", () => {
    render(
      <FinanceiroContent
        receitas={[
          receita({ id: "a", descricao: "Entrada", status: "Recebido", data_recebimento: "2026-10-05" }),
          receita({ id: "b", descricao: "Medição", status: "Pago", valor: 500 }),
          receita({ id: "c", descricao: "Atrasada", data_vencimento: "2026-11-09", valor: 1500 }),
          receita({ id: "d", descricao: "Hoje", data_vencimento: "2026-11-10", valor: 1000 }),
        ]}
      />
    );
    expect(nb(document.body.textContent)).toContain("R$ 4.000,00");
    expect(screen.getByText("38% pago")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progresso de pagamento" })).toHaveAttribute("aria-valuenow", "38");
    const entrada = screen.getByText("Entrada").closest("div.border") as HTMLElement;
    expect(within(entrada).getByText(/Pago em: 05\/10\/2026/)).toBeInTheDocument();
    expect(within(screen.getByText("Atrasada").closest("div.border") as HTMLElement).getByText("Atrasado"));
    // Vence hoje (data local), mesmo com o UTC já no dia seguinte: não está atrasada.
    expect(
      within(screen.getByText("Hoje").closest("div.border") as HTMLElement).queryByText("Atrasado")
    ).not.toBeInTheDocument();
  });

  it("sem parcelas: vazio e sem barra de progresso", () => {
    render(<FinanceiroContent receitas={[]} />);
    expect(screen.getByText("Nenhuma parcela registrada")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("TimelineContent", () => {
  it("calcula o progresso e mostra só o status de cada etapa, sem datas nem responsável", () => {
    render(
      <TimelineContent
        disciplinas={[
          {
            disciplina: "Arquitetura",
            status: "Concluído",
          },
          { disciplina: "Estrutural", status: "Em andamento" },
          { disciplina: "Elétrica", status: "Pausada" },
          { disciplina: "Hidráulica" },
        ]}
      />
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("25% concluído · 1 de 4 etapas")).toBeInTheDocument();
    expect(screen.queryByText(/Início:|Previsão:|Responsável:/)).not.toBeInTheDocument();
    expect(screen.getByText("Não iniciado")).toBeInTheDocument();
  });

  it("sem etapas: 0% e mensagem de vazio", () => {
    render(<TimelineContent disciplinas={[]} />);
    expect(screen.getByText("0% concluído · 0 de 0 etapas")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma etapa cadastrada.")).toBeInTheDocument();
  });
});

describe("PendenciasCard", () => {
  function Local() {
    return <span data-testid="local">{useLocation().pathname}</span>;
  }
  function renderCard(receitas: ClienteReceita[]) {
    render(
      <MemoryRouter initialEntries={["/p/1"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <PendenciasCard baseUrl="/p/1" receitas={receitas} />
                <Local />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );
  }

  it("nada pendente: parcela que vence hoje à noite não conta como atraso", () => {
    renderCard([
      receita({ data_vencimento: "2026-12-30" }),
      receita({ id: "x", status: "Recebido", data_vencimento: "2026-11-01" }),
      receita({ id: "y", data_vencimento: "" }),
    ]);
    expect(screen.getByText("Nada pendente")).toBeInTheDocument();
  });

  it("vence hoje conta como 'vencendo em 7 dias', não como atraso", () => {
    renderCard([receita({ data_vencimento: "2026-11-10" })]);
    expect(screen.getByText("1 parcela vencendo em 7 dias")).toBeInTheDocument();
    expect(screen.queryByText(/em atraso/)).not.toBeInTheDocument();
    expect(screen.getByText(/1 item precisa/)).toBeInTheDocument();
  });

  it("lista atrasos e vencimentos próximos e navega para a aba certa", () => {
    renderCard([
      receita({ id: "a", data_vencimento: "2026-11-01" }),
      receita({ id: "b", data_vencimento: "2026-11-05" }),
      receita({ id: "c", data_vencimento: "2026-11-15" }),
      receita({ id: "d", data_vencimento: "2026-11-16" }),
    ]);
    expect(screen.getByText(/4 itens precisam/)).toBeInTheDocument();
    expect(screen.queryByText(/entrega/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("2 parcelas em atraso"));
    expect(screen.getByTestId("local").textContent).toBe("/p/1/financeiro");
    fireEvent.click(screen.getByText("2 parcelas vencendo em 7 dias"));
    expect(screen.getByTestId("local").textContent).toBe("/p/1/financeiro");
  });

  it("singular para uma parcela atrasada", () => {
    renderCard([receita({ data_vencimento: "2026-11-01" })]);
    expect(screen.getByText("1 parcela em atraso")).toBeInTheDocument();
  });

  it("BadgePendencias some com zero e flexiona o plural", () => {
    const { rerender, container } = render(<BadgePendencias count={0} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<BadgePendencias count={1} />);
    expect(screen.getByText("1 pendente")).toBeInTheDocument();
    rerender(<BadgePendencias count={3} />);
    expect(screen.getByText("3 pendentes")).toBeInTheDocument();
  });
});

describe("EntregasContent", () => {
  const entrega = (p: Record<string, unknown>) => ({
    id: "e1",
    titulo: "Prancha A1",
    descricao: null,
    tipo: null,
    status: "pendente",
    drive_url: null,
    projeto_disciplina_id: null,
    disciplina_nome: null,
    resposta_cliente: null,
    respondido_em: null,
    aprovado_ip: null,
    aprovado_user_agent: null,
    created_at: "2026-11-01T12:00:00Z",
    ...p,
  });

  it("equipe (sem token) lê direto da tabela e vê o histórico com IP da aprovação", async () => {
    sb.resultado("portal_entregas.select", {
      data: [
        {
          ...entrega({ id: "e2", status: "aprovado", respondido_em: "2026-11-02T15:00:00Z", aprovado_ip: "1.2.3.4" }),
          projeto_disciplinas: { nome: "Arquitetura" },
        },
        {
          ...entrega({ id: "e3", status: "revisao_solicitada", resposta_cliente: "Ajustar cotas" }),
          projeto_disciplinas: null,
        },
      ],
      error: null,
    });
    render(<EntregasContent projetoId="p1" readOnly />);
    expect(await screen.findByText("Respondidas")).toBeInTheDocument();
    expect(screen.getByText("Arquitetura")).toBeInTheDocument();
    expect(screen.getByText(/IP 1\.2\.3\.4/)).toBeInTheDocument();
    expect(screen.getByText("Ajustar cotas")).toBeInTheDocument();
    expect(screen.getByText("Revisão solicitada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aprovar/ })).not.toBeInTheDocument();
    expect(sb.de("portal_entregas", "eq")[0].args).toEqual(["projeto_id", "p1"]);
  });

  it("erro ao carregar avisa na tela e reporta", async () => {
    sb.resultado("portal_entregas.select", { data: null, error: { message: "rls" } });
    render(<EntregasContent projetoId="p1" />);
    expect(await screen.findByText(/Não foi possível carregar as solicitações agora/)).toBeInTheDocument();
    expect(reportInvokeError).toHaveBeenCalledWith({ message: "rls" }, "portal-entregas:carregar");
  });

  it("sem entregas mostra o vazio", async () => {
    sb.resultado("portal_entregas.select", { data: [], error: null });
    render(<EntregasContent projetoId="p1" />);
    expect(await screen.findByText("Nenhuma solicitação no momento")).toBeInTheDocument();
  });

  it("cliente por token: lista pela RPC e aprova", async () => {
    portal.token = "tok";
    sb.rpcResultado("portal_listar_solicitacoes", {
      data: [entrega({ descricao: "Planta baixa", drive_url: "https://drive/x" })],
      error: null,
    });
    sb.rpcResultado("portal_aprovar_entrega", { data: null, error: null });
    render(<EntregasContent projetoId="p1" />);
    expect(await screen.findByText("Aguardando sua resposta (1)")).toBeInTheDocument();
    expect(screen.getByText("Planta baixa")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir no Drive/ })).toHaveAttribute("href", "https://drive/x");
    expect(sb.argsRpc("portal_listar_solicitacoes")).toEqual({ p_token: "tok", p_projeto_id: "p1", p_obra_id: null });

    fireEvent.click(screen.getByRole("button", { name: /Aprovar/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Aprovado"));
    expect(sb.argsRpc("portal_aprovar_entrega")).toEqual({ p_token: "tok", p_entrega_id: "e1" });
    expect(sb.client.rpc.mock.calls.filter((c) => c[0] === "portal_listar_solicitacoes")).toHaveLength(2);
  });

  it("token passado por prop tem prioridade; erro ao aprovar avisa", async () => {
    portal.token = "sessao";
    sb.rpcResultado("portal_listar_solicitacoes", { data: [entrega({})], error: null });
    sb.rpcResultado("portal_aprovar_entrega", { data: null, error: { message: "x" } });
    render(<EntregasContent projetoId="p1" token="prop" />);
    fireEvent.click(await screen.findByRole("button", { name: /Aprovar/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível aprovar", expect.anything()));
    expect(sb.argsRpc("portal_aprovar_entrega")).toEqual({ p_token: "prop", p_entrega_id: "e1" });
  });

  it("pedir revisão exige texto, envia aparado e pode ser cancelado", async () => {
    portal.token = "tok";
    sb.rpcResultado("portal_listar_solicitacoes", { data: [entrega({})], error: null });
    sb.rpcResultado("portal_solicitar_revisao_entrega", [
      { data: null, error: { message: "x" } },
      { data: null, error: null },
    ]);
    render(<EntregasContent projetoId="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Solicitar revisão/ }));
    const enviar = () => screen.getAllByRole("button", { name: /Solicitar revisão/ }).at(-1) as HTMLButtonElement;
    expect(enviar()).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByPlaceholderText(/Descreva/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Solicitar revisão/ }));
    fireEvent.change(screen.getByPlaceholderText(/Descreva/), { target: { value: "  Ajustar cotas  " } });
    fireEvent.click(enviar());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível enviar a solicitação", expect.anything())
    );
    expect(sb.argsRpc("portal_solicitar_revisao_entrega")).toEqual({
      p_token: "tok",
      p_entrega_id: "e1",
      p_resposta: "Ajustar cotas",
    });

    fireEvent.click(await screen.findByRole("button", { name: /Solicitar revisão/ }));
    fireEvent.change(screen.getByPlaceholderText(/Descreva/), { target: { value: "De novo" } });
    fireEvent.click(enviar());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Solicitação de revisão enviada"));
  });

  it("sem token a equipe não aprova nem pede revisão pelo portal", async () => {
    sb.resultado("portal_entregas.select", { data: [{ ...entrega({}), projeto_disciplinas: null }], error: null });
    render(<EntregasContent projetoId="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Aprovar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Solicitar revisão/ }));
    fireEvent.change(screen.getByPlaceholderText(/Descreva/), { target: { value: "x" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Solicitar revisão/ }).at(-1) as HTMLButtonElement);
    expect(sb.client.rpc).not.toHaveBeenCalled();
  });
});
