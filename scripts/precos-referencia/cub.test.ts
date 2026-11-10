import { describe, expect, it } from "vitest";
import {
  cookiesDaResposta,
  escolherSinduscon,
  formularioCub,
  citaSinduscon,
  igualAoAnterior,
  juntarCodigos,
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
    expect(textoPuro("CUB &#8211; Outubro &amp; mais")).toBe("CUB – Outubro & mais");
    expect(textoPuro("&#60;script&#62;alert(1)&#60;/script&#62;")).not.toMatch(/[<>]/);
  });
});

describe("PDF real do Sinduscon-MS (set/2026, texto do diagnóstico)", () => {
  // Três tabelas residenciais lado a lado, comerciais lado a lado, "CAL - 8" com espaços e o mês como
  // "MÊS: SETEMBRO ANO: 2026". Itens com a posição de cada célula, como o pdf.js devolve.
  const cab = [
    "CUSTOS UNITÁRIOS BÁSICOS DE CONSTRUÇÃO",
    "MÊS: SETEMBRO ANO: 2026",
    "(NBR 12.721:2006 - CUB 2006)",
    "PROJETOS - PADRÃO RESIDENCIAIS",
  ];
  const residenciais = [
    [
      ["R-1", "1.859,76", "0,21%"],
      ["R-1", "2.180,16", "0,23%"],
      ["R-1", "2.694,82", "0,40%"],
    ],
    [
      ["PP-4", "1.794,27", "0,16%"],
      ["PP-4", "2.119,94", "0,17%"],
      ["R-8", "2.242,84", "0,31%"],
    ],
    [
      ["R-8", "1.718,95", "0,15%"],
      ["R-8", "1.877,57", "0,20%"],
      ["R-16", "2.424,94", "0,17%"],
    ],
    [
      ["PIS", "1.287,84", "0,17%"],
      ["R-16", "1.827,31", "0,19%"],
    ],
  ];
  const comerciais = [
    [
      ["CAL - 8", "2.220,38", "0,18%"],
      ["CAL - 8", "2.360,48", "0,17%"],
    ],
    [
      ["CSL - 8", "1.896,88", "0,20%"],
      ["CSL - 8", "2.062,34", "0,18%"],
    ],
    [
      ["CSL - 16", "2.547,41", "0,19%"],
      ["CSL - 16", "2.764,02", "0,17%"],
    ],
  ];
  function itens(): ItemDeTexto[] {
    const out: ItemDeTexto[] = cab.map((texto, i) => ({ texto, x: 30, y: 800 - i * 12 }));
    out.push(
      { texto: "PADRÃO BAIXO", x: 30, y: 740 },
      { texto: "PADRÃO NORMAL", x: 230, y: 740 },
      { texto: "PADRÃO ALTO", x: 430, y: 740 }
    );
    residenciais.forEach((linha, r) =>
      linha.forEach((cel, c) =>
        cel.forEach((t, k) => out.push({ texto: t, x: 30 + c * 200 + k * 60, y: 720 - r * 12 }))
      )
    );
    out.push({ texto: "CUB/M² - R8-N = R$ 1.877,57", x: 30, y: 660 });
    out.push({ texto: "PROJETOS - PADRÃO COMERCIAIS", x: 30, y: 600 });
    comerciais.forEach((linha, r) =>
      linha.forEach((cel, c) =>
        cel.forEach((t, k) => out.push({ texto: t, x: 30 + c * 300 + k * 70, y: 580 - r * 12 }))
      )
    );
    out.push(
      { texto: "RP1Q", x: 30, y: 520 },
      { texto: "1.889,13", x: 90, y: 520 },
      { texto: "0,21%", x: 150, y: 520 }
    );
    out.push({ texto: "GI", x: 30, y: 508 }, { texto: "1.055,91", x: 90, y: 508 }, { texto: "0,32%", x: 150, y: 508 });
    out.push(
      { texto: "R-1: Residência Unifamiliar", x: 30, y: 480 },
      { texto: "RPQ1: Residência Popular", x: 330, y: 480 }
    );
    out.push({ texto: "CSL-16: Comercial Salas e Lojas", x: 330, y: 468 });
    return out;
  }

  it("lê as 19 linhas certas: R8 normal é 1.877,57 (o destaque), não o R-8 do baixo", () => {
    const r = lerPdfCub([itens()], "MS", "2026-09-01", "onerado", { exigirRegimeNoTexto: true });
    expect(r.erro).toBeNull();
    const v = (s: string, p: string) => r.linhas.find((l) => l.subtipo === s && l.padrao === p)?.valor_m2;
    expect(v("R8", "baixo")).toBe(1718.95);
    expect(v("R8", "normal")).toBe(1877.57);
    expect(v("R8", "alto")).toBe(2242.84);
    expect(v("R16", "normal")).toBe(1827.31);
    expect(v("R16", "alto")).toBe(2424.94);
    expect(v("CAL-8", "alto")).toBe(2360.48);
    expect(v("CSL-16", "normal")).toBe(2547.41);
    expect(v("GI", "unico")).toBe(1055.91);
    expect(r.linhas).toHaveLength(19);
  });

  it("junta códigos com espaço e não mexe no resto", () => {
    expect(juntarCodigos("CAL - 8 2.220,38 CSL - 16 x")).toBe("CAL-8 2.220,38 CSL-16 x");
    expect(juntarCodigos("NBR 12.721 - 2006")).toBe("NBR 12.721 - 2006");
  });
});

