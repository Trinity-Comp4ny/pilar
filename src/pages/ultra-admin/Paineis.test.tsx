import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { EmpresaRow } from "./api";
import type { CustosIa as Custos, Requisicao } from "./custos";
import type { EventoAtividade, Incidente } from "./hooks";

// Painéis do ultra admin: Visão geral (KPIs, "precisa de atenção" com teste vencendo, atraso,
// vencidas, gasto anômalo, feedback e incidentes) e Custos de IA (KPIs, margem negativa e as
// três visões: por empresa, por agente e últimas chamadas).

const DIA = 86_400_000;
const h = vi.hoisted(() => ({
  empresas: [] as EmpresaRow[],
  custos: undefined as Custos | undefined,
  requisicoes: [] as Requisicao[],
  incidentes: [] as Incidente[],
  atividade: [] as EventoAtividade[],
  feedbackNovos: 0,
  carregando: false,
  erroCustos: null as Error | null,
}));
vi.mock("./hooks", () => ({
  useEmpresas: () => ({ data: h.empresas, isLoading: h.carregando }),
  useIncidentes: () => ({ data: h.incidentes }),
  useAtividade: () => ({ data: h.atividade, isLoading: false }),
}));
vi.mock("./custos", async (orig) => ({
  ...(await orig<typeof import("./custos")>()),
  useCustosIa: () => ({ data: h.custos, isLoading: h.carregando, error: h.erroCustos }),
  useUltimasRequisicoes: () => ({ data: h.requisicoes, isLoading: false, error: null }),
}));
// O cartão de origem das demonstrações tem teste próprio (OrigemDemos.test.ts).
vi.mock("./components/OrigemDemos", () => ({ OrigemDemos: () => null }));
vi.mock("@/hooks/useFeedbackNovosCount", () => ({ useFeedbackNovosCount: () => ({ data: h.feedbackNovos }) }));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { TooltipProvider } from "@/components/ui/tooltip";
import VisaoGeral from "./VisaoGeral";
import CustosIa from "./CustosIa";

function empresa(over: Partial<EmpresaRow>): EmpresaRow {
  return {
    id: "e1",
    nome: "Alfa",
    cnpj: null,
    status: "active",
    features: {},
    plano: "pro",
    usersCount: 3,
    cobranca: { status: "active", trialEndsAt: null, isPaying: true, convidada: false },
    createdAt: new Date(Date.now() - 2 * DIA).toISOString(),
    ultimoAcesso: null,
    ...over,
  };
}

const custos = (over: Partial<Custos["totais"]> = {}): Custos => ({
  porEmpresa: [
    {
      empresaId: "e1",
      empresaNome: "Alfa",
      planoNome: "Pro",
      chamadas: 10,
      tokensTotal: 5000,
      custo: 12,
      receita: 400,
      margem: 388,
      tokensHoje: 90000,
      mediaAnteriorGasto: 3000,
      anomaliaGasto: true,
    },
    {
      empresaId: "e2",
      empresaNome: "Beta",
      planoNome: null,
      chamadas: 0,
      tokensTotal: 0,
      custo: 30,
      receita: null,
      margem: null,
      tokensHoje: 0,
      mediaAnteriorGasto: 0,
      anomaliaGasto: false,
    },
    {
      empresaId: "e3",
      empresaNome: "Gama",
      planoNome: "Starter",
      chamadas: 2,
      tokensTotal: 10,
      custo: 300,
      receita: 200,
      margem: -100,
      tokensHoje: 0,
      mediaAnteriorGasto: 0,
      anomaliaGasto: false,
    },
  ],
  porAgente: [{ agentKey: "agente-desconhecido", chamadas: 12, tokensTotal: 5010, custo: 342 }],
  totais: { custo: 342, receita: 600, chamadas: 12, tokens: 5010, anomalias: 1, ...over },
});

function Local() {
  const l = useLocation();
  return <p data-testid="local">{l.pathname + l.search}</p>;
}

