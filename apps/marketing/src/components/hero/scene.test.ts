import { describe, expect, it } from "vitest";
import {
  ATOS,
  COLUNAS,
  CURSOR,
  DURACAO_LOOP,
  FRASE,
  KPIS_FINANCEIRO,
  KPIS_LEADS,
  MARCOS,
  MODULOS_APP,
  MS_POR_CHAR,
  NAV_POR_MODULO,
  PALCO,
  idx,
  moduloAppAtivo,
  moduloAtivo,
  telaDoAto,
} from "./scene";

const TELAS = ["agentes", "funil", "financeiro", "projeto", "obra"] as const;
const indices = ATOS.map((_, i) => i);

describe("roteiro da cena da hero", () => {
  it("tem um marco por ato", () => {
    expect(MARCOS).toHaveLength(ATOS.length);
  });

  it("os atos têm nome único", () => {
    expect(new Set(ATOS).size).toBe(ATOS.length);
  });

  it("os marcos começam em zero, crescem estritamente e acabam antes do fim do loop", () => {
    expect(MARCOS[0]).toBe(0);
    for (let i = 1; i < MARCOS.length; i++) {
      expect(MARCOS[i], `${ATOS[i]} depois de ${ATOS[i - 1]}`).toBeGreaterThan(MARCOS[i - 1]);
    }
    expect(MARCOS[MARCOS.length - 1]).toBeLessThan(DURACAO_LOOP);
  });

  it("a volta inteira cabe em uns vinte segundos", () => {
    expect(DURACAO_LOOP).toBeGreaterThanOrEqual(15000);
    expect(DURACAO_LOOP).toBeLessThanOrEqual(25000);
  });

  it("a frase termina de ser digitada antes do agente começar a pensar", () => {
    const tempoDigitando = MARCOS[idx("pensa")] - MARCOS[idx("digita")];
    expect(FRASE.length * MS_POR_CHAR).toBeLessThanOrEqual(tempoDigitando);
  });

  it("idx devolve a posição de cada ato", () => {
    ATOS.forEach((ato, i) => expect(idx(ato)).toBe(i));
  });

  it("o cursor está definido para todo ato e cabe no palco 1120x700", () => {
    expect(PALCO).toEqual({ largura: 1120, altura: 700 });
    expect(Object.keys(CURSOR).sort()).toEqual([...ATOS].sort());
    for (const ato of ATOS) {
      const { x, y, rotulo } = CURSOR[ato];
      expect(x, ato).toBeGreaterThanOrEqual(0);
      expect(x, ato).toBeLessThanOrEqual(PALCO.largura);
      expect(y, ato).toBeGreaterThanOrEqual(0);
      expect(y, ato).toBeLessThanOrEqual(PALCO.altura);
      if (rotulo !== null) expect(rotulo.trim().length, ato).toBeGreaterThan(0);
    }
  });

  it("o cursor fica parado entre ir e clicar (o clique cai onde ele chegou)", () => {
    const pares = [
      ["vaiAgentes", "clicaAgentes"],
      ["vaiConfirmar", "confirma"],
      ["converte", "convertido"],
    ] as const;
    for (const [vai, clica] of pares) {
      expect([CURSOR[clica].x, CURSOR[clica].y]).toEqual([CURSOR[vai].x, CURSOR[vai].y]);
    }
  });
});

