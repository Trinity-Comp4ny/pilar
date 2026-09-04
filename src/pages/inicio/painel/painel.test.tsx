import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { PainelGestao } from "@/hooks/usePainelGestao";
import type { Feature } from "@/lib/permissions";
import { CATALOGO, LAYOUT_PADRAO, POR_ID } from "./catalogo";
import { PainelGrid } from "./PainelGrid";
import { sobraDaLinha } from "./grade";

/**
 * O construtor de painel (SPEC 092, ADR 0038). Cobre as regras que o desenho
 * decidiu: padrão enxuto e sem dinheiro, catálogo filtrado por permissão,
 * layout que sobrevive a widget desconhecido, e edição que só grava ao salvar.
 */

const podeTudo: Feature[] = ["projetos", "propostas", "leads", "obras", "financeiro", "ai_chat"];
let permitidas = new Set<Feature>(podeTudo);

// Reset por teste: restaurar no fim do corpo vaza a permissão para o próximo
// caso quando um teste falha antes de chegar lá, e foi assim que o teste de
// Obras quebrou por causa do teste de Financeiro.
beforeEach(() => {
  permitidas = new Set<Feature>(podeTudo);
});

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (f: Feature) => permitidas.has(f) }),
}));

// recharts mede o container, que em jsdom tem largura zero.
vi.mock("./blocos/Graficos", () => ({
  ConversaoMensalChart: () => <div data-testid="chart-conversao" />,
  PontualidadeChart: () => <div data-testid="chart-pontualidade" />,
  ThroughputChart: () => <div data-testid="chart-throughput" />,
  FaturamentoChart: () => <div data-testid="chart-faturamento" />,
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
    extra: {
      efetivoObra: [{ obraId: "o1", obra: "Galpão", media: 12, dias: 5 }],
      projetosPorCliente: [{ clienteId: "c1", cliente: "Marlim", ativos: 4, atrasados: 1 }],
    },
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
  });
});

