import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { PainelGestao } from "@/hooks/usePainelGestao";
import type { Feature } from "@/lib/permissions";
import { CATALOGO, LAYOUT_PADRAO, POR_ID } from "./catalogo";
import { PainelGrid } from "./PainelGrid";

/**
 * O construtor de painel (SPEC 092, ADR 0038). Cobre as regras que o desenho
 * decidiu: padrão enxuto e sem dinheiro, catálogo filtrado por permissão,
 * layout que sobrevive a widget desconhecido, e edição que só grava ao salvar.
 */

const podeTudo = new Set<Feature>(["projetos", "propostas", "leads", "obras", "financeiro", "ai_chat"]);
let permitidas = new Set<Feature>(podeTudo);

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (f: Feature) => permitidas.has(f) }),
}));

// recharts mede o container, que em jsdom tem largura zero.
vi.mock("./blocos/Graficos", () => ({
  ConversaoMensalChart: () => <div data-testid="chart-conversao" />,
  PontualidadeChart: () => <div data-testid="chart-pontualidade" />,
  ThroughputChart: () => <div data-testid="chart-throughput" />,
}));

function dados(): PainelGestao {
  return {
    gestao: {
      propostasTotais: { enviadas: 9, ganhas: 2, perdidas: 4, aguardando: 3, conversaoPct: 33 },
      funil: [{ etapa: "aceita", n: 2 }],
      conversaoMensal: [{ mes: "2026-09-01", ganhas: 2, perdidas: 4 }],
      motivosPerda: [{ motivo: "Preço", n: 5 }],
      esperaProposta: [{ faixa: "Até 7 dias", n: 3 }],
      origemGanho: [{ origem: "Indicação", leads: 8, ganhoPct: 50 }],
      throughputSemanal: [{ semana: "2026-08-31", n: 9 }],
      cargaEquipe: [{ pessoaId: "u1", nome: "Marcos A.", emDia: 4, atrasada: 1 }],
      filaAprovacao: [],
    },
    projetos: {
      totais: {
        ativos: 6,
        emAndamento: 3,
        planejamento: 1,
        paralisado: 1,
        atrasados: 2,
        risco: 1,
        semPrazo: 0,
        concluidosAno: 10,
      },
      statusAtivos: [{ status: "Em andamento", n: 3 }],
      pontualidadeMensal: [
        { mes: "2026-07-01", pct: 70, total: 2 },
        { mes: "2026-08-01", pct: 69, total: 3 },
        { mes: "2026-09-01", pct: 67, total: 3 },
      ],
      atrasoPorDisciplina: [{ disciplina: "Eletrica", diasMedio: 8, entregas: 4 }],
      prazos15Dias: [],
      horasPorProjeto: [],
    },
    obras: {
      totais: { emAndamento: 2, planejadas: 1, paralisadas: 0, atrasadas: 1 },
      rdoPorObra: [],
      avancoPorObra: [],
    },
    financeiro: null,
    cobertura: { desde: "2025-09-01", projetosSemPrazo: 0, leadsSemMotivoPadrao: 2 },
  };
}

function montar(props: Partial<React.ComponentProps<typeof PainelGrid>> = {}) {
  const onSalvar = vi.fn().mockResolvedValue(undefined);
  const onRestaurar = vi.fn().mockResolvedValue(undefined);
  const onEditar = vi.fn();
  const utils = render(
    <MemoryRouter>
      <PainelGrid
        data={dados()}
        layout={LAYOUT_PADRAO}
        usandoPadrao
        editando={false}
        salvando={false}
        onEditar={onEditar}
        onSalvar={onSalvar}
        onRestaurar={onRestaurar}
        {...props}
      />
    </MemoryRouter>
  );
  return { ...utils, onSalvar, onRestaurar, onEditar };
}

describe("catálogo do painel", () => {
  it("o layout padrão é enxuto e não tem nenhum widget financeiro", () => {
    expect(LAYOUT_PADRAO.length).toBeLessThanOrEqual(6);
    const secoes = LAYOUT_PADRAO.map((i) => POR_ID.get(i.w)?.secao);
    expect(secoes).not.toContain("financeiro");
  });

  it("todo widget do catálogo declara tamanho padrão entre os que aceita", () => {
    for (const w of CATALOGO) {
      expect(w.tamanhos).toContain(w.padrao);
      expect(w.tamanhos.length).toBeGreaterThan(0);
    }
  });

  it("todo id do catálogo é único e todo id do padrão existe", () => {
    expect(new Set(CATALOGO.map((w) => w.id)).size).toBe(CATALOGO.length);
    for (const item of LAYOUT_PADRAO) expect(POR_ID.has(item.w)).toBe(true);
  });

  it("widget financeiro exige a feature financeiro", () => {
    for (const w of CATALOGO.filter((x) => x.secao === "financeiro")) {
      expect(w.feature).toBe("financeiro");
    }
  });
});

