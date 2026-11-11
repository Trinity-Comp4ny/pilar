import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ACOES_DE_ESCRITA, lerAcao } from "./entrada.ts";
import { nomeDaPastaDoProjeto, pastasQueFaltam } from "./pastas.ts";

const projeto = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";
const pasta = "1AbCdEfGhIjKlMn";

Deno.test("entradas das ações do Drive", () => {
  assertEquals(lerAcao({ acao: "pasta_projeto", projeto_id: projeto }).ok, true);
  assertEquals(lerAcao({ acao: "pasta_projeto", projeto_id: "x" }), { ok: false, error: "projeto_id inválido" });
  assertEquals(lerAcao({ acao: "listar", pasta_id: "x' or '1" }), { ok: false, error: "pasta inválida" });
  assertEquals(lerAcao({ acao: "criar_pasta", pasta_pai_id: pasta, nome: "  " }), {
    ok: false,
    error: "nome da pasta obrigatório",
  });
  assertEquals(lerAcao({ acao: "iniciar_upload", pasta_id: pasta, nome: "a.dwg", tamanho: 6 * 1024 ** 3 }), {
    ok: false,
    error: "arquivo maior que 5 GB",
  });
  assertEquals(lerAcao({ acao: "iniciar_upload", pasta_id: pasta, nome: "a.dwg", tamanho: 10 }).ok, true);
});

Deno.test("só criar pasta, enviar e lixeira pedem edição", () => {
  assertEquals([...ACOES_DE_ESCRITA].sort(), ["criar_pasta", "iniciar_upload", "lixeira"]);
  assert(!ACOES_DE_ESCRITA.has("pasta_projeto"));
});

Deno.test("pasta do projeto usa o nome dado pelo escritório; disciplinas sem pasta", () => {
  assertEquals(nomeDaPastaDoProjeto("  421 - Residência  Silva "), "421 - Residência Silva");
  assertEquals(nomeDaPastaDoProjeto(""), "Projeto");
  assertEquals(
    pastasQueFaltam(
      [
        { id: "d1", nome: "Elétrica" },
        { id: "d2", nome: "Hidráulica" },
      ],
      [{ projeto_disciplina_id: "d1" }, { projeto_disciplina_id: null }]
    ),
    [{ id: "d2", nome: "Hidráulica" }]
  );
});
