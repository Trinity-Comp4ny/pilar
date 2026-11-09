import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { ErroDeDocx } from "./erroDeDocx";
import { chavesSimplesNoDocx, extractVariablesFromDocx, generateDocx } from "./docxUtils";

// Monta um .docx mínimo: o que o docxtemplater precisa para abrir e renderizar.
function docx(corpo: string, extras: Record<string, string> = {}): ArrayBuffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${corpo}</w:t></w:r></w:p></w:body></w:document>`
  );
  for (const [nome, conteudo] of Object.entries(extras)) zip.file(nome, conteudo);
  return zip.generate({ type: "arraybuffer" });
}

const cabecalho = (texto: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>${texto}</w:t></w:r></w:p></w:hdr>`;

describe("extractVariablesFromDocx", () => {
  it("lista as variáveis do corpo, sem repetir", () => {
    expect(extractVariablesFromDocx(docx("Oi {{CLIENTE_NOME}}, {{CLIENTE_NOME}} e {{CODIGO}}"))).toEqual([
      "CLIENTE_NOME",
      "CODIGO",
    ]);
  });

  it("inclui variáveis do cabeçalho, que o getFullText não lê", () => {
    const buffer = docx("Corpo {{CODIGO}}", { "word/header1.xml": cabecalho("{{EMPRESA_NOME}}") });
    expect(extractVariablesFromDocx(buffer)).toEqual(["CODIGO", "EMPRESA_NOME"]);
  });

  it("documento pronto, sem marcação, devolve lista vazia", () => {
    expect(extractVariablesFromDocx(docx("Proposta comercial pronta"))).toEqual([]);
  });

  it("marcação sem fechar vira mensagem que diz onde olhar", () => {
    const erro = (() => {
      try {
        extractVariablesFromDocx(docx("Oi {{NOME e {{OUTRO}}"));
      } catch (e) {
        return e;
      }
    })();
    expect(erro).toBeInstanceOf(ErroDeDocx);
    expect((erro as Error).message).toContain("1 marcação(ões)");
    expect((erro as Error).message).toContain("{{NOME e");
  });

  it("arquivo que não é zip vira erro legível, não o texto do zip", () => {
    expect(() => extractVariablesFromDocx(new ArrayBuffer(10))).toThrow(/Não foi possível ler este arquivo/);
  });
});

describe("generateDocx", () => {
  it("substitui as variáveis e devolve um Blob de Word", async () => {
    const blob = generateDocx(docx("Cliente: {{CLIENTE_NOME}}"), { CLIENTE_NOME: "Ana" });
    expect(blob.type).toContain("wordprocessingml.document");
    const zip = new PizZip(await blob.arrayBuffer());
    expect(zip.file("word/document.xml")?.asText()).toContain("Cliente: Ana");
  });

  it("template com marcação quebrada falha com mensagem de usuário", () => {
    expect(() => generateDocx(docx("Oi NOME}}"), {})).toThrow(ErroDeDocx);
  });

  it("variável com espaço dentro das chaves, {{ CODIGO }}, é substituída em vez de virar undefined", async () => {
    const blob = generateDocx(docx("Código {{ CODIGO }}"), { CODIGO: "0655" });
    const zip = new PizZip(await blob.arrayBuffer());
    expect(zip.file("word/document.xml")?.asText()).toContain("Código 0655");
  });

  it("variável sem valor sai em branco, nunca como o texto undefined", async () => {
    const blob = generateDocx(docx("Valor {{NAO_EXISTE}} fim"), {});
    const xml = new PizZip(await blob.arrayBuffer()).file("word/document.xml")?.asText() ?? "";
    expect(xml).toContain("Valor  fim");
    expect(xml).not.toContain("undefined");
  });

  it("variável repetida num laço continua funcionando com o parser próprio", async () => {
    const corpo = "{{#ITENS}}- {{nome}} {{/ITENS}}";
    const blob = generateDocx(docx(corpo), { ITENS: [{ nome: "A" }, { nome: "B" }] } as unknown as Record<
      string,
      string
    >);
    const xml = new PizZip(await blob.arrayBuffer()).file("word/document.xml")?.asText() ?? "";
    expect(xml).toContain("- A");
    expect(xml).toContain("- B");
  });
});

describe("chavesSimplesNoDocx", () => {
  it("acha {CODIGO} escrito com uma chave só e ignora {{CODIGO}}", () => {
    expect(chavesSimplesNoDocx(docx("Código {CODIGO} e {{CLIENTE_NOME}}"))).toEqual(["CODIGO"]);
  });

  it("sem chave simples devolve lista vazia", () => {
    expect(chavesSimplesNoDocx(docx("Texto comum"))).toEqual([]);
  });
});
