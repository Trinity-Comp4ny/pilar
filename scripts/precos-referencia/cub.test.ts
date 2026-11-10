import { describe, expect, it } from "vitest";
import {
  cookiesDaResposta,
  escolherSinduscon,
  formularioCub,
  igualAoAnterior,
  interpretarTextoCub,
  lerCsrf,
  lerFixos,
  lerOpcoesSinduscon,
  lerPdfCub,
  linhasDaPagina,
  paraGravar,
  saltoSuspeito,
  textoPuro,
  TOTAL_CODIGOS,
  type ItemDeTexto,
} from "./cub";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Tabelas do relatório na ordem do PDF, com valores crescentes por padrão.
const TABELAS: [string, [string, number][]][] = [
  [
    "RESIDENCIAIS - PADRÃO BAIXO",
    [
      ["R-1", 2100],
      ["PP-4", 1950],
      ["R-8", 1850],
      ["PIS", 1400],
    ],
  ],
  [
    "RESIDENCIAIS - PADRÃO NORMAL",
    [
      ["R-1", 2600],
      ["PP-4", 2400],
      ["R-8", 2250],
      ["R-16", 2200],
    ],
  ],
  [
    "RESIDENCIAIS - PADRÃO ALTO",
    [
      ["R-1", 3200],
      ["R-8", 2700],
      ["R-16", 2800],
    ],
  ],
  [
    "COMERCIAIS - PADRÃO NORMAL",
    [
      ["CAL-8", 2500],
      ["CSL-8", 2200],
      ["CSL-16", 2900],
    ],
  ],
  [
    "COMERCIAIS - PADRÃO ALTO",
    [
      ["CAL-8", 2700],
      ["CSL-8", 2400],
      ["CSL-16", 3150],
    ],
  ],
  [
    "ESPECIAIS",
    [
      ["RP1Q", 2300],
      ["GI", 1200],
    ],
  ],
];

const CABECALHO = [
  "CUSTOS UNITÁRIOS BÁSICOS DE CONSTRUÇÃO (NBR 12.721:2006 - CUB 2006) - Outubro/2026",
  "Sinduscon-GO - Valores em R$/m² - SEM DESONERAÇÃO DA FOLHA",
];

function empilhadas(): string[] {
  return [
    ...CABECALHO,
    ...TABELAS.flatMap(([titulo, linhas]) => [
      titulo,
      "PROJETOS R$/m² Variação",
      ...linhas.map(([c, v]) => `${c} ${fmt(v)} 0,35%`),
    ]),
  ];
}

/** Três tabelas residenciais lado a lado, lidas como itens com posição. */
function ladoALado(): ItemDeTexto[] {
  const itens: ItemDeTexto[] = CABECALHO.map((texto, i) => ({ texto, x: 10, y: 800 - i * 12 }));
  TABELAS.forEach(([titulo, linhas], t) => {
    const coluna = t % 3;
    const topo = t < 3 ? 700 : 500;
    itens.push({ texto: titulo, x: 10 + coluna * 200, y: topo });
    linhas.forEach(([c, v], i) => {
      const y = topo - 14 * (i + 1) + (coluna === 1 ? 0.8 : 0); // desalinhamento pequeno entre colunas
      itens.push({ texto: c, x: 10 + coluna * 200, y });
      itens.push({ texto: `R$ ${fmt(v)}`, x: 60 + coluna * 200, y });
      itens.push({ texto: "-0,12%", x: 140 + coluna * 200, y });
    });
  });
  return itens.sort(() => 0.5 - ((itens.length * 7) % 3)); // ordem de chegada qualquer
}

