import { describe, expect, it } from "vitest";
import {
  candidatosDoMes,
  lerPortaisExtras,
  linksPdfDaPagina,
  linksPdfDoWordpress,
  portaisDaUf,
  urlWordpressMedia,
  type LinkPdf,
} from "./portais";

const PAGINA = "https://sindusconsp.com.br/servicos/cub/";

describe("linksPdfDaPagina", () => {
  it("pega os PDFs com o texto da âncora, resolve relativo e descarta o que não é https ou PDF", () => {
    const html = `
      <a href="/wp-content/uploads/2026/11/CUB-Outubro-2026.pdf"><span>CUB</span> outubro&nbsp;2026</a>
      <a href="http://inseguro.com/cub.pdf">x</a>
      <a href="/noticia/cub">notícia</a>
      <a class="b" href='https://cdn.exemplo.com/a/CUB_10_2026_desonerado.PDF?v=2'>Desonerado</a>`;
    expect(linksPdfDaPagina(html, PAGINA)).toEqual([
      { url: "https://sindusconsp.com.br/wp-content/uploads/2026/11/CUB-Outubro-2026.pdf", texto: "CUB outubro 2026" },
      { url: "https://cdn.exemplo.com/a/CUB_10_2026_desonerado.PDF?v=2", texto: "Desonerado" },
    ]);
  });
});

describe("linksPdfDoWordpress", () => {
  it("lê source_url e o título, só PDF https", () => {
    const json = [
      {
        source_url:
          "https://sinduscon-rs.com.br/wp-content/uploads/2026/11/PRECOS-E-CUSTOS-DA-CONSTRUCAO-NOVEMBRO-2026.pdf",
        title: { rendered: "Preços &#038; custos" },
      },
      { source_url: "https://sinduscon-rs.com.br/wp-content/uploads/2026/11/foto.jpg", title: { rendered: "foto" } },
      { nada: 1 },
    ];
    expect(linksPdfDoWordpress(json)).toHaveLength(1);
    expect(linksPdfDoWordpress({ code: "rest_no_route" })).toEqual([]);
    expect(urlWordpressMedia(PAGINA)).toBe(
      "https://sindusconsp.com.br/wp-json/wp/v2/media?search=cub&per_page=100&mime_type=application/pdf"
    );
  });
});

describe("candidatosDoMes", () => {
  const L = (url: string, texto = ""): LinkPdf => ({
    url: `https://s.com.br/wp-content/uploads/2026/11/${url}`,
    texto,
  });
  const links = [
    L("CUB-Outubro-2026.pdf"),
    L("CUB-Outubro-2026-Desonerado.pdf"),
    L("CUB-Setembro-2026.pdf"),
    L("tabela.pdf", "CUB out/2026 sem desoneração"),
    L("cub_10-2026_com_desoneracao.pdf"),
  ];

  it("separa por regime e ignora a pasta de upload do WordPress", () => {
    expect(candidatosDoMes(links, "2026-10-01", "onerado", "referencia").map((l) => l.url.split("/").pop())).toEqual([
      "CUB-Outubro-2026.pdf",
      "tabela.pdf",
    ]);
    expect(candidatosDoMes(links, "2026-10-01", "desonerado", "referencia").map((l) => l.url.split("/").pop())).toEqual(
      ["CUB-Outubro-2026-Desonerado.pdf", "cub_10-2026_com_desoneracao.pdf"]
    );
    // A pasta 2026/11 não faz o arquivo virar de novembro.
    expect(candidatosDoMes(links, "2026-11-01", "onerado", "referencia")).toEqual([]);
  });

  it("mês de publicação: o CUB de janeiro está no arquivo de fevereiro", () => {
    const rs = [
      L("PRECOS-E-CUSTOS-DA-CONSTRUCAO-FEVEREIRO-2026.pdf"),
      L("PRECOS-E-CUSTOS-DA-CONSTRUCAO-JANEIRO-2026.pdf"),
    ];
    const onerado = candidatosDoMes(rs, "2026-01-01", "onerado", "publicacao");
    expect(onerado.map((l) => l.url.split("/").pop())).toEqual(["PRECOS-E-CUSTOS-DA-CONSTRUCAO-FEVEREIRO-2026.pdf"]);
    // Sem arquivo marcado como desonerado, o mesmo arquivo serve aos dois regimes: a leitura decide.
    expect(candidatosDoMes(rs, "2026-01-01", "desonerado", "publicacao")).toEqual(
      onerado.map((l) => ({ ...l, semMarcaDeRegime: true }))
    );
    // Dezembro vira janeiro do ano seguinte.
    expect(candidatosDoMes([L("PRECOS-JANEIRO-2027.pdf")], "2026-12-01", "onerado", "publicacao")).toHaveLength(1);
  });

  it("não confunde mês com outro número", () => {
    expect(
      candidatosDoMes([L("relatorio-1102026.pdf"), L("cub-2026-100.pdf")], "2026-10-01", "onerado", "referencia")
    ).toEqual([]);
  });
});

describe("configuração", () => {
  it("lê portais extras e a extra substitui o padrão", () => {
    const extras = lerPortaisExtras(
      "TO=https://to.org.br/cub/; SP=https://outro.sp/cub/|publicacao; AL=http://inseguro/"
    );
    expect(extras.map((p) => p.uf)).toEqual(["TO", "SP"]);
    expect(portaisDaUf("SP", extras)).toMatchObject({ paginas: ["https://outro.sp/cub/"], mesNoArquivo: "publicacao" });
    expect(portaisDaUf("RS", [])).toMatchObject({ soPortal: true, mesNoArquivo: "publicacao" });
    expect(portaisDaUf("GO", [])).toBeNull();
  });
});
