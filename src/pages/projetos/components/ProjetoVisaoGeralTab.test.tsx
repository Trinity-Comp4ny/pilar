import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatDateShort } from "@/lib/format";
import type { DisciplinaResponsavel } from "@/types/projetos";
import type { ResumoPagamentos } from "../hooks/usePagamentosProjeto";
import type { ProjetoTimelineEvento } from "../hooks/useProjetoTimeline";
import { ProjetoVisaoGeralTab } from "./ProjetoVisaoGeralTab";

const dados = vi.hoisted(() => ({
  pronta: true,
  acessoFinanceiro: true,
  resumo: undefined as ResumoPagamentos | undefined,
  eventos: undefined as ProjetoTimelineEvento[] | undefined,
  pagamentos: vi.fn(),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    ready: dados.pronta,
    can: (modulo: string) => modulo === "financeiro" && dados.acessoFinanceiro,
  }),
}));
vi.mock("../hooks/usePagamentosProjeto", () => ({ usePagamentosProjeto: dados.pagamentos }));
vi.mock("../hooks/useProjetoTimeline", () => ({ useProjetoTimeline: () => ({ data: dados.eventos }) }));
vi.mock("recharts", async (original) => {
  const real = await original<typeof import("recharts")>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement(children)
        ? cloneElement(children as ReactElement<{ width?: number; height?: number }>, { width: 400, height: 180 })
        : null,
  };
});

const resumo: ResumoPagamentos = {
  totalContrato: 1000,
  totalFaturado: 700,
  totalRecebido: 300,
  totalPendente: 400,
  totalAtrasado: 150,
  percentualRecebido: 30,
  proximoVencimento: "2026-12-10",
  qtdPendentes: 2,
  qtdAtrasados: 1,
};

function disciplina(disciplina: string, dados: Partial<DisciplinaResponsavel> = {}): DisciplinaResponsavel {
  return { disciplina, responsavel_id: "", responsavel_nome: "", ...dados };
}

function evento(tipo: ProjetoTimelineEvento["tipo"], disciplinaNome: string | null = null): ProjetoTimelineEvento {
  return {
    tipo,
    ocorridoEm: "2026-11-17T12:00:00Z",
    disciplinaId: null,
    disciplinaNome,
    detalhe: null,
    autorNome: null,
  };
}

function itemDaLegenda(rotulo: string) {
  return within(screen.getByText(rotulo).closest("li")!);
}