describe("telas e navegação por ato", () => {
  it("todo ato mostra uma tela válida", () => {
    for (const i of indices) expect(TELAS).toContain(telaDoAto(i));
  });

  it("a história passa pelas cinco telas na ordem agentes → funil → financeiro → projeto → obra", () => {
    const sequencia = indices.map(telaDoAto).filter((t, i, xs) => i === 0 || t !== xs[i - 1]);
    expect(sequencia).toEqual(["funil", "agentes", "funil", "financeiro", "projeto", "obra"]);
  });

  it("cada tela entra no ato certo", () => {
    expect(telaDoAto(idx("repouso"))).toBe("funil");
    expect(telaDoAto(idx("vaiAgentes"))).toBe("funil");
    expect(telaDoAto(idx("clicaAgentes"))).toBe("agentes");
    expect(telaDoAto(idx("confirma"))).toBe("agentes");
    expect(telaDoAto(idx("vaiLeads"))).toBe("funil");
    expect(telaDoAto(idx("convertido"))).toBe("funil");
    expect(telaDoAto(idx("vaiFinanceiro"))).toBe("financeiro");
    expect(telaDoAto(idx("vaiProjetos"))).toBe("projeto");
    expect(telaDoAto(idx("gantt"))).toBe("projeto");
    expect(telaDoAto(idx("vaiObras"))).toBe("obra");
    expect(telaDoAto(idx("respira"))).toBe("obra");
  });

  it("o módulo aberto no trilho é sempre um dos três do app", () => {
    for (const i of indices) expect(MODULOS_APP).toContain(moduloAppAtivo(i));
  });

  it("o item em destaque existe no trilho ou no painel do módulo aberto", () => {
    for (const i of indices) {
      const item = moduloAtivo(i);
      const painel = NAV_POR_MODULO[moduloAppAtivo(i)].map((n) => n.nome);
      const valido = item === "Agentes" || painel.includes(item);
      expect(valido, `ato ${ATOS[i]}: "${item}" fora do painel de ${moduloAppAtivo(i)}`).toBe(true);
    }
  });

  it("o destaque acompanha a tela: Cronograma só a partir do Gantt", () => {
    expect(moduloAtivo(idx("projeto"))).toBe("Projetos");
    expect(moduloAtivo(idx("gantt"))).toBe("Cronograma");
    expect(moduloAtivo(idx("financeiro"))).toBe("Financeiro");
    expect(moduloAtivo(idx("funil"))).toBe("Leads");
    expect(moduloAtivo(idx("rascunho"))).toBe("Agentes");
    expect(moduloAtivo(idx("obra"))).toBe("Obras");
  });

  it("todo módulo do app tem painel de navegação, sem item repetido", () => {
    expect(Object.keys(NAV_POR_MODULO).sort()).toEqual([...MODULOS_APP].sort());
    for (const mod of MODULOS_APP) {
      const nomes = NAV_POR_MODULO[mod].map((n) => n.nome);
      expect(nomes.length).toBeGreaterThan(0);
      expect(new Set(nomes).size).toBe(nomes.length);
    }
  });

  it("um índice fora do roteiro cai numa tela válida em vez de quebrar", () => {
    expect(TELAS).toContain(telaDoAto(-1));
    expect(TELAS).toContain(telaDoAto(ATOS.length + 5));
  });
});

describe("dados do mock da hero", () => {
  it("o funil tem as seis colunas do app, Ganho vazio esperando o lead do agente", () => {
    expect(COLUNAS.map((c) => c.nome)).toEqual([
      "Novo",
      "Em Contato",
      "Proposta Enviada",
      "Em Negociação",
      "Ganho",
      "Perdido",
    ]);
    expect(COLUNAS.find((c) => c.nome === "Ganho")?.cards).toEqual([]);
  });

  it("os KPIs têm cinco cartões cada, com rótulo único", () => {
    for (const kpis of [KPIS_LEADS, KPIS_FINANCEIRO]) {
      expect(kpis).toHaveLength(5);
      expect(new Set(kpis.map((k) => k.rotulo)).size).toBe(5);
    }
  });

  it("o lucro do financeiro fecha com receitas menos despesas", () => {
    const valor = (rotulo: string) => KPIS_FINANCEIRO.find((k) => k.rotulo === rotulo)!.valor;
    expect(valor("Receitas totais") - valor("Despesas totais")).toBe(valor("Lucro líquido"));
  });
});