function montar(el: React.ReactNode) {
  // O app monta o TooltipProvider na raiz.
  render(
    <TooltipProvider>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={el} />
          <Route path="*" element={<Local />} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>
  );
}

beforeEach(() => {
  h.carregando = false;
  h.erroCustos = null;
  h.feedbackNovos = 0;
  h.incidentes = [];
  h.atividade = [];
  h.requisicoes = [];
  h.custos = undefined;
  h.empresas = [];
});

describe("VisaoGeral", () => {
  it("sem dados: tudo zerado, nada pedindo atenção e vazios", () => {
    montar(<VisaoGeral />);
    expect(screen.getByText("Nada pedindo atenção agora.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma empresa cadastrada ainda.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma atividade registrada ainda.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma chamada no mês")).toBeInTheDocument();
    expect(screen.getByText("0 pagantes · 0 em teste · 0 convidadas")).toBeInTheDocument();
  });

  it("lista o que precisa de atenção, com plural e singular", () => {
    h.empresas = [
      empresa({}),
      empresa({
        id: "e2",
        nome: "Beta",
        cobranca: {
          status: "trialing",
          trialEndsAt: new Date(Date.now() + 20 * 3_600_000).toISOString(),
          isPaying: false,
          convidada: false,
        },
      }),
      empresa({
        id: "e3",
        nome: "Gama",
        cobranca: { status: "overdue", trialEndsAt: null, isPaying: true, convidada: false },
      }),
      empresa({
        id: "e4",
        nome: "Delta",
        cobranca: { status: "expired", trialEndsAt: null, isPaying: false, convidada: false },
      }),
      empresa({ id: "e5", nome: "Arquivada", status: "cancelled", usersCount: 50 }),
      empresa({
        id: "e6",
        nome: "Velha",
        createdAt: "2020-01-01T00:00:00Z",
        cobranca: {
          status: "trialing",
          trialEndsAt: new Date(Date.now() + 10 * DIA).toISOString(),
          isPaying: false,
          convidada: false,
        },
      }),
    ];
    h.custos = custos();
    h.feedbackNovos = 1;
    h.incidentes = [
      { id: "i1", status: "investigando" } as Incidente,
      { id: "i2", status: "monitorando" } as Incidente,
      { id: "i3", status: "resolvido" } as Incidente,
    ];
    montar(<VisaoGeral />);
    expect(screen.getByText(/^Beta: teste vence/)).toBeInTheDocument();
    expect(screen.queryByText(/^Velha: teste/)).not.toBeInTheDocument();
    expect(screen.getByText("Gama: pagamento em atraso")).toBeInTheDocument();
    expect(screen.getByText("1 empresa só leitura depois do teste")).toBeInTheDocument();
    expect(screen.getByText("Alfa: gasto de IA fora do normal hoje")).toBeInTheDocument();
    expect(screen.getByText("1 feedback sem triagem")).toBeInTheDocument();
    expect(screen.getByText("2 incidentes abertos na status page")).toBeInTheDocument();
    // Arquivada fica fora das contas: 5 ativas, 15 usuários.
    expect(screen.getByText("em 5 empresas")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("4 nos últimos 7 dias")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Em atraso: 1" })).toHaveAttribute(
      "href",
      "/ultra-admin/empresas?situacao=em_atraso"
    );
  });

  it("plural de vencidas, feedbacks e incidente único", () => {
    h.empresas = [
      empresa({ id: "a", cobranca: { status: "expired", trialEndsAt: null, isPaying: false, convidada: false } }),
      empresa({
        id: "b",
        cobranca: { status: "expired", trialEndsAt: null, isPaying: false, convidada: false },
        usersCount: 1,
      }),
    ];
    h.feedbackNovos = 3;
    h.incidentes = [{ id: "i1", status: "identificado" } as Incidente];
    montar(<VisaoGeral />);
    expect(screen.getByText("2 empresas só leitura depois do teste")).toBeInTheDocument();
    expect(screen.getByText("3 feedbacks sem triagem")).toBeInTheDocument();
    expect(screen.getByText("1 incidente aberto na status page")).toBeInTheDocument();
    expect(screen.getAllByText(/1 usuário$/).length).toBeGreaterThan(0);
  });

  it("atividade recente mostra o ator antes do @ e KPIs navegam", async () => {
    const user = userEvent.setup();
    h.custos = custos();
    h.atividade = [
      {
        id: "a1",
        quando: new Date().toISOString(),
        ator: "matheus@pilar.app",
        frase: "criou a empresa Alfa",
        detalhe: null,
        tipo: "empresa",
        empresaId: "e1",
        link: null,
      },
      {
        id: "a2",
        quando: new Date().toISOString(),
        ator: null,
        frase: "Nova empresa",
        detalhe: null,
        tipo: "cadastro",
        empresaId: null,
        link: null,
      },
    ];
    montar(<VisaoGeral />);
    expect(screen.getByText("matheus")).toBeInTheDocument();
    expect(screen.getByText("Nova empresa")).toBeInTheDocument();
    expect(screen.getByText(/12 chamadas · R\$\s?28,50 cada/)).toBeInTheDocument();
    await user.click(screen.getByText("Custo de IA no mês"));
    expect(screen.getByTestId("local")).toHaveTextContent("/ultra-admin/custos-ia");
  });

  it("carregando mostra esqueleto no lugar das listas", () => {
    h.carregando = true;
    montar(<VisaoGeral />);
    expect(screen.queryByText("Nada pedindo atenção agora.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhuma empresa cadastrada ainda.")).not.toBeInTheDocument();
  });
});

