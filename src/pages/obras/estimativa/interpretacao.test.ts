import { describe, expect, it } from "vitest";
import {
  aplicarInterpretacao,
  frasesDoQueMais,
  interpretacaoSchema,
  valeParaOTipo,
  type ItemLido,
} from "./interpretacao";
import { fichaInicial } from "@/lib/estimativaObra";

const base = fichaInicial("2027-03");
const vazio = { ambientes: {}, marcenaria: null, relevo: null };
const item = (id: ItemLido["id"], quantidade: number): ItemLido => ({ id, quantidade, trecho: "" });

describe("aplicarInterpretacao", () => {
  it("põe cada item no campo certo da ficha", () => {
    const f = aplicarInterpretacao(base, {
      ...vazio,
      itens: [item("ac12", 6), item("fv", 10), item("automacao", 1), item("piscina", 20), item("elevador", 1)],
    });
    expect(f.itens).toEqual({ ac12: 6, fv: 10, automacao: 1 });
    expect(f.piscina).toBe(20);
    expect(f.elevador).toBe(true);
    expect(f.gourmet).toBe(false);
  });

  it("soma ao que já estava marcado: o que o texto não cita fica como está", () => {
    const antes = { ...base, itens: { ac9: 2 }, gourmet: true, quartos: 4, marcenaria: "basica" as const };
    const f = aplicarInterpretacao(antes, { ...vazio, itens: [item("ac12", 3)] });
    expect(f.itens).toEqual({ ac9: 2, ac12: 3 });
    expect(f.gourmet).toBe(true);
    expect(f.quartos).toBe(4);
    expect(f.marcenaria).toBe("basica");
  });

  it("não muda a ficha de entrada", () => {
    const antes = { ...base, itens: { ac9: 2 } };
    aplicarInterpretacao(antes, { ...vazio, itens: [item("ac12", 3)] });
    expect(antes.itens).toEqual({ ac9: 2 });
  });

  it("ambientes, marcenaria e relevo entram só quando o texto citou", () => {
    const f = aplicarInterpretacao(base, {
      itens: [],
      ambientes: { quartos: 4, suites: 2, banheiros: null, lavabos: 1, vagas: 3 },
      marcenaria: "completa",
      relevo: { inclinado: true, arrimo_m2: 60 },
    });
    expect(f).toMatchObject({
      quartos: 4,
      suites: 2,
      banheiros: base.banheiros,
      lavabo: 1,
      vagas: 3,
      marcenaria: "completa",
      topografia: "inclinado",
      arrimo: 60,
    });
  });

  it("terreno inclinado sem medida não zera um muro já medido", () => {
    const f = aplicarInterpretacao(
      { ...base, arrimo: 40 },
      { itens: [], ambientes: {}, marcenaria: null, relevo: { inclinado: true, arrimo_m2: null } }
    );
    expect(f.topografia).toBe("inclinado");
    expect(f.arrimo).toBe(40);
  });

  it("fora do residencial ignora piscina, gourmet, quartos, suítes e lavabos", () => {
    const comercial = { ...base, tipo: "comercial" as const, subtipo: "salas", quartos: 0, suites: 0, lavabo: 0 };
    const f = aplicarInterpretacao(comercial, {
      itens: [item("piscina", 20), item("gourmet", 1), item("ac12", 2)],
      ambientes: { quartos: 3, suites: 1, lavabos: 1, banheiros: 6, vagas: 10 },
      marcenaria: null,
      relevo: null,
    });
    expect(f.piscina).toBe(0);
    expect(f.gourmet).toBe(false);
    expect(f.itens).toEqual({ ac12: 2 });
    expect([f.quartos, f.suites, f.lavabo]).toEqual([0, 0, 0]);
    expect([f.banheiros, f.vagas]).toEqual([6, 10]);
    expect(valeParaOTipo("piscina", "comercial")).toBe(false);
    expect(valeParaOTipo("piscina", "residencial")).toBe(true);
  });
});

describe("frasesDoQueMais", () => {
  it("resume ambientes, marcenaria e relevo", () => {
    expect(
      frasesDoQueMais({
        ambientes: { quartos: 1, suites: 2, vagas: 3 },
        marcenaria: "basica",
        relevo: { inclinado: true, arrimo_m2: 60 },
      })
    ).toEqual([
      "Ambientes: 1 quarto, 2 suítes, 3 vagas.",
      "Marcenaria básica.",
      "Terreno inclinado com 60 m² de muro de arrimo.",
    ]);
  });

  it("terreno inclinado sem medida diz que o muro fica a medir; sem nada, não diz nada", () => {
    expect(frasesDoQueMais({ ambientes: {}, marcenaria: null, relevo: { inclinado: true, arrimo_m2: null } })).toEqual([
      "Terreno inclinado: o muro de arrimo fica a medir.",
    ]);
    expect(frasesDoQueMais({ ambientes: {}, marcenaria: null, relevo: null })).toEqual([]);
  });
});

describe("interpretacaoSchema", () => {
  it("aceita a resposta da função e preenche o que veio ausente", () => {
    const r = interpretacaoSchema.parse({ itens: [{ id: "ac12", quantidade: 6, trecho: "6 splits" }] });
    expect(r.ambientes).toEqual({});
    expect(r.marcenaria).toBeNull();
    expect(r.fora_do_catalogo).toEqual([]);
    expect(r.perguntas).toEqual([]);
  });

  it("recusa id fora do catálogo, quantidade zero e formato errado", () => {
    expect(interpretacaoSchema.safeParse({ itens: [{ id: "cinema", quantidade: 1 }] }).success).toBe(false);
    expect(interpretacaoSchema.safeParse({ itens: [{ id: "ac12", quantidade: 0 }] }).success).toBe(false);
    expect(interpretacaoSchema.safeParse({ itens: "ac12" }).success).toBe(false);
    expect(interpretacaoSchema.safeParse(null).success).toBe(false);
  });
});