describe("painel em edição", () => {
  it("abre o catálogo num popup, agrupado por módulo, marcando o que já está no painel", async () => {
    const user = userEvent.setup();
    montar({ editando: true });

    await user.click(screen.getAllByRole("button", { name: /Adicionar widget/ })[0]);
    const popup = await screen.findByRole("dialog");

    expect(within(popup).getByText("Adicionar widget")).toBeInTheDocument();
    expect(within(popup).getByText("Gestão")).toBeInTheDocument();
    expect(within(popup).getByText("Projetos")).toBeInTheDocument();
    expect(within(popup).getByText("Obras")).toBeInTheDocument();
    // Os widgets do padrão aparecem marcados como já no painel (o layout padrão
    // tem 6, então há mais de uma marca).
    expect(within(popup).getAllByText("no painel").length).toBeGreaterThan(0);
  });

  it("mostra o preview do indicador com dados de exemplo antes de adicionar", async () => {
    const user = userEvent.setup();
    montar({ editando: true });

    await user.click(screen.getAllByRole("button", { name: /Adicionar widget/ })[0]);
    const popup = await screen.findByRole("dialog");
    await user.click(within(popup).getByRole("button", { name: /Carga da equipe.*Ver preview/s }));

    // O preview é rotulado como exemplo, para o número não ser confundido com
    // o dado da empresa.
    expect(within(popup).getByText("exemplo")).toBeInTheDocument();
    expect(within(popup).getByText(/Números de exemplo/)).toBeInTheDocument();
    // E o widget aparece montado: a carga de exemplo tem nomes fictícios.
    expect(within(popup).getByText("Marcos A.")).toBeInTheDocument();
    expect(within(popup).getByRole("button", { name: /Voltar/ })).toBeInTheDocument();
  });

  it("esconde a seção Financeiro do catálogo de quem não pode ver dinheiro", async () => {
    permitidas = new Set<Feature>(["projetos", "propostas", "leads"]);
    const user = userEvent.setup();
    montar({ editando: true });

    await user.click(screen.getAllByRole("button", { name: /Adicionar widget/ })[0]);
    const popup = await screen.findByRole("dialog");
    expect(within(popup).queryByText("Financeiro")).not.toBeInTheDocument();
    expect(within(popup).queryByText("Caixa do mês")).not.toBeInTheDocument();
  });

  it("adiciona widget pelo preview e só grava quando o usuário salva", async () => {
    const user = userEvent.setup();
    const { onSalvar } = montar({ editando: true });

    await user.click(screen.getAllByRole("button", { name: /Adicionar widget/ })[0]);
    const popup = await screen.findByRole("dialog");
    await user.click(within(popup).getByRole("button", { name: /Carga da equipe.*Ver preview/s }));
    await user.click(within(popup).getByRole("button", { name: /Adicionar ao painel/ }));
    expect(onSalvar).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Salvar painel" }));
    expect(onSalvar).toHaveBeenCalledTimes(1);
    const salvo = onSalvar.mock.calls[0][0] as { w: string; s: string }[];
    expect(salvo.map((i) => i.w)).toContain("gestao_carga_equipe");
    expect(salvo).toHaveLength(LAYOUT_PADRAO.length + 1);
  });

  it("troca o tamanho no rascunho, sem tocar no layout salvo", async () => {
    const user = userEvent.setup();
    const { onSalvar } = montar({ editando: true });

    await user.selectOptions(screen.getByLabelText("Tamanho de Entregamos no prazo?"), "inteira");
    await user.click(screen.getByRole("button", { name: "Salvar painel" }));

    const salvo = onSalvar.mock.calls[0][0] as { w: string; s: string }[];
    expect(salvo.find((i) => i.w === "projetos_pontualidade")?.s).toBe("inteira");
  });

  it("cancelar descarta o rascunho", async () => {
    const user = userEvent.setup();
    const { onSalvar, onEditar } = montar({ editando: true });

    await user.click(screen.getByLabelText("Remover Vence nos próximos 15 dias"));
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

describe("faixa fixa de KPIs", () => {
  it("renderiza os widgets de zona topo numa faixa fixa, fora da grade", () => {
    montar();
    const faixa = screen.getByLabelText("Indicadores fixos");
    // O padrão fixa os dois blocos de contagem.
    expect(within(faixa).getByText("projetos ativos")).toBeInTheDocument();
    expect(within(faixa).getByText("propostas em 90 dias")).toBeInTheDocument();
    // E eles não aparecem duplicados na grade.
    expect(screen.getAllByText("projetos ativos")).toHaveLength(1);
  });

  it("solta um widget da faixa para a grade e vice-versa", async () => {
    const user = userEvent.setup();
    const { onSalvar } = montar({ editando: true });

    await user.click(screen.getByLabelText("Soltar Projetos em números da faixa fixa"));
    await user.click(screen.getByRole("button", { name: "Salvar painel" }));

    const salvo = onSalvar.mock.calls[0][0] as { w: string; z?: string }[];
    expect(salvo.find((i) => i.w === "projetos_numeros")?.z).toBeUndefined();
  });

  it("só oferece fixar para widget de contagem curta", async () => {
    const user = userEvent.setup();
    montar({ editando: true });

    // "Vence nos próximos 15 dias" é lista, não cabe na dock.
    expect(screen.queryByLabelText("Fixar Vence nos próximos 15 dias no topo")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Adicionar widget/ })[0]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

describe("grade agrupada por módulo", () => {
  it("mostra o título do módulo só quando ele tem widget", () => {
    montar({ layout: [{ w: "projetos_prazos_15", s: "meia" }] });
    expect(screen.getByRole("region", { name: "Projetos" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Obras" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Gestão" })).not.toBeInTheDocument();
  });

  it("mostra Obras quando há widget de obra no layout", () => {
    montar({ layout: [{ w: "obras_numeros", s: "inteira" }] });
    expect(screen.getByRole("region", { name: "Obras" })).toBeInTheDocument();
  });
});

describe("sobraDaLinha", () => {
  it("calcula o buraco que o cartão de adicionar precisa preencher", () => {
    // Dois terços ocupam 8 de 12: sobram 4.
    expect(sobraDaLinha([{ s: "terco" }, { s: "terco" }])).toBe(4);
    // Duas metades fecham a linha: nada sobra.
    expect(sobraDaLinha([{ s: "meia" }, { s: "meia" }])).toBe(0);
    // Uma inteira fecha a linha.
    expect(sobraDaLinha([{ s: "inteira" }])).toBe(0);
    // Meia mais terço: 10 de 12, sobram 2.
    expect(sobraDaLinha([{ s: "meia" }, { s: "terco" }])).toBe(2);
    // Três metades: a terceira começa linha nova e deixa 6 livres.
    expect(sobraDaLinha([{ s: "meia" }, { s: "meia" }, { s: "meia" }])).toBe(6);
    expect(sobraDaLinha([])).toBe(0);
  });
});

describe("painel vazio", () => {
  it("em leitura, oferece escolher indicadores em vez de deixar o usuário sem saída", () => {
    montar({ layout: [] });
    expect(screen.getByText("Nenhum indicador no painel.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escolher indicadores" })).toBeInTheDocument();
  });

  it("em edição, abre o catálogo direto: sem widget não existe cartão de seção para clicar", async () => {
    const user = userEvent.setup();
    montar({ layout: [], editando: true });

    await user.click(screen.getByRole("button", { name: /Adicionar widget/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
