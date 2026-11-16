import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { lerCsv, lerData, planejarImportacao } from "./importarCronograma";

describe("lerData", () => {
  it("lê formatos comuns", () => {
    expect(lerData("05/03/2026")).toBe("2026-03-05");
    expect(lerData("5-3-26")).toBe("2026-03-05");
    expect(lerData("2026-03-05")).toBe("2026-03-05");
    expect(lerData(new Date(2026, 2, 5))).toBe("2026-03-05");
    expect(lerData(46086)).toBe("2026-03-05");
  });
  it("rejeita o que não é data", () => {
    expect(lerData("31/02/2026")).toBeNull();
    expect(lerData("em breve")).toBeNull();
    expect(lerData("")).toBeNull();
  });
});

describe("planejarImportacao", () => {
  const cab = ["Fase", "Etapa", "Serviço", "Tarefa", "Início", "Fim"];

  it("monta a hierarquia herdando as células vazias", () => {
    const p = planejarImportacao([
      cab,
      ["Estrutura", "Fundação", "Sapatas", "Escavar", "01/03/2026", "05/03/2026"],
      ["", "", "", "Concretar", "", ""],
      ["", "Pilares", "Pilares do térreo", "Armar", "", ""],
      ["Acabamento", "Pintura", "Parede", "Massa", "", ""],
    ]);
    expect(p.erro).toBeNull();
    expect(p.itens.map((i) => `${i.nivel}:${i.nome}`)).toEqual([
      "fase:Estrutura",
      "etapa:Fundação",
      "servico:Sapatas",
      "etapa:Pilares",
      "servico:Pilares do térreo",
      "fase:Acabamento",
      "etapa:Pintura",
      "servico:Parede",
    ]);
    expect(p.tarefas).toHaveLength(4);
    expect(p.tarefas[1].titulo).toBe("Concretar");
    expect(p.tarefas[1].servicoChave).toBe(p.tarefas[0].servicoChave);
    expect(p.tarefas[0]).toMatchObject({ inicio: "2026-03-01", prazo: "2026-03-05" });
  });

  it("acha o cabeçalho abaixo de linhas de título e ignora maiúscula e acento", () => {
    const p = planejarImportacao([
      ["Obra Casa B3"],
      [],
      ["FASE", "etapa", "SERVICO", "atividade"],
      ["A", "B", "C", "D"],
    ]);
    expect(p.erro).toBeNull();
    expect(p.tarefas[0].titulo).toBe("D");
  });

  it("datas na linha de um nó sem tarefa vão para esse nó", () => {
    const p = planejarImportacao([cab, ["Estrutura", "", "", "", "01/03/2026", "30/04/2026"]]);
    expect(p.itens[0]).toMatchObject({ nivel: "fase", inicio: "2026-03-01", fim: "2026-04-30" });
  });

  it("tarefa direto na etapa cria o serviço Geral", () => {
    const p = planejarImportacao([cab, ["F", "E", "", "T", "", ""]]);
    expect(p.itens.some((i) => i.nivel === "servico" && i.nome === "Geral")).toBe(true);
  });

  it("avisa de data inválida e de início depois do fim", () => {
    const p = planejarImportacao([
      cab,
      ["F", "E", "S", "T", "xx", ""],
      ["F", "E", "S", "T2", "10/03/2026", "01/03/2026"],
    ]);
    expect(p.avisos.some((a) => a.includes("Linha 2") && a.includes("início inválida"))).toBe(true);
    expect(p.avisos.some((a) => a.includes("Linha 3") && a.includes("depois do fim"))).toBe(true);
  });

  it("devolve erro sem cabeçalho e sem linhas", () => {
    expect(
      planejarImportacao([
        ["a", "b"],
        ["1", "2"],
      ]).erro
    ).toMatch(/cabeçalho/);
    expect(planejarImportacao([cab]).erro).toMatch(/não tem linhas/);
  });
});

describe("lerCsv", () => {
  it("lê ponto e vírgula, aspas e BOM, e mantém a data como texto", () => {
    const linhas = lerCsv(
      '﻿Fase;Etapa;Serviço;Tarefa;Início;Fim\r\nEstrutura;"Fundação; geral";Sapatas;Escavar;01/03/2026;05/03/2026\r\n'
    );
    expect(linhas[1][1]).toBe("Fundação; geral");
    const p = planejarImportacao(linhas);
    expect(p.tarefas[0]).toMatchObject({ inicio: "2026-03-01", prazo: "2026-03-05" });
  });
  it("detecta vírgula", () => {
    expect(lerCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });
});

describe("planilha .xlsx de verdade", () => {
  // Mesmo caminho do diálogo: gera o arquivo, lê com cellDates e entrega as linhas ao plano.
  it("lê datas do Excel, células mescladas e cabeçalho com acento", () => {
    const aba = XLSX.utils.aoa_to_sheet([
      ["Orçamento da obra Casa B3"],
      ["Fase", "Etapa", "Serviço", "Tarefa", "Início", "Fim"],
      ["Estrutura", "Fundação", "Sapatas", "Escavar", new Date(2026, 2, 1), new Date(2026, 2, 5)],
      ["", "", "", "Concretar", "06/03/2026", "08/03/2026"],
      ["", "Pilares", "Pilares do térreo", "Armar", 46091, 46096],
    ]);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, aba, "Cronograma");
    const buffer = XLSX.write(livro, { type: "array", bookType: "xlsx", cellDates: true });

    const lido = XLSX.read(buffer, { type: "array", cellDates: true });
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(lido.Sheets[lido.SheetNames[0]], {
      header: 1,
      raw: true,
      defval: "",
    });
    const plano = planejarImportacao(linhas as never);

    expect(plano.erro).toBeNull();
    expect(plano.itens.map((i) => `${i.nivel}:${i.nome}`)).toEqual([
      "fase:Estrutura",
      "etapa:Fundação",
      "servico:Sapatas",
      "etapa:Pilares",
      "servico:Pilares do térreo",
    ]);
    expect(plano.tarefas.map((t) => [t.titulo, t.inicio, t.prazo])).toEqual([
      ["Escavar", "2026-03-01", "2026-03-05"],
      ["Concretar", "2026-03-06", "2026-03-08"],
      ["Armar", "2026-03-10", "2026-03-15"],
    ]);
  });
});
