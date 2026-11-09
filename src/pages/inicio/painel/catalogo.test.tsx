import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { PainelGestao } from "@/pages/inicio/hooks/usePainelGestao";
import { CATALOGO, LAYOUT_PADRAO, PODE_FIXAR, POR_ID } from "./catalogo";
import { DADOS_EXEMPLO } from "./exemplo";

/**
 * Cada widget do catálogo do Início renderiza com dado cheio, com dado vazio e
 * sem financeiro, sem quebrar. Além disso, as regras de leitura que o desenho
 * decidiu (destaque só com líder claro, série curta não vira gráfico, frase de
 * concentração de cliente, gap de faturamento).
 */

// recharts mede o container (largura zero em jsdom): fixa um tamanho para o SVG sair.
vi.mock("recharts", async (orig) => {
  const real = await orig<typeof import("recharts")>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement(children)
        ? cloneElement(children as ReactElement<{ width: number; height: number }>, { width: 600, height: 240 })
        : null,
  };
});

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/** Mesma forma do exemplo, com toda lista vazia e todo número zerado. */
function zerar<T>(v: T): T {
  if (Array.isArray(v)) return [] as T;
  if (typeof v === "number") return 0 as T;
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, zerar(x)])) as T;
  }
  return v;
}

const VAZIO: PainelGestao = zerar(DADOS_EXEMPLO);
const SEM_FINANCEIRO: PainelGestao = { ...DADOS_EXEMPLO, financeiro: null, extra: null };

function renderWidget(id: string, data: PainelGestao) {
  const w = POR_ID.get(id)!;
  return render(
    <MemoryRouter>
      <div data-testid="corpo">{w.render(data)}</div>
      <div data-testid="leitura">{w.leitura?.(data)}</div>
    </MemoryRouter>
  );
}