describe("ProjetoVisaoGeralTab", () => {
  beforeEach(() => {
    dados.pronta = true;
    dados.acessoFinanceiro = true;
    dados.resumo = undefined;
    dados.eventos = undefined;
    dados.pagamentos
      .mockReset()
      .mockImplementation(() => ({ data: dados.resumo ? { resumo: dados.resumo } : undefined }));
  });

  it("mostra indicadores e estados vazios do projeto", () => {
    render(
      <ProjetoVisaoGeralTab
        projetoId="projeto-1"
        disciplinas={[]}
        progresso={0}
        indicadores={<p>Prazo do projeto</p>}
      />
    );
    expect(screen.getByText("Prazo do projeto")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma disciplina cadastrada.")).toBeInTheDocument();
    expect(screen.getByText(/Sem horas lançadas/)).toBeInTheDocument();
    expect(screen.getByText("Nenhum pagamento lançado ainda.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum evento ainda")).toBeInTheDocument();
  });

  it.each([
    [false, true],
    [true, false],
  ])("omite pagamentos sem permissão confirmada (%s, %s)", (pronta, acesso) => {
    dados.pronta = pronta;
    dados.acessoFinanceiro = acesso;
    dados.resumo = resumo;
    render(<ProjetoVisaoGeralTab projetoId="projeto-1" disciplinas={[]} progresso={0} />);
    expect(screen.queryByText("Pagamentos")).not.toBeInTheDocument();
    expect(dados.pagamentos).toHaveBeenCalledWith(undefined);
  });

  it("agrupa o status, conta só atrasos ativos e exibe horas lançadas", async () => {
    const antiga = "2000-01-01";
    const disciplinas = [
      disciplina("Elétrica", { status: "Concluído", data_previsao: antiga, horas_estimadas: 30 }),
      disciplina("Estrutural", { status: "Em Andamento", data_previsao: antiga, horas_realizadas: 12 }),
      disciplina("Hidráulica", { status: "Pausada", data_previsao: antiga }),
      disciplina("Fundação", { status: "Pendente", data_previsao: antiga }),
      disciplina("Paisagismo"),
    ];
    const { rerender } = render(
      <ProjetoVisaoGeralTab projetoId="projeto-1" disciplinas={disciplinas} progresso={20} />
    );
    expect(screen.getByText("1 de 5 disciplinas concluídas")).toBeInTheDocument();
    expect(screen.getByText("2 disciplinas atrasadas")).toBeInTheDocument();
    for (const status of ["Concluído", "Em Andamento", "Pausada", "Pendente", "Não Iniciado"]) {
      expect(itemDaLegenda(status).getByText("1")).toBeInTheDocument();
    }
    expect(screen.queryByText(/Sem horas lançadas/)).not.toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Concluído: 1" })).toHaveAttribute("aria-label", "Concluído: 1");
    rerender(<ProjetoVisaoGeralTab projetoId="projeto-1" disciplinas={disciplinas.slice(0, 3)} progresso={33} />);
    expect(screen.getByText("1 disciplina atrasada")).toBeInTheDocument();
  });

  it("separa parcelas pendentes e atrasadas e mostra o próximo vencimento", () => {
    dados.resumo = resumo;
    const { rerender } = render(<ProjetoVisaoGeralTab projetoId="projeto-1" disciplinas={[]} progresso={0} />);
    expect(dados.pagamentos).toHaveBeenCalledWith("projeto-1");
    expect(itemDaLegenda("Recebido").getByText("R$ 300,00")).toBeInTheDocument();
    expect(itemDaLegenda("Pendente").getByText("R$ 250,00")).toBeInTheDocument();
    expect(itemDaLegenda("Atrasado").getByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.getByText(formatDateShort("2026-12-10"))).toBeInTheDocument();
    dados.resumo = { ...resumo, proximoVencimento: null };
    rerender(<ProjetoVisaoGeralTab projetoId="projeto-1" disciplinas={[]} progresso={0} />);
    expect(screen.queryByText(/Próximo vencimento/)).not.toBeInTheDocument();
    dados.resumo = { ...resumo, totalFaturado: 0 };
    rerender(<ProjetoVisaoGeralTab projetoId="projeto-1" disciplinas={[]} progresso={0} />);
    expect(screen.getByText("Nenhum pagamento lançado ainda.")).toBeInTheDocument();
  });

  it("limita o resumo aos cinco eventos mais recentes com seus rótulos", () => {
    dados.eventos = [
      evento("portal_acesso_concedido"),
      evento("projeto_retomado"),
      evento("projeto_pausado"),
      evento("disciplina_concluida", "Estrutural"),
      evento("disciplina_iniciada", "Hidráulica"),
      evento("projeto_iniciado"),
    ];
    render(<ProjetoVisaoGeralTab projetoId="projeto-1" disciplinas={[]} progresso={0} />);
    expect(screen.getByText("Acesso ao portal liberado")).toBeInTheDocument();
    expect(screen.getByText("Projeto retomado")).toBeInTheDocument();
    expect(screen.getByText("Projeto pausado")).toBeInTheDocument();
    expect(within(screen.getByText("Disciplina concluída").closest("li")!).getByText("Estrutural")).toBeInTheDocument();
    expect(screen.getByText("Disciplina iniciada")).toBeInTheDocument();
    expect(screen.queryByText("Projeto iniciado")).not.toBeInTheDocument();
  });
});

it("usa as entregas aprovadas em vez de misturar a porcentagem com disciplinas", () => {
  render(
    <ProjetoVisaoGeralTab
      projetoId="p1"
      disciplinas={[disciplina("Estrutural")]}
      progresso={30}
      entregas={{ total: 4, aprovadas: 3 }}
    />
  );
  expect(screen.getByText("3 de 4 entregas aprovadas")).toBeInTheDocument();
  expect(screen.getByText("75%")).toBeInTheDocument();
});
