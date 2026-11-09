import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Ficha do agente em /ultra-admin/time/:agente: id inválido ou "chefe" volta à
// Central; cada área mostra o painel dela; custo de 30 dias soma as execuções.
// Os painéis viram marcadores: aqui importa qual a ficha escolhe e o que passa.

const estado = vi.hoisted(() => ({
  agentes: [] as unknown[],
  decisoes: [] as { agente: string; titulo: string }[],
  execucoes: [] as { custo_usd: unknown }[] | undefined,
}));

vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("../custos", () => ({ emBrl: (usd: number) => usd * 5, useFormatCusto: () => (v: number) => `R$ ${v}` }));
vi.mock("./useTimeResumo", () => ({
  useTimeResumo: () => ({ agentes: estado.agentes, agentesQ: { isLoading: false }, decisoes: estado.decisoes }),
}));
vi.mock("./hooks", () => ({
  useExecucoesDoAgente: () => ({ data: estado.execucoes }),
  useEfeitosDoAgente: () => ({ data: undefined }),
}));
vi.mock("./components/AgenteCabecalho", () => ({
  AgenteCabecalho: ({ status, custo30d }: { status: string; custo30d: string | null }) => (
    <p>
      cabecalho:{status}:{custo30d ?? "sem-custo"}
    </p>
  ),
}));
vi.mock("./components/BriefingAgente", () => ({ BriefingAgente: () => <p>briefing</p> }));
vi.mock("./components/ExecucoesAgente", () => ({
  ExecucoesAgente: ({ formatarCusto }: { formatarCusto: (usd: number) => string }) => (
    <p>execucoes:{formatarCusto(1)}</p>
  ),
}));
vi.mock("./components/ReceitaPainel", () => ({
  ReceitaPainel: ({ decisoes }: { decisoes: unknown[] }) => <p>receita:{decisoes.length}</p>,
}));
vi.mock("./components/ClientesPainel", () => ({
  ClientesPainel: ({ decisoes }: { decisoes: unknown[] }) => <p>clientes:{decisoes.length}</p>,
}));
vi.mock("./components/TarefasDaArea", () => ({ TarefasDaArea: ({ titulo }: { titulo: string }) => <p>{titulo}</p> }));
vi.mock("./components/MarketingExterno", () => ({ MarketingExterno: () => <p>marketing-externo</p> }));
vi.mock("./components/AgentePlanejado", () => ({ AgentePlanejado: ({ id }: { id: string }) => <p>planejado:{id}</p> }));

import AgenteFicha from "./AgenteFicha";

function abrir(agente: string) {
  render(
    <MemoryRouter initialEntries={[`/ultra-admin/time/${agente}`]}>
      <Routes>
        <Route path="/ultra-admin/time/:agente" element={<AgenteFicha />} />
        <Route path="/ultra-admin/time" element={<p>central</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  estado.agentes = [];
  estado.decisoes = [];
  estado.execucoes = [];
});

describe("AgenteFicha", () => {
  it("agente desconhecido ou o chefe voltam para a Central", () => {
    abrir("inexistente");
    expect(screen.getByText("central")).toBeInTheDocument();
  });

  it("chefe também volta para a Central", () => {
    abrir("chefe");
    expect(screen.getByText("central")).toBeInTheDocument();
  });

  it("receita: nome, status, custo somado e só as decisões da área", () => {
    estado.agentes = [{ agente: { id: "receita", nome: "Receita" }, status: "ok", ultima: null, pendentes: 0 }];
    estado.decisoes = [
      { agente: "receita", titulo: "a" },
      { agente: "clientes", titulo: "b" },
    ];
    estado.execucoes = [{ custo_usd: "0.5" }, { custo_usd: 1.5 }, { custo_usd: null }];
    abrir("receita");
    expect(screen.getByRole("heading", { name: "Receita" })).toBeInTheDocument();
    expect(screen.getByText("cabecalho:ok:R$ 10")).toBeInTheDocument();
    expect(screen.getByText("receita:1")).toBeInTheDocument();
    expect(screen.getByText("briefing")).toBeInTheDocument();
    expect(screen.getByText("execucoes:R$ 5")).toBeInTheDocument();
  });

  it("sem resumo carregado: título genérico, status planejado e sem custo", () => {
    estado.execucoes = undefined;
    abrir("clientes");
    expect(screen.getByRole("heading", { name: "Agente" })).toBeInTheDocument();
    expect(screen.getByText("cabecalho:planejado:sem-custo")).toBeInTheDocument();
    expect(screen.getByText("clientes:0")).toBeInTheDocument();
  });

  it.each([
    ["produto", "Tarefas da semana"],
    ["qualidade", "Erros para olhar"],
    ["marketing", "marketing-externo"],
  ])("%s mostra o painel da área", (id, texto) => {
    abrir(id);
    expect(screen.getByText(texto)).toBeInTheDocument();
  });

  it("agente ainda planejado (finanças) mostra o plano", () => {
    abrir("financas");
    expect(screen.getByText("planejado:financas")).toBeInTheDocument();
  });
});