describe("painel em leitura", () => {
  it("mostra os números palpáveis do padrão, sem controle de widget na tela", () => {
    montar();
    expect(screen.getByText("projetos ativos")).toBeInTheDocument();
    expect(screen.getByText("com prazo estourado")).toBeInTheDocument();
    // Em leitura, nenhum controle de edição aparece.
    expect(screen.queryByLabelText(/^Mover /)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Remover /)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Personalizar" })).toBeInTheDocument();
  });

  it("ignora widget desconhecido no layout em vez de quebrar a tela", () => {
    montar({ layout: [{ w: "widget_que_saiu_num_release", s: "meia" }, { w: "projetos_numeros", s: "inteira" }] });
    expect(screen.getByText("projetos ativos")).toBeInTheDocument();
  });

  it("não renderiza widget cuja permissão o usuário perdeu", () => {
    permitidas = new Set<Feature>(["projetos"]);
    montar({ layout: [{ w: "fin_mes", s: "meia" }, { w: "projetos_numeros", s: "inteira" }] });
    expect(screen.queryByText("Caixa do mês")).not.toBeInTheDocument();
    expect(screen.getByText("projetos ativos")).toBeInTheDocument();
    permitidas = new Set<Feature>(podeTudo);
  });
});

describe("painel em edição", () => {
  it("oferece o catálogo agrupado por módulo e marca o que já está no painel", async () => {
    const user = userEvent.setup();
    montar({ editando: true });

    await user.click(screen.getByRole("button", { name: /Adicionar indicador/ }));
    const seletor = screen.getByLabelText("Indicadores disponíveis");

    expect(within(seletor).getByText("Gestão")).toBeInTheDocument();
    expect(within(seletor).getByText("Projetos")).toBeInTheDocument();
    expect(within(seletor).getByText("Obras")).toBeInTheDocument();
    // "Projetos em números" está no padrão, então vem marcado e desabilitado.
    const jaUsado = within(seletor).getByRole("button", { name: /Projetos em números/ });
    expect(jaUsado).toBeDisabled();
  });

  it("esconde a seção Financeiro do catálogo de quem não pode ver dinheiro", async () => {
    permitidas = new Set<Feature>(["projetos", "propostas", "leads"]);
    const user = userEvent.setup();
    montar({ editando: true });

    await user.click(screen.getByRole("button", { name: /Adicionar indicador/ }));
    const seletor = screen.getByLabelText("Indicadores disponíveis");
    expect(within(seletor).queryByText("Financeiro")).not.toBeInTheDocument();
    expect(within(seletor).queryByText("Caixa do mês")).not.toBeInTheDocument();
    permitidas = new Set<Feature>(podeTudo);
  });

  it("adiciona widget e só grava quando o usuário salva", async () => {
    const user = userEvent.setup();
    const { onSalvar } = montar({ editando: true });

    await user.click(screen.getByRole("button", { name: /Adicionar indicador/ }));
    await user.click(screen.getByRole("button", { name: /Carga da equipe/ }));
    expect(onSalvar).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Salvar painel" }));
    expect(onSalvar).toHaveBeenCalledTimes(1);
    const salvo = onSalvar.mock.calls[0][0] as { w: string; s: string }[];
    expect(salvo.map((i) => i.w)).toContain("gestao_carga_equipe");
    expect(salvo).toHaveLength(LAYOUT_PADRAO.length + 1);
  });

  it("remove widget e troca o tamanho no rascunho, sem tocar no layout salvo", async () => {
    const user = userEvent.setup();
    const { onSalvar } = montar({ editando: true });

    await user.click(screen.getByLabelText("Remover Projetos em números"));
    await user.selectOptions(screen.getByLabelText("Tamanho de Entregamos no prazo?"), "inteira");
    await user.click(screen.getByRole("button", { name: "Salvar painel" }));

    const salvo = onSalvar.mock.calls[0][0] as { w: string; s: string }[];
    expect(salvo.map((i) => i.w)).not.toContain("projetos_numeros");
    expect(salvo.find((i) => i.w === "projetos_pontualidade")?.s).toBe("inteira");
  });

  it("cancelar descarta o rascunho", async () => {
    const user = userEvent.setup();
    const { onSalvar, onEditar } = montar({ editando: true });

    await user.click(screen.getByLabelText("Remover Projetos em números"));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onSalvar).not.toHaveBeenCalled();
    expect(onEditar).toHaveBeenCalledWith(false);
  });

  it("restaurar padrão grava lista vazia, que é o que significa padrão", async () => {
    const user = userEvent.setup();
    const { onRestaurar } = montar({ editando: true });

    await user.click(screen.getByRole("button", { name: /Restaurar padrão/ }));
    expect(onRestaurar).toHaveBeenCalledTimes(1);
  });
});