describe("interpretarTextoCub", () => {
  it("lê as 19 linhas das tabelas empilhadas, com o padrão pela ordem", () => {
    const r = interpretarTextoCub(empilhadas(), "GO", "2026-10-01", "onerado");
    expect(r.erro).toBeNull();
    expect(r.linhas).toHaveLength(TOTAL_CODIGOS);
    expect(TOTAL_CODIGOS).toBe(19);
    const v = (s: string, p: string) => r.linhas.find((l) => l.subtipo === s && l.padrao === p)?.valor_m2;
    expect(v("R1", "baixo")).toBe(2100);
    expect(v("R1", "alto")).toBe(3200);
    expect(v("PP-4", "normal")).toBe(2400);
    expect(v("R16", "normal")).toBe(2200);
    expect(v("CSL-16", "alto")).toBe(3150);
    expect(v("PIS", "baixo")).toBe(1400);
    expect(v("GI", "unico")).toBe(1200);
    expect(r.linhas[0]).toEqual({
      uf: "GO",
      subtipo: "R1",
      padrao: "baixo",
      valor_m2: 2100,
      mes_base: "2026-10-01",
      regime: "onerado",
    });
  });

  it("tabelas lado a lado: a leitura por linha erra e é recusada, a por coluna acerta", () => {
    const porLinha = interpretarTextoCub(linhasDaPagina(ladoALado()), "GO", "2026-10-01", "onerado");
    expect(porLinha.erro).toMatch(/não está acima/);
    const r = lerPdfCub([ladoALado()], "GO", "2026-10-01", "onerado");
    expect(r.erro).toBeNull();
    expect(r.linhas).toHaveLength(19);
    expect(r.linhas.find((l) => l.subtipo === "R8" && l.padrao === "alto")?.valor_m2).toBe(2700);
    expect(r.linhas.find((l) => l.subtipo === "CAL-8" && l.padrao === "normal")?.valor_m2).toBe(2500);
  });

  it("tabelas empilhadas como itens: as duas leituras concordam", () => {
    const itens = empilhadas().map((texto, i) => ({ texto, x: 10, y: 800 - i * 12 }));
    const r = lerPdfCub([itens], "GO", "2026-10-01", "onerado");
    expect(r.erro).toBeNull();
    expect(r.linhas).toHaveLength(19);
  });

  it("aceita o destaque R8-N fora da tabela quando bate com ela", () => {
    const linhas = [CABECALHO[0], "CUB/m² R8-N R$ 2.250,00", ...empilhadas().slice(1)];
    const r = interpretarTextoCub(linhas, "GO", "2026-10-01", "onerado");
    expect(r.erro).toBeNull();
    expect(r.linhas).toHaveLength(19);
    const outro = interpretarTextoCub(
      [CABECALHO[0], "R8-N 2.999,00", ...empilhadas().slice(1)],
      "GO",
      "2026-10-01",
      "onerado"
    );
    expect(outro.erro).toMatch(/dois valores/);
  });

  it("recusa mês diferente do pedido", () => {
    expect(interpretarTextoCub(empilhadas(), "GO", "2026-09-01", "onerado").erro).toMatch(
      /não é de 09\/2026.*2026-10-01/
    );
  });

  it("recusa o regime trocado", () => {
    expect(interpretarTextoCub(empilhadas(), "GO", "2026-10-01", "desonerado").erro).toMatch(/outro regime/);
  });

  it("recusa PDF incompleto", () => {
    const sem = empilhadas().filter((l) => !l.startsWith("GI"));
    expect(interpretarTextoCub(sem, "GO", "2026-10-01", "onerado").erro).toBe("Faltam no PDF: GI unico.");
  });

  it("recusa quando o padrão alto não fica acima do normal (tabelas trocadas)", () => {
    const linhas = empilhadas();
    const iNormal = linhas.indexOf("RESIDENCIAIS - PADRÃO NORMAL");
    const iAlto = linhas.indexOf("RESIDENCIAIS - PADRÃO ALTO");
    // Troca a ordem do bloco normal e do alto: os R-1 viram baixo, alto, normal.
    const trocadas = [
      ...linhas.slice(0, iNormal),
      ...linhas.slice(iAlto, iAlto + 5),
      ...linhas.slice(iNormal, iAlto),
      ...linhas.slice(iAlto + 5),
    ];
    expect(interpretarTextoCub(trocadas, "GO", "2026-10-01", "onerado").erro).toMatch(/não está acima/);
  });

  it("recusa valor fora da faixa e código repetido demais", () => {
    const fora = empilhadas().map((l) => (l.startsWith("GI") ? "GI 120,00 0,1%" : l));
    expect(interpretarTextoCub(fora, "GO", "2026-10-01", "onerado").erro).toMatch(/fora da faixa/);
    const demais = [...empilhadas(), "GI 1.300,00"];
    expect(interpretarTextoCub(demais, "GO", "2026-10-01", "onerado").erro).toMatch(/mais vezes/);
  });
});

