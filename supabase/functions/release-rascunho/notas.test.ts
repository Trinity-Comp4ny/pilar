import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada, lerNotas, MAX_COMMITS, MAX_TEXTO, tituloPadrao } from "./notas.ts";

const A = "0b8e6a52-6f6c-4d6e-9a53-2b1f0c9d7e11";
const SHA1 = "1111111aaaaaaa";
const SHA2 = "2222222bbbbbbb";

Deno.test("commit sem Novidade: é interno e não vira item", () => {
  const notas = lerNotas([{ sha: SHA1, mensagem: "refactor(db): índice novo\n\nFeedback: " + A }]);
  assertEquals(notas, { itens: [], avisos: [] });
});

Deno.test("lê texto, impacto, módulo e feedback do mesmo commit", () => {
  const notas = lerNotas([
    {
      sha: SHA1,
      mensagem: `feat(faturas): fatura no projeto\n\nNovidade: A fatura agora sai de dentro do projeto\nImpacto: fluxo\nModulo: Financeiro\nFeedback: ${A.toUpperCase()}`,
    },
  ]);
  assertEquals(notas.avisos, []);
  assertEquals(notas.itens, [
    {
      texto: "A fatura agora sai de dentro do projeto",
      impacto: "fluxo",
      modulo: "financeiro",
      feedback_ids: [A],
      commit_sha: SHA1,
    },
  ]);
});

Deno.test("sem Impacto entra como melhoria com aviso; impacto inválido é ignorado com aviso", () => {
  const notas = lerNotas([
    { sha: SHA1, mensagem: "feat: a\n\nNovidade: Exporta em Excel" },
    { sha: SHA2, mensagem: "feat: b\n\nNovidade: Outra coisa\nImpacto: enorme" },
  ]);
  assertEquals(
    notas.itens.map((i) => [i.texto, i.impacto]),
    [["Exporta em Excel", "melhoria"]]
  );
  assertEquals(notas.avisos.length, 2);
});

Deno.test("aceita correção com acento e ordena fluxo antes de melhoria e correção", () => {
  const notas = lerNotas([
    { sha: SHA1, mensagem: "fix: a\n\nNovidade: Total do mês não duplica\nImpacto: correção" },
    { sha: SHA2, mensagem: "feat: b\n\nNovidade: Botão mudou de lugar\nImpacto: fluxo" },
  ]);
  assertEquals(
    notas.itens.map((i) => i.impacto),
    ["fluxo", "correcao"]
  );
});

Deno.test("não repete o mesmo texto de commits diferentes e corta texto longo", () => {
  const longo = "x".repeat(MAX_TEXTO + 20);
  const notas = lerNotas([
    { sha: SHA1, mensagem: "feat: a\n\nNovidade: Igual\nImpacto: melhoria" },
    { sha: SHA2, mensagem: `feat: b\n\nNovidade: igual\nImpacto: melhoria\nNovidade: ${longo}` },
  ]);
  assertEquals(notas.itens.length, 2);
  assertEquals(notas.itens[1].texto.length, MAX_TEXTO);
});

Deno.test("Novidade só vale no começo da linha e módulo inválido vira aviso", () => {
  const notas = lerNotas([
    { sha: SHA1, mensagem: "feat: a\n\nVer Novidade: não conta\nNovidade: Conta\nImpacto: melhoria\nModulo: ../x" },
  ]);
  assertEquals(
    notas.itens.map((i) => [i.texto, i.modulo]),
    [["Conta", null]]
  );
  assertEquals(notas.avisos.length, 1);
});

Deno.test("lerEntrada valida sha e commits", () => {
  assertEquals(lerEntrada({ sha: "abc1234", commits: [] }).ok, true);
  assertEquals(lerEntrada({ sha: "zzz", commits: [] }).ok, false);
  assertEquals(lerEntrada({ sha: "abc1234", commits: [{ sha: 1 }] }).ok, false);
  assertEquals(
    lerEntrada({ sha: "abc1234", commits: Array(MAX_COMMITS + 1).fill({ sha: "a", mensagem: "" }) }).ok,
    false
  );
  assertEquals(lerEntrada(null).ok, false);
});

Deno.test("título padrão usa a data de Brasília", () => {
  // 02:00 UTC do dia 11 ainda é dia 10 em Brasília.
  assertEquals(tituloPadrao(new Date("2026-11-11T02:00:00Z")), "Atualização de 10 de novembro de 2026");
});