describe("catálogo do painel", () => {
  it("ids únicos, padrão dentro dos tamanhos aceitos e layout padrão sem financeiro", () => {
    expect(new Set(CATALOGO.map((w) => w.id)).size).toBe(CATALOGO.length);
    for (const w of CATALOGO) expect(w.tamanhos).toContain(w.padrao);
    for (const item of LAYOUT_PADRAO) {
      const w = POR_ID.get(item.w)!;
      expect(w.secao).not.toBe("financeiro");
      expect(w.tamanhos).toContain(item.s);
      if (item.z === "topo") expect(PODE_FIXAR.has(item.w)).toBe(true);
    }
  });

  it.each(CATALOGO.map((w) => [w.id]))("%s renderiza com dado cheio", (id) => {
    renderWidget(id, DADOS_EXEMPLO);
    expect(screen.getByTestId("corpo")).not.toBeEmptyDOMElement();
  });

  it.each(CATALOGO.map((w) => [w.id]))("%s renderiza com dado vazio sem quebrar", (id) => {
    renderWidget(id, VAZIO);
    expect(screen.getByTestId("corpo")).not.toBeEmptyDOMElement();
  });

  it.each(CATALOGO.filter((w) => w.secao === "financeiro" || w.id.endsWith("_cliente") || w.id === "obras_efetivo"))(
    "$id sem financeiro/extra mostra o vazio e não lê nada",
    (w) => {
      renderWidget(w.id, SEM_FINANCEIRO);
      expect(screen.getByTestId("corpo").textContent).toMatch(/Sem acesso|Nenhum/);
      expect(screen.getByTestId("leitura").textContent).not.toMatch(/R\$|concentra/);
    }
  );

  it("vazios específicos explicam o porquê", () => {
    const casos: [string, string][] = [
      ["gestao_funil", "Nenhuma proposta criada nos últimos 90 dias."],
      ["gestao_conversao_mensal", "Sem proposta decidida nos últimos 12 meses."],
      ["gestao_motivo_perda", "Nenhum lead marcado como perdido nos últimos 12 meses."],
      ["gestao_espera_proposta", "Nenhuma proposta aguardando decisão."],
      ["gestao_ritmo_entrega", "Nenhuma tarefa concluída nas últimas 12 semanas."],
      ["projetos_pontualidade", "Nenhum projeto concluído com data de previsão nos últimos 12 meses."],
      ["obras_avanco", "Nenhuma obra em andamento com tarefa cadastrada."],
      ["fin_faturamento", "Nenhum marco de faturamento lançado neste ano."],
    ];
    for (const [id, texto] of casos) {
      const { unmount } = renderWidget(id, VAZIO);
      expect(screen.getByText(texto)).toBeInTheDocument();
      unmount();
    }
  });

  it("pontualidade com menos de 3 meses de dado não vira gráfico", () => {
    const pontualidadeMensal = DADOS_EXEMPLO.projetos.pontualidadeMensal.map((m, i) => ({
      ...m,
      total: i < 2 ? 1 : 0,
    }));
    renderWidget("projetos_pontualidade", {
      ...DADOS_EXEMPLO,
      projetos: { ...DADOS_EXEMPLO.projetos, pontualidadeMensal },
    });
    expect(screen.getByText(/Só 2 mês com projeto concluído/)).toBeInTheDocument();
  });

  it("projetos por cliente: alerta de concentração ou carteira distribuída", () => {
    const { unmount } = renderWidget("projetos_por_cliente", DADOS_EXEMPLO);
    // 6 de 15 = 40%: já concentra.
    expect(screen.getByTestId("leitura")).toHaveTextContent("Incorporadora Marlim concentra 40% dos projetos ativos");
    expect(screen.getAllByText("nenhum").length).toBeGreaterThan(0);
    unmount();

    renderWidget("projetos_por_cliente", {
      ...DADOS_EXEMPLO,
      extra: {
        ...DADOS_EXEMPLO.extra!,
        projetosPorCliente: [
          { clienteId: "a", cliente: "A", ativos: 3, atrasados: 0 },
          { clienteId: "b", cliente: "B", ativos: 3, atrasados: 0 },
          { clienteId: "c", cliente: "C", ativos: 3, atrasados: 0 },
        ],
      },
    });
    expect(screen.getByTestId("leitura")).toHaveTextContent("Carteira distribuída entre os clientes.");
  });

  it("faturamento: gap positivo vira frase com valor; sem gap diz que está em dia", () => {
    const { unmount } = renderWidget("fin_faturamento", DADOS_EXEMPLO);
    expect(screen.getByTestId("leitura")).toHaveTextContent(/de marco previsto que ainda não virou fatura/);
    unmount();
    renderWidget("fin_faturamento", {
      ...DADOS_EXEMPLO,
      financeiro: {
        ...DADOS_EXEMPLO.financeiro!,
        faturamento: [{ mes: "2026-10-01", previsto: 100, faturado: 120 }],
      },
    });
    expect(screen.getByTestId("leitura")).toHaveTextContent("Faturamento em dia com o previsto em contrato.");
  });

  it("caixa do mês mostra os quatro valores em reais", () => {
    renderWidget("fin_mes", DADOS_EXEMPLO);
    expect(screen.getByText("recebido no mês")).toBeInTheDocument();
    expect(screen.getByText("a receber vencido")).toBeInTheDocument();
    expect(screen.getByText(/186\.000/)).toBeInTheDocument();
  });

  it("origem do lead sem decisão aparece como tal", () => {
    renderWidget("gestao_origem_lead", {
      ...DADOS_EXEMPLO,
      gestao: { ...DADOS_EXEMPLO.gestao, origemGanho: [{ origem: "Feira", leads: 3, ganhoPct: null }] },
    });
    expect(screen.getByText("sem decisão")).toBeInTheDocument();
  });

  it("motivo de perda em empate não destaca ninguém; atraso por disciplina idem", () => {
    const empate = {
      ...DADOS_EXEMPLO,
      gestao: {
        ...DADOS_EXEMPLO.gestao,
        motivosPerda: [
          { motivo: "Preço", n: 3 },
          { motivo: "Prazo", n: 3 },
        ],
      },
      projetos: {
        ...DADOS_EXEMPLO.projetos,
        atrasoPorDisciplina: [
          { disciplina: "Elétrica", diasMedio: 5, entregas: 1 },
          { disciplina: "Hidráulica", diasMedio: 5, entregas: 2 },
        ],
      },
    } as PainelGestao;
    // A barra em alerta é pintada com o tom de estado (bg-negative).
    const alertas = (c: HTMLElement) => c.querySelectorAll(".bg-negative").length;
    let r = renderWidget("gestao_motivo_perda", empate);
    expect(alertas(r.container)).toBe(0);
    r.unmount();
    r = renderWidget("gestao_motivo_perda", DADOS_EXEMPLO);
    expect(alertas(r.container)).toBe(1);
    r.unmount();
    r = renderWidget("projetos_atraso_disciplina", empate);
    expect(alertas(r.container)).toBe(0);
    expect(screen.getByTitle("1 entrega concluída com atraso")).toBeInTheDocument();
    expect(screen.getByTitle("2 entregas concluídas com atraso")).toBeInTheDocument();
    r.unmount();
    r = renderWidget("projetos_atraso_disciplina", DADOS_EXEMPLO);
    expect(alertas(r.container)).toBe(1);
  });
});