describe("saltoSuspeito", () => {
  it("aponta a variação acima de 15% contra o mês anterior", () => {
    const novas = interpretarTextoCub(empilhadas(), "GO", "2026-10-01", "onerado").linhas;
    expect(
      saltoSuspeito(
        novas,
        novas.map((l) => ({ ...l, valor_m2: l.valor_m2 * 0.98 }))
      )
    ).toBeNull();
    expect(saltoSuspeito(novas, [{ subtipo: "R1", padrao: "baixo", valor_m2: 1500 }])).toMatch(/R1 baixo.*40%/);
    expect(saltoSuspeito(novas, [])).toBeNull();
  });
});

describe("formulário da CBIC", () => {
  const HTML = `
    <form method="post"><input type="hidden" name="csrfmiddlewaretoken" value="tok123">
    <select name="sinduscon" id="s"><option value="-1">Selecione</option>
      <option value="12">Sinduscon-MG</option><option value="40"> Sinduscon <b>JF</b> </option></select></form>`;

  it("lê o token e as opções", () => {
    expect(lerCsrf(HTML, null)).toBe("tok123");
    expect(lerCsrf("<html>", "csrftoken=abc; Path=/; SameSite=Lax")).toBe("abc");
    expect(lerCsrf("<html>", null)).toBeNull();
    expect(lerOpcoesSinduscon(HTML)).toEqual([
      { valor: "12", rotulo: "Sinduscon-MG" },
      { valor: "40", rotulo: "Sinduscon JF" },
    ]);
    expect(lerOpcoesSinduscon("<p>sem formulário</p>")).toEqual([]);
  });

  it("escolhe o Sinduscon da UF, o único, o fixado, ou nenhum se ambíguo", () => {
    const opcoes = lerOpcoesSinduscon(HTML);
    expect(escolherSinduscon("MG", opcoes)?.valor).toBe("12");
    expect(escolherSinduscon("GO", [{ valor: "7", rotulo: "Sinduscon Goiás" }])?.valor).toBe("7");
    expect(
      escolherSinduscon("PR", [
        { valor: "1", rotulo: "Norte" },
        { valor: "2", rotulo: "Oeste" },
      ])
    ).toBeNull();
    expect(escolherSinduscon("MG", opcoes, { MG: "40" })?.valor).toBe("40");
    expect(lerFixos("MG=40, PR=3,lixo,sp=1")).toEqual({ MG: "40", PR: "3" });
  });

  it("monta o POST com mês sem zero e o regime pedido", () => {
    expect(formularioCub("GO", "7", "2026-03-01", "desonerado", "t")).toMatchObject({
      uf: "GO",
      sinduscon: "7",
      ano: "2026",
      mes: "3",
      desoneracao: "com-desoneracao",
      relatorio: "tabela-cub-m2",
    });
    expect(cookiesDaResposta(["csrftoken=a; Path=/", "sessionid=b; HttpOnly", "lixo"])).toBe(
      "csrftoken=a; sessionid=b"
    );
  });
});

