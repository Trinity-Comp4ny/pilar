import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DORES, MAX_DORES, RESPOSTAS_VAZIAS } from "@/lib/onboarding/dores";
import { lerRespostas, paraLinha } from "@/lib/onboarding/respostas";

describe("lerRespostas", () => {
  it("sem linha devolve as respostas vazias", () => {
    expect(lerRespostas(null)).toEqual(RESPOSTAS_VAZIAS);
  });

  it("descarta o que não é dor conhecida e limita a 3", () => {
    const r = lerRespostas({ dores: ["prazos", "xyz", "equipe", "obra", "financeiro"], dor_principal: "obra" });
    expect(r.dores).toEqual(["prazos", "equipe", "obra"]);
    expect(r.dorPrincipal).toBe("obra");
  });

  it("dor principal fora da lista cai para a primeira escolhida", () => {
    expect(lerRespostas({ dores: ["prazos", "equipe"], dor_principal: "financeiro" }).dorPrincipal).toBe("prazos");
  });

  it("não confia no contexto cru", () => {
    const r = lerRespostas({
      dores: ["prazos"],
      contexto: {
        projetosAtivos: "999",
        ferramentas: ["planilhas", "magica"],
        aprofundamento: { dor: "prazos", resposta: 3 },
      },
    });
    expect(r.contexto).toEqual({ ferramentas: ["planilhas"] });
  });

  it("etapa inválida volta para 1", () => {
    expect(lerRespostas({ etapa_atual: -3 }).etapaAtual).toBe(1);
  });
});

describe("paraLinha", () => {
  it("aparda o texto, vira null quando vazio e respeita o limite", () => {
    expect(paraLinha({ ...RESPOSTAS_VAZIAS, textoLivre: "   " }).texto_livre).toBeNull();
    expect(paraLinha({ ...RESPOSTAS_VAZIAS, textoLivre: ` oi ${"x".repeat(2000)}` }).texto_livre).toHaveLength(1000);
  });

  it("nunca grava mais de 3 dores nem principal fora delas", () => {
    const linha = paraLinha({
      ...RESPOSTAS_VAZIAS,
      dores: ["prazos", "equipe", "obra", "financeiro"],
      dorPrincipal: "aditivos",
    });
    expect(linha.dores).toHaveLength(MAX_DORES);
    expect(linha.dor_principal).toBe("prazos");
  });
});

describe("paridade com a migration", () => {
  it("as dores do app são exatamente as que a tabela aceita", () => {
    const sql = readFileSync("supabase/migrations/20261230000000_onboarding_respostas.sql", "utf8");
    const bloco = sql.match(/dores <@ ARRAY\[([\s\S]*?)\]::text\[\]/)?.[1] ?? "";
    const noBanco = [...bloco.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    const noApp = [...DORES.map((d) => d.value as string), "outra"].sort();
    expect(noBanco).toEqual(noApp);
  });
});
