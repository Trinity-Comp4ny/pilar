import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  campoProibido,
  iatDoToken,
  limparLinha,
  linhaVisivel,
  montarLeiaMe,
  nomeDoArquivo,
  paraCsv,
  sessaoRecente,
  TABELAS_EXPORTADAS,
} from "./exportacao.ts";

Deno.test("campos de segredo nunca saem, por padrão de nome", () => {
  for (const nome of [
    "token",
    "asaas_credit_card_token",
    "token_hash",
    "senha",
    "api_key",
    "ip_address",
    "print_path",
  ]) {
    assertEquals(campoProibido(nome), true, nome);
  }
  for (const nome of ["nome", "valor", "data_vencimento", "empresa_id", "descricao"]) {
    assertEquals(campoProibido(nome), false, nome);
  }
});

Deno.test("limparLinha tira só os campos proibidos", () => {
  assertEquals(limparLinha({ id: 1, nome: "A", access_token: "x" }), { id: 1, nome: "A" });
});

Deno.test("linha apagada (soft delete) não sai", () => {
  assertEquals(linhaVisivel({ id: 1, deleted_at: null }), true);
  assertEquals(linhaVisivel({ id: 1 }), true);
  assertEquals(linhaVisivel({ id: 1, deleted_at: "2026-11-01T00:00:00Z" }), false);
});

Deno.test("CSV: BOM, ponto e vírgula, aspas escapadas e JSON em coluna objeto", () => {
  const csv = paraCsv([
    { id: 1, nome: 'Casa "Azul"; lote 2', extra: { a: 1 } },
    { id: 2, nome: "Linha\nquebrada", extra: null },
  ]);
  assertEquals(csv.startsWith("﻿id;nome;extra\r\n"), true);
  assertEquals(csv.includes('1;"Casa ""Azul""; lote 2";"{""a"":1}"'), true);
  assertEquals(csv.includes('2;"Linha\nquebrada";'), true);
});

Deno.test("CSV: texto que parece fórmula ganha apóstrofo, número negativo não", () => {
  const csv = paraCsv([{ a: "=HYPERLINK(1)", b: "-2+3", c: -150.5, d: "@x" }]);
  assertEquals(csv.includes("'=HYPERLINK(1);'-2+3;-150.5;'@x"), true);
});

Deno.test("CSV vazio é só o BOM e a união das colunas respeita linhas desiguais", () => {
  assertEquals(paraCsv([]), "﻿");
  assertEquals(paraCsv([{ a: 1 }, { b: 2 }]), "﻿a;b\r\n1;\r\n;2\r\n");
});

Deno.test("LEIA-ME lista o que saiu, o que truncou e o que falhou", () => {
  const texto = montarLeiaMe({
    empresaNome: "Escritório X",
    geradoEm: "17/11/2026",
    resumo: [
      { tabela: "clientes", linhas: 12, truncada: false },
      { tabela: "despesas", linhas: 50000, truncada: true },
      { tabela: "obras", linhas: 0, truncada: false, indisponivel: true },
    ],
  });
  assertEquals(texto.includes("- clientes.csv: 12 linha(s)"), true);
  assertEquals(texto.includes("(truncada no limite)"), true);
  assertEquals(texto.includes("- obras"), true);
  assertEquals(texto.includes("arquivos anexados"), true);
});

Deno.test("nome do arquivo sem acento nem caractere estranho", () => {
  assertEquals(
    nomeDoArquivo("Escritório São João & Cia", new Date("2026-11-17T10:00:00Z")),
    "dados-escritorio-sao-joao-cia-2026-11-17.zip"
  );
  assertEquals(nomeDoArquivo("***", new Date("2026-11-17T10:00:00Z")), "dados-empresa-2026-11-17.zip");
});

Deno.test("sessão recente: até 15 min; sem iat recusa", () => {
  const agora = 1_800_000_000_000;
  assertEquals(sessaoRecente(agora / 1000 - 600, agora), true);
  assertEquals(sessaoRecente(agora / 1000 - 3600, agora), false);
  assertEquals(sessaoRecente(null, agora), false);
});

Deno.test("iat é lido do payload do JWT", () => {
  const payload = btoa(JSON.stringify({ iat: 123 })).replace(/=+$/, "");
  assertEquals(iatDoToken(`Bearer a.${payload}.c`), 123);
  assertEquals(iatDoToken("Bearer lixo"), null);
  assertEquals(iatDoToken(null), null);
});

Deno.test("lista de tabelas sem duplicata e sem tabela de sistema", () => {
  assertEquals(new Set(TABELAS_EXPORTADAS).size, TABELAS_EXPORTADAS.length);
  for (const proibida of ["profiles", "pilar_subscriptions", "audit_logs", "admin_audit_logs", "convites"]) {
    assertEquals((TABELAS_EXPORTADAS as readonly string[]).includes(proibida), false, proibida);
  }
});