describe("portal estadual", () => {
  const itens = (linhas: string[]) => linhas.map((texto, i) => ({ texto, x: 10, y: 800 - i * 12 }));
  const comRegime = (regime: string) => [`CUB/m² Outubro/2026 - ${regime}`, ...empilhadas().slice(2)];

  it("exige o regime escrito quando o pedido é com desoneração", () => {
    const semMarca = ["CUB Outubro/2026", ...empilhadas().slice(2)];
    expect(interpretarTextoCub(semMarca, "SP", "2026-10-01", "desonerado", { exigirRegimeNoTexto: true }).erro).toMatch(
      /não diz que é com desoneração/
    );
    expect(interpretarTextoCub(semMarca, "SP", "2026-10-01", "onerado", { exigirRegimeNoTexto: true }).erro).toBeNull();
    expect(
      interpretarTextoCub(comRegime("CUB DESONERADO"), "SP", "2026-10-01", "desonerado", { exigirRegimeNoTexto: true })
        .erro
    ).toBeNull();
  });

  it("PDF com os dois regimes, um por página: lê a página do regime pedido", () => {
    const dobro = (l: string) =>
      l.replace(/(\d{1,3}(?:\.\d{3})*,\d{2})/, (v) => fmt(Number(v.replace(/\./g, "").replace(",", ".")) * 0.95));
    const paginas = [itens(comRegime("SEM DESONERAÇÃO")), itens(comRegime("COM DESONERAÇÃO").map(dobro))];
    const on = lerPdfCub(paginas, "RS", "2026-10-01", "onerado", { exigirRegimeNoTexto: true });
    const des = lerPdfCub(paginas, "RS", "2026-10-01", "desonerado", { exigirRegimeNoTexto: true });
    expect(on.erro).toBeNull();
    expect(des.erro).toBeNull();
    expect(on.linhas.find((l) => l.subtipo === "R1" && l.padrao === "baixo")?.valor_m2).toBe(2100);
    expect(des.linhas.find((l) => l.subtipo === "R1" && l.padrao === "baixo")?.valor_m2).toBe(1995);
  });

  it("duas páginas que servem ao mesmo regime com valores diferentes: recusa", () => {
    const outra = comRegime("SEM DESONERAÇÃO").map((l) => l.replace("2.100,00", "2.150,00"));
    const r = lerPdfCub([itens(comRegime("SEM DESONERAÇÃO")), itens(outra)], "RS", "2026-10-01", "onerado");
    expect(r.erro).toMatch(/Mais de uma página/);
  });
});

describe("antes de gravar", () => {
  const novas = interpretarTextoCub(empilhadas(), "GO", "2026-10-01", "onerado").linhas;

  it("arquivo repetido do mês anterior é detectado", () => {
    expect(igualAoAnterior(novas, novas)).toBe(true);
    expect(
      igualAoAnterior(
        novas,
        novas.map((l) => ({ ...l, valor_m2: l.valor_m2 + 1 }))
      )
    ).toBe(false);
    expect(igualAoAnterior(novas, [])).toBe(false);
  });

  it("RP1Q é conferido mas não vai para o banco", () => {
    expect(novas.some((l) => l.subtipo === "RP1Q")).toBe(true);
    expect(paraGravar(novas)).toHaveLength(18);
    expect(paraGravar(novas).some((l) => l.subtipo === "RP1Q")).toBe(false);
  });
});

describe("textoPuro", () => {
  it("não deixa marcação passar, nem com tag quebrada ou aninhada", () => {
    expect(textoPuro("Sinduscon <b>JF</b>&nbsp;")).toBe("Sinduscon JF");
    expect(textoPuro("<<b>script>alert(1)<</b>/script>")).not.toMatch(/[<>]/);
    expect(textoPuro("a <img src=x onerror=1")).toBe("a img src=x onerror=1");
    expect(textoPuro("x".repeat(300))).toHaveLength(200);
  });
});
