import { describe, expect, it } from "vitest";
import {
  acharZipsSinapi,
  arquivoDoMes,
  atraso,
  fonteDaColeta,
  mesesPendentes,
  planilhaDoZip,
  precisaReimportar,
} from "./fonte";

const PAGINA = "https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx";
const BASE = "https://www.caixa.gov.br/Downloads/sinapi-relatorios-mensais";
const dia = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("mesesPendentes", () => {
  it("busca do mês seguinte ao gravado até o mês anterior a hoje", () => {
    expect(mesesPendentes("2026-08-01", dia("2026-11-10"))).toEqual(["2026-09-01", "2026-10-01"]);
  });

  it("não busca nada quando o mês anterior já está gravado", () => {
    expect(mesesPendentes("2026-10-01", dia("2026-11-10"))).toEqual([]);
  });

  it("sem nada gravado ou muito atrás, fica nos três meses mais recentes", () => {
    const esperado = ["2026-08-01", "2026-09-01", "2026-10-01"];
    expect(mesesPendentes(null, dia("2026-11-10"))).toEqual(esperado);
    expect(mesesPendentes("2025-01-01", dia("2026-11-10"))).toEqual(esperado);
  });

  it("vira o ano", () => {
    expect(mesesPendentes("2026-11-01", dia("2027-01-20"))).toEqual(["2026-12-01"]);
  });
});

describe("acharZipsSinapi", () => {
  it("acha os zips mensais e fica com a retificação mais nova", () => {
    const html = `
      <a href="/Downloads/sinapi-relatorios-mensais/SINAPI-2026-09-formato-xlsx.zip">Setembro</a>
      <a href='https://www.caixa.gov.br/Downloads/sinapi-relatorios-mensais/SINAPI-2026-02-formato-xlsx.zip'>Fev</a>
      <a href="/Downloads/sinapi-relatorios-mensais/SINAPI-2026-02-formato-xlsx_Retificacao01.zip">Fev ret</a>
      <a href="/Downloads/outra-coisa/manual.pdf">Manual</a>
      <a href="/Downloads/x/SINAPI-2026-13-formato-xlsx.zip">mês inválido</a>`;
    const achados = acharZipsSinapi(html, PAGINA);
    expect([...achados.keys()].sort()).toEqual(["2026-02-01", "2026-09-01"]);
    expect(achados.get("2026-09-01")).toEqual({
      mes: "2026-09-01",
      url: `${BASE}/SINAPI-2026-09-formato-xlsx.zip`,
      nome: "SINAPI-2026-09-formato-xlsx.zip",
      retificacao: 0,
    });
    expect(achados.get("2026-02-01")?.retificacao).toBe(1);
    expect(achados.get("2026-02-01")?.url).toBe(`${BASE}/SINAPI-2026-02-formato-xlsx_Retificacao01.zip`);
  });

  it("ignora link que não é https e % solto", () => {
    const html = `<a href="http://exemplo.com/SINAPI-2026-09-formato-xlsx.zip">x</a><a href="/a%zz/b">y</a>`;
    expect(acharZipsSinapi(html, PAGINA).size).toBe(0);
  });
});

describe("arquivoDoMes", () => {
  it("sem link na página, usa o endereço direto pelo nome padrão", () => {
    expect(arquivoDoMes("2026-10-01", new Map(), `${BASE}/`)).toEqual({
      mes: "2026-10-01",
      url: `${BASE}/SINAPI-2026-10-formato-xlsx.zip`,
      nome: "SINAPI-2026-10-formato-xlsx.zip",
      retificacao: 0,
    });
  });
});

describe("planilhaDoZip", () => {
  it("acha o SINAPI_Referência do mês, com ou sem acento e pasta", () => {
    expect(planilhaDoZip(["SINAPI_Manual.pdf", "SINAPI_Referência_2026_09.xlsx"], "2026-09-01")).toBe(
      "SINAPI_Referência_2026_09.xlsx"
    );
    expect(planilhaDoZip(["pasta/SINAPI_Refer�ncia_2026_09.xlsx"], "2026-09-01")).toBe(
      "pasta/SINAPI_Refer�ncia_2026_09.xlsx"
    );
  });

  it("recusa mês diferente, nenhuma ou mais de uma", () => {
    expect(planilhaDoZip(["SINAPI_Referência_2026_08.xlsx"], "2026-09-01")).toBeNull();
    expect(planilhaDoZip([], "2026-09-01")).toBeNull();
    expect(
      planilhaDoZip(["a/SINAPI_Referência_2026_09.xlsx", "b/SINAPI_Referencia_2026_09.xlsx"], "2026-09-01")
    ).toBeNull();
  });
});

describe("retificação", () => {
  const ret = { mes: "2026-02-01", url: "u", nome: "SINAPI-2026-02-formato-xlsx_Retificacao01.zip", retificacao: 1 };

  it("reimporta quando a retificação publicada é mais nova que a gravada", () => {
    expect(precisaReimportar("SINAPI 02/2026 (coleta automática: SINAPI-2026-02-formato-xlsx.zip)", ret)).toBe(true);
    expect(precisaReimportar("SINAPI fevereiro de 2026 (SINAPI_Referência_2026_02.xlsx)", ret)).toBe(true);
    expect(precisaReimportar(fonteDaColeta(ret), ret)).toBe(false);
  });

  it("publicação original nunca reimporta", () => {
    expect(precisaReimportar("qualquer", { ...ret, retificacao: 0 })).toBe(false);
  });
});

describe("atraso", () => {
  it("antes do prazo basta o mês retrasado", () => {
    expect(atraso("sinapi", "2026-09-01", dia("2026-11-14"))).toBeNull();
    expect(atraso("cub", "2026-09-01", dia("2026-11-09"))).toBeNull();
  });

  it("depois do prazo exige o mês anterior", () => {
    expect(atraso("sinapi", "2026-09-01", dia("2026-11-15"))).toEqual({
      base: "sinapi",
      esperado: "2026-10-01",
      ultimo: "2026-09-01",
    });
    expect(atraso("cub", "2026-10-01", dia("2026-11-20"))).toBeNull();
  });

  it("nada gravado é atraso", () => {
    expect(atraso("cub", null, dia("2026-11-01"))?.esperado).toBe("2026-09-01");
  });
});