describe("CustosIa", () => {
  it("sem dados mostra o vazio e KPIs zerados", () => {
    montar(<CustosIa />);
    expect(screen.getByText("Nenhuma chamada de IA neste mês.")).toBeInTheDocument();
  });

  it("por empresa: anomalia, 'Não paga', margem negativa e '-' sem chamadas", () => {
    h.custos = custos();
    montar(<CustosIa />);
    const tabela = screen.getByRole("table");
    expect(within(tabela).getByText("Gasto alto hoje")).toBeInTheDocument();
    expect(within(tabela).getByText("Não paga")).toBeInTheDocument();
    expect(within(tabela).getByText(/-R\$\s?100,00|R\$\s?-100,00/)).toBeInTheDocument();
    expect(screen.getByText("1 com gasto alto hoje")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?28,50 por chamada/)).toBeInTheDocument();
  });

  it("clicar na empresa abre o detalhe", async () => {
    const user = userEvent.setup();
    h.custos = custos();
    montar(<CustosIa />);
    await user.click(within(screen.getByRole("table")).getByText("Beta"));
    expect(screen.getByTestId("local")).toHaveTextContent("/ultra-admin/empresas/e2");
  });

  it("por agente e últimas chamadas", async () => {
    const user = userEvent.setup();
    h.custos = custos();
    h.requisicoes = [
      {
        id: "r1",
        quando: new Date().toISOString(),
        empresaId: "e1",
        empresaNome: "Alfa",
        agentKey: "chat",
        model: null,
        tokensInput: 100,
        tokensOutput: 20,
        custo: 0.003,
      },
    ];
    montar(<CustosIa />);
    await user.click(screen.getByRole("button", { name: "Por agente" }));
    expect(within(screen.getByRole("table")).getByText("agente-desconhecido")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Últimas chamadas" }));
    const tabela = screen.getByRole("table");
    expect(within(tabela).getByText("100 · 20")).toBeInTheDocument();
    expect(within(tabela).getByText("R$ 0,0030")).toBeInTheDocument();
    expect(within(tabela).getByText("-")).toBeInTheDocument();
    await user.click(within(tabela).getByText("Alfa"));
    expect(screen.getByTestId("local")).toHaveTextContent("/ultra-admin/empresas/e1");
  });

  it("erro no uso mostra a mensagem", () => {
    h.erroCustos = new Error("x");
    montar(<CustosIa />);
    expect(screen.getByText("Não foi possível carregar o uso por empresa")).toBeInTheDocument();
  });
});