describe("PDF real do Sinduscon-RS (out/2026, texto do diagnóstico)", () => {
  const linhas = [
    "PREÇOS E CUSTOS DA CONSTRUÇÃO",
    "CUB/RS do mês de OUTUBRO/2026 - NBR 12.721- Versão 2006",
    "Padrão de Custo Variação %",
    "PROJETOS acabamento R$/m Mensal Anual 12 meses",
    "RESIDENCIAIS",
    "Baixo R 1-B 2.593,86 1,03 7,26 6,95",
    "R - 1 (Residência Unifamiliar) Normal R 1-N 3.476,31 0,70 8,83 8,95",
    "Alto R 1-A 4.689,49 0,53 9,57 10,05",
    "Baixo PP 4-B 2.473,96 1,10 7,63 7,46",
    "PP (Prédio Popular)",
    "Normal PP 4-N 3.411,45 0,82 9,25 9,26",
    "Baixo R 8-B 2.348,38 1,13 7,58 7,35",
    "R - 8 (Residência Multifamiliar) Normal R 8-N 2.969,00 0,86 9,19 9,23",
    "Alto R 8-A 3.815,52 0,68 9,68 10,18",
    "Normal R 16-N 2.913,69 0,90 9,42 9,52",
    "R - 16 (Residência Multifamiliar)",
    "Alto R 16-A 3.895,70 0,86 9,67 9,79",
    "PIS (Projeto de Interesse Social) PIS 1.874,29 0,61 6,32 6,62",
    "RPQ1 (Residência Popular) RP1Q 2.640,08 0,74 5,83 5,73",
    "COMERCIAIS",
    "Normal CAL 8-N 3.906,19 0,99 11,21 11,25",
    "CAL- 8 (Comercial Andar Livres)",
    "Alto CAL 8-A 4.552,53 0,85 12,31 12,72",
    "Normal CSL 8-N 2.954,29 1,10 9,04 8,87",
    "CSL- 8 (Comercial Salas e Lojas)",
    "Alto CSL 8-A 3.490,21 0,92 9,16 9,65",
    "Normal CSL 16-N 3.989,73 1,05 9,29 9,18",
    "CSL- 16 (Comercial Salas e Lojas)",
    "Alto CSL 16-A 4.705,58 0,88 9,44 9,95",
    "GI (Galpão Industrial) GI 1.422,31 0,91 6,12 5,87",
    "Fonte: DEE – Sinduscon/RS",
    "partir de fevereiro/2007, a ser calculados de acordo, com os novos projetos-padrão",
    "OUT/26 1.243,905 1,47 4,97 5,24 1.301,724 0,35 6,23 6,75",
  ];

  it("lê os 19 códigos com o padrão escrito no próprio código", () => {
    const itens = linhas.map((texto, i) => ({ texto, x: 20, y: 800 - i * 12 }));
    const r = lerPdfCub([itens], "RS", "2026-10-01", "onerado", { exigirRegimeNoTexto: true });
    expect(r.erro).toBeNull();
    expect(r.linhas).toHaveLength(19);
    const v = (s: string, p: string) => r.linhas.find((l) => l.subtipo === s && l.padrao === p)?.valor_m2;
    expect(v("R1", "normal")).toBe(3476.31);
    expect(v("R8", "normal")).toBe(2969);
    expect(v("PP-4", "baixo")).toBe(2473.96);
    expect(v("R16", "alto")).toBe(3895.7);
    expect(v("CAL-8", "normal")).toBe(3906.19);
    expect(v("CSL-16", "alto")).toBe(4705.58);
    expect(v("PIS", "baixo")).toBe(1874.29);
    expect(v("GI", "unico")).toBe(1422.31);
  });

  it("o PDF sem a palavra desoneração não serve como desonerado", () => {
    const itens = linhas.map((texto, i) => ({ texto, x: 20, y: 800 - i * 12 }));
    expect(lerPdfCub([itens], "RS", "2026-10-01", "desonerado", { exigirRegimeNoTexto: true }).erro).toMatch(
      /não diz que é com desoneração/
    );
  });

  it("junta os códigos do RS", () => {
    expect(juntarCodigos("Baixo R 1-B 2.593,86 Normal CSL 16-N 3.989,73 GI 1")).toBe(
      "Baixo R1-B 2.593,86 Normal CSL16-N 3.989,73 GI 1"
    );
  });
});

describe("citaSinduscon", () => {
  const pagina = (t: string) => [
    [
      { texto: "VALORES EM R$/m²", x: 0, y: 10 },
      { texto: t, x: 0, y: 0 },
    ],
  ];
  it("confere o Sinduscon pedido e recusa o PDF de outro estado", () => {
    expect(citaSinduscon(pagina("Sinduscon-BA Data de emissão: 10/11/2026"), "Sinduscon-BA")).toBe(true);
    expect(citaSinduscon(pagina("Sinduscon-MT Data de emissão: 10/11/2026 15:07"), "Sinduscon-BA")).toBe(false);
    expect(citaSinduscon(pagina("SINDUSCON JOAO PESSOA"), "Sinduscon-João Pessoa")).toBe(true);
    expect(citaSinduscon(pagina("sem rodapé"), "Sinduscon-BA")).toBe(false);
    expect(citaSinduscon(pagina("Sinduscon Paraná"), "Sinduscon-PA")).toBe(false);
  });
});
