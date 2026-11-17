import { describe, expect, it } from "vitest";
import {
  celulaCsv,
  comoResolvem,
  dorPorDisciplina,
  dorPorPorte,
  ferramentasEmUso,
  filtrar,
  lerLinhas,
  paraCsv,
  projetosAtivosPorFaixa,
  rankingDeDores,
  resumir,
  textosLivres,
  type LinhaDores,
} from "./doresLib";

const linha = (
  extra: Partial<LinhaDores> & { empresa?: string; porte?: string | null; disciplinas?: string[] }
): LinhaDores => {
  const { empresa = "Alfa", porte = "6-15", disciplinas = ["estrutural"], ...resto } = extra;
  return {
    empresa_id: `e-${empresa}`,
    created_at: "2026-11-10T10:00:00Z",
    dores: [],
    dor_principal: null,
    texto_livre: null,
    contexto: {},
    etapa_atual: 7,
    concluido_em: "2026-11-10T10:05:00Z",
    empresas: { nome: empresa, porte, disciplinas },
    ...resto,
  };
};

const base = () =>
  lerLinhas([
    linha({
      empresa: "Alfa",
      dores: ["prazos", "equipe"],
      dor_principal: "prazos",
      texto_livre: "Perdemos prazo",
      contexto: {
        projetosAtivos: "6-15",
        ferramentas: ["planilhas", "whatsapp_email"],
        aprofundamento: { dor: "prazos", resposta: "whatsapp" },
      },
    }),
    linha({
      empresa: "Beta",
      porte: "1-5",
      disciplinas: ["arquitetura"],
      dores: ["prazos"],
      dor_principal: "prazos",
      contexto: {
        projetosAtivos: "1-5",
        ferramentas: ["planilhas"],
        aprofundamento: { dor: "prazos", resposta: "planilha" },
      },
    }),
    linha({
      empresa: "Gama",
      porte: "16-40",
      dores: ["financeiro", "prazos", "obra"],
      dor_principal: "financeiro",
      texto_livre: "Caixa no escuro",
    }),
    linha({ empresa: "Delta", dores: [], concluido_em: null, etapa_atual: 2 }),
  ]);

describe("rankingDeDores", () => {
  it("ordena por menções e conta a principal; quem pulou a pergunta fica fora da base", () => {
    const { itens, base: n } = rankingDeDores(base());
    expect(n).toBe(3);
    // Empate em menções: quem é principal vem antes; depois, ordem alfabética do rótulo.
    expect(itens.map((i) => [i.dor, i.mencoes, i.principal])).toEqual([
      ["prazos", 3, 2],
      ["financeiro", 1, 1],
      ["obra", 1, 0],
      ["equipe", 1, 0],
    ]);
    expect(itens[0].pct).toBe(100);
    expect(itens[1].pct).toBe(33);
  });

  it("sem respostas devolve lista vazia", () => {
    expect(rankingDeDores([])).toEqual({ itens: [], base: 0 });
  });
});

describe("filtrar e resumir", () => {
  it("filtra por porte", () => {
    expect(filtrar(base(), { porte: "1-5" }).map((r) => r.empresa)).toEqual(["Beta"]);
    expect(filtrar(base(), { porte: null })).toHaveLength(4);
  });

  it("resume quem iniciou, concluiu, marcou dor e escreveu", () => {
    expect(resumir(base())).toEqual({ iniciaram: 4, concluiram: 3, comDor: 3, comTexto: 2 });
  });
});

describe("cruzamentos", () => {
  it("dor principal por porte e por disciplina (top 3)", () => {
    const porte = dorPorPorte(base());
    expect(porte.map((g) => [g.value, g.escritorios])).toEqual([
      ["1-5", 1],
      ["6-15", 1],
      ["16-40", 1],
    ]);
    expect(porte.find((g) => g.value === "6-15")?.ranking[0].dor).toBe("prazos");
    const disc = dorPorDisciplina(base());
    expect(disc.find((g) => g.value === "estrutural")?.escritorios).toBe(2);
    expect(disc.every((g) => g.ranking.length <= 3)).toBe(true);
  });

  it("ferramentas e projetos ativos", () => {
    expect(ferramentasEmUso(base()).map((d) => [d.value, d.total])).toEqual([
      ["planilhas", 2],
      ["whatsapp_email", 1],
    ]);
    expect(
      projetosAtivosPorFaixa(base())
        .map((d) => d.value)
        .sort()
    ).toEqual(["1-5", "6-15"]);
  });

  it("como resolvem hoje: traduz a opção e ordena por total", () => {
    const g = comoResolvem(base());
    expect(g).toHaveLength(1);
    expect(g[0].dor).toBe("prazos");
    expect(g[0].respostas.map((r) => r.rotulo).sort()).toEqual([
      "Cobrando no WhatsApp",
      "Planilha ou cronograma solto",
    ]);
  });

  it("textos livres vêm do mais novo para o mais antigo, com a dor principal", () => {
    const rows = lerLinhas([
      linha({
        empresa: "Velha",
        texto_livre: "antigo",
        dores: ["obra"],
        dor_principal: "obra",
        created_at: "2026-10-01T00:00:00Z",
      }),
      linha({ empresa: "Nova", texto_livre: "recente", created_at: "2026-11-12T00:00:00Z" }),
    ]);
    const t = textosLivres(rows);
    expect(t.map((x) => x.empresa)).toEqual(["Nova", "Velha"]);
    expect(t[1].principal).toBe("Controle de obra: diário, medição, fornecedor");
    expect(t[0].principal).toBeNull();
  });
});

describe("lerLinhas", () => {
  it("não confia no que veio do banco", () => {
    const [r] = lerLinhas([
      linha({ dores: ["prazos", "inventada"], dor_principal: "x", contexto: { ferramentas: ["magica"] } }),
    ]);
    expect(r.dores).toEqual(["prazos"]);
    expect(r.dorPrincipal).toBe("prazos");
    expect(r.ferramentas).toEqual([]);
  });

  it("escritório sem dados vira rótulo neutro", () => {
    const [r] = lerLinhas([{ ...linha({}), empresas: null }]);
    expect(r.empresa).toBe("Escritório");
    expect(r.disciplinas).toEqual([]);
  });
});

describe("CSV", () => {
  it("escapa vírgula, aspas e quebra de linha", () => {
    expect(celulaCsv('a, "b"\nc')).toBe('"a, ""b""\nc"');
    expect(celulaCsv(null)).toBe("");
  });

  it("neutraliza fórmula vinda de texto livre (CSV injection)", () => {
    expect(celulaCsv('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(celulaCsv("+1")).toBe("'+1");
    expect(celulaCsv("@SOMA(A1)")).toBe("'@SOMA(A1)");
    expect(celulaCsv("-2")).toBe("'-2");
    expect(celulaCsv("normal")).toBe("normal");
  });

  it("gera cabeçalho e uma linha por escritório, com rótulos legíveis", () => {
    const csv = paraCsv(base());
    const linhas = csv.split("\n");
    expect(linhas[0]).toBe(
      "escritorio,porte,disciplinas,dores,dor_principal,como_resolve_hoje,projetos_ativos,ferramentas,texto_livre,concluido_em,iniciado_em"
    );
    expect(linhas).toHaveLength(5);
    expect(linhas[1]).toContain("Estouro de prazo e de cronograma; Não sei quem está fazendo o quê");
    expect(linhas[1]).toContain("Cobrando no WhatsApp");
    expect(linhas[1]).toContain("Planilhas (Excel, Google); WhatsApp e e-mail");
  });
});
