import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PainelGestao } from "@/hooks/usePainelGestao";
import { SecaoComercial, SecaoProdutividade, SecaoProjetos } from "./components/painel/PainelSecoes";

/**
 * Render das três seções do painel (SPEC 092). Cobre os critérios de aceite de
 * tela: nenhum R$ aparece, estado vazio explica o que falta em vez de mostrar
 * 0%, e nome de pessoa vira iniciais quando o painel está em modo público.
 */

// recharts mede o container, que em jsdom tem largura zero: stub mantém o teste
// focado no que a tela decide, não na geometria do SVG.
vi.mock("./components/painel/PainelCharts", () => ({
  ConversaoMensalChart: () => <div data-testid="chart-conversao" />,
  PontualidadeChart: () => <div data-testid="chart-pontualidade" />,
  ThroughputChart: () => <div data-testid="chart-throughput" />,
}));

function painel(over: Partial<PainelGestao> = {}): PainelGestao {
  return {
    ancoras: {
      conversao: { valor: 41, anterior: 35, decididas: 22 },
      prazo: { valor: 71, anterior: 78 },
      concluidasSemana: { valor: 34, media: 40 },
      desvioHoras: { valor: 14 },
      aguardandoCliente: { valor: 11, parados: 4 },
    },
    comercial: {
      funil: [
        { etapa: "rascunho", n: 6 },
        { etapa: "enviada", n: 11 },
        { etapa: "aceita", n: 9 },
        { etapa: "recusada", n: 10 },
        { etapa: "expirada", n: 3 },
      ],
      conversaoMensal: [{ mes: "2026-09-01", ganhas: 9, perdidas: 13 }],
      motivosPerda: [
        { motivo: "Preço", n: 14 },
        { motivo: "Prazo", n: 9 },
      ],
      esperaProposta: [
        { faixa: "Até 7 dias", n: 3 },
        { faixa: "Mais de 30 dias", n: 4 },
      ],
      origemGanho: [{ origem: "Indicação", leads: 22, ganhoPct: 58 }],
    },
    entrega: {
      semaforo: { noPrazo: 12, risco: 3, estourado: 2, semPrazo: 1 },
      statusAtivos: [{ status: "Em andamento", n: 9 }],
      pontualidadeMensal: [
        { mes: "2026-07-01", pct: 70, total: 2 },
        { mes: "2026-08-01", pct: 69, total: 3 },
        { mes: "2026-09-01", pct: 68, total: 4 },
      ],
      atrasoPorDisciplina: [{ disciplina: "Elétrica", diasMedio: 14, entregas: 6 }],
      prazos15Dias: [
        {
          disciplinaId: "d1",
          disciplina: "Elétrica",
          projetoId: "p1",
          projeto: "Residencial Vila Rica",
          dias: 2,
          responsavel: "Fernando",
          iniciais: "FL",
        },
      ],
    },
    produtividade: {
      throughputSemanal: [{ semana: "2026-08-31", n: 34 }],
      horasPorProjeto: [
        { projetoId: "p1", projeto: "Residencial Vila Rica", estimadas: 420, realizadas: 580, desvioPct: 38 },
      ],
      cargaEquipe: [{ pessoaId: "u1", nome: "Fernando Lima", iniciais: "FL", emDia: 5, atrasada: 3 }],
      filaAprovacao: [{ escopoId: "e1", tipo: "aditivo", projetoId: "p1", projeto: "Vila Rica", dias: 22 }],
    },
    cobertura: { desde: "2025-07-01", projetosSemPrazo: 3, propostasSemHistorico: 22, leadsSemMotivoPadrao: 8 },
    ...over,
  };
}

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("painel de gestão", () => {
  it("não exibe nenhum valor monetário em nenhuma das três seções", () => {
    const p = painel();
    const { container } = wrap(
      <>
        <SecaoComercial data={p} />
        <SecaoProjetos data={p} ocultarNomes={false} />
        <SecaoProdutividade data={p} ocultarNomes={false} />
      </>
    );
    // O requisito central do ADR 0037: dinheiro não existe nesta tela.
    expect(container.textContent).not.toMatch(/R\$|\bmargem\b|faturament/i);
  });

  it("mostra o funil em contagem, com rótulo de etapa legível", () => {
    wrap(<SecaoComercial data={painel()} />);
    expect(screen.getByText("Rascunho, nunca enviada")).toBeInTheDocument();
    expect(screen.getByText("Enviada, sem decisão")).toBeInTheDocument();
  });

  it("troca nome de pessoa por iniciais quando o painel está em modo público", () => {
    const p = painel();
    const { rerender } = wrap(<SecaoProdutividade data={p} ocultarNomes={false} />);
    expect(screen.getByText("Fernando Lima")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <SecaoProdutividade data={p} ocultarNomes />
      </MemoryRouter>
    );
    expect(screen.queryByText("Fernando Lima")).not.toBeInTheDocument();
    expect(screen.getByText("FL")).toBeInTheDocument();
  });

  it("explica o que falta em vez de desenhar série vazia quando não há histórico", () => {
    const p = painel({
      entrega: { ...painel().entrega, pontualidadeMensal: [{ mes: "2026-09-01", pct: null, total: 0 }] },
    });
    wrap(<SecaoProjetos data={p} ocultarNomes={false} />);
    expect(screen.getByText(/Nenhum projeto concluído com data de previsão/)).toBeInTheDocument();
    expect(screen.queryByTestId("chart-pontualidade")).not.toBeInTheDocument();
  });

  it("exige 3 meses de histórico antes de publicar a série de pontualidade", () => {
    const p = painel({
      entrega: {
        ...painel().entrega,
        pontualidadeMensal: [
          { mes: "2026-08-01", pct: 70, total: 2 },
          { mes: "2026-09-01", pct: 68, total: 1 },
        ],
      },
    });
    wrap(<SecaoProjetos data={p} ocultarNomes={false} />);
    expect(screen.getByText(/fica confiável a partir de 3 meses/)).toBeInTheDocument();
  });

  it("marca disciplina já vencida com o texto de atraso, não com contagem futura", () => {
    const p = painel({
      entrega: {
        ...painel().entrega,
        prazos15Dias: [
          {
            disciplinaId: "d2",
            disciplina: "Hidráulica",
            projetoId: "p2",
            projeto: "Galpão",
            dias: -6,
            responsavel: "Camila",
            iniciais: "CS",
          },
        ],
      },
    });
    wrap(<SecaoProjetos data={p} ocultarNomes={false} />);
    expect(screen.getByText("venceu há 6 d")).toBeInTheDocument();
  });
});
