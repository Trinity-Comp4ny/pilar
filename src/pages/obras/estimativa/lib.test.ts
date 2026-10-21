import { describe, expect, it } from "vitest";
import { fichaInicial } from "@/lib/estimativaObra";
import type { ResultadoEstimativa } from "@/schemas/estimativaObra";
import { UFS } from "@/schemas/estimativaObra";
import {
  UFS_ORDENADAS,
  UF_NOME,
  compararCenarios,
  errosDaFicha,
  errosDoPasso,
  lerFichaDoBanco,
  lerNumero,
  lerPremissasDoBanco,
  fraseDoCenario,
  lerResultadoDoBanco,
  mesPadraoDeInicio,
  proximosMeses,
  resumoDaFicha,
  rotuloMes,
} from "./lib";

const ficha = fichaInicial("2027-03");

describe("meses", () => {
  it("lista do mês atual para frente, virando o ano", () => {
    const m = proximosMeses(new Date(Date.UTC(2026, 10, 20)), 4);
    expect(m.map((x) => x.valor)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(m[2].rotulo).toBe("jan/2027");
  });

  it("o início padrão é o mês seguinte ao de hoje", () => {
    expect(mesPadraoDeInicio(new Date(Date.UTC(2026, 9, 19)))).toBe("2026-11");
    expect(mesPadraoDeInicio(new Date(Date.UTC(2026, 11, 31)))).toBe("2027-01");
  });

  it("rótulo do mês", () => {
    expect(rotuloMes("2027-03")).toBe("mar/2027");
  });
});

describe("UFs", () => {
  it("toda UF tem nome e a lista ordenada tem as 27", () => {
    expect(UFS.every((u) => UF_NOME[u])).toBe(true);
    expect(UFS_ORDENADAS).toHaveLength(27);
    expect(UFS_ORDENADAS[0]).toBe("AC");
  });
});

describe("erros da ficha", () => {
  it("ficha válida não tem erro", () => {
    expect(errosDaFicha(ficha)).toEqual({});
  });

  it("cada campo traz o primeiro erro, em português", () => {
    const e = errosDaFicha({ ...ficha, area: 0, pavimentos: 0, inicio: "", subtipo: "" });
    expect(e.area).toBe("Informe a área construída");
    expect(e.pavimentos).toBe("Informe ao menos 1 pavimento");
    expect(e.inicio).toBe("Escolha o mês de início");
    expect(e.subtipo).toBe("Escolha o subtipo da obra");
  });

  it("campo vazio vira pedido de número, não mensagem técnica", () => {
    expect(errosDaFicha({ ...ficha, area: Number.NaN }).area).toBe("Informe um número");
    expect(errosDaFicha({ ...ficha, quartos: 2.5 }).quartos).toBe("Use um número inteiro");
  });

  it("subtipo de outro tipo de obra é recusado", () => {
    expect(errosDaFicha({ ...ficha, tipo: "industrial", subtipo: "sobrado" }).subtipo).toBe(
      "Subtipo não existe para esse tipo de obra"
    );
  });

  it("o passo só mostra os erros dos próprios campos", () => {
    const quebrada = { ...ficha, area: 0, quartos: -1 };
    expect(Object.keys(errosDoPasso("local", quebrada))).toEqual(["area"]);
    expect(Object.keys(errosDoPasso("programa", quebrada))).toEqual(["quartos"]);
    expect(errosDoPasso("tipo", quebrada)).toEqual({});
    expect(errosDoPasso("revisao", quebrada)).toEqual({});
  });
});

describe("leitura do banco", () => {
  it("ficha, premissas e resultado inválidos viram null ou vazio, sem quebrar", () => {
    expect(lerFichaDoBanco({ tipo: "residencial" })).toBeNull();
    expect(lerFichaDoBanco(ficha)).toEqual(ficha);
    expect(lerPremissasDoBanco({ adm: 999 })).toEqual({});
    expect(lerPremissasDoBanco({ adm: 10, equipe: 4 })).toEqual({ adm: 10, equipe: 4 });
    expect(lerResultadoDoBanco({})).toBeNull();
    expect(lerResultadoDoBanco(null)).toBeNull();
  });

  it("resumo da ficha em uma linha", () => {
    expect(resumoDaFicha({ ...ficha, area: 1250.5, padrao: "alto" }, "Sobrado")).toBe(
      "Sobrado · padrão alto · 1.250,5 m² · SP"
    );
  });
});

describe("cenários", () => {
  const r = (provavel: number, meses: number) => ({ provavel, meses }) as ResultadoEstimativa;
  const reais = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

  it("trocar para um padrão mais barato e mais curto", () => {
    const d = compararCenarios(r(1_000_000, 14), r(800_000, 13));
    expect(d).toEqual({ custo: -200_000, custoPct: -20, meses: -1 });
    expect(fraseDoCenario("normal", d, reais)).toBe(
      "Trocar para o padrão normal economiza R$ 200.000 (20%) e encurta a obra em 1 mês."
    );
  });

  it("trocar para um padrão mais caro e mais longo", () => {
    const d = compararCenarios(r(800_000, 12), r(1_000_000, 15));
    expect(d.custoPct).toBe(25);
    expect(fraseDoCenario("alto", d, reais)).toBe(
      "Trocar para o padrão alto acrescenta R$ 200.000 (25%) e alonga a obra em 3 meses."
    );
  });

  it("sem diferença, diz que não muda", () => {
    const d = compararCenarios(r(500_000, 10), r(500_000, 10));
    expect(fraseDoCenario("normal", d, reais)).toBe("Trocar para o padrão normal não muda o custo e mantém o prazo.");
  });

  it("custo atual zero não divide por zero", () => {
    expect(compararCenarios(r(0, 4), r(100, 4)).custoPct).toBe(0);
  });
});

describe("lerNumero", () => {
  it("aceita vírgula e ponto decimal, e vazio vira NaN", () => {
    expect(lerNumero("1250,5")).toBe(1250.5);
    expect(lerNumero("12.5")).toBe(12.5);
    expect(lerNumero(" 7 ")).toBe(7);
    expect(lerNumero("")).toBeNaN();
    expect(lerNumero("abc")).toBeNaN();
  });
});
