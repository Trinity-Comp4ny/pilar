import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { caminhoAte, dentroDaPastaDoCliente } from "./arvore.ts";
import { lerAcao } from "./entrada.ts";

// Projeto: raiz > {Elétrica, Cliente > {Entrega final > Revisão 2}}
const pastas = [
  { pasta_id: "raiz", pasta_pai_id: null, nome: "421 - Casa" },
  { pasta_id: "eletrica", pasta_pai_id: "raiz", nome: "Elétrica" },
  { pasta_id: "cliente", pasta_pai_id: "raiz", nome: "Cliente" },
  { pasta_id: "entrega", pasta_pai_id: "cliente", nome: "Entrega final" },
  { pasta_id: "rev2", pasta_pai_id: "entrega", nome: "Revisão 2" },
];

Deno.test("cliente só enxerga a pasta Cliente e o que está abaixo dela", () => {
  assert(dentroDaPastaDoCliente("cliente", "cliente", pastas));
  assert(dentroDaPastaDoCliente("rev2", "cliente", pastas));
  assert(!dentroDaPastaDoCliente("eletrica", "cliente", pastas));
  assert(!dentroDaPastaDoCliente("raiz", "cliente", pastas));
  assert(!dentroDaPastaDoCliente("desconhecida", "cliente", pastas));
});

Deno.test("ciclo no registro não trava a busca", () => {
  const ciclo = [
    { pasta_id: "a", pasta_pai_id: "b" },
    { pasta_id: "b", pasta_pai_id: "a" },
  ];
  assert(!dentroDaPastaDoCliente("a", "cliente", ciclo));
});

Deno.test("caminho para o voltar começa na pasta Cliente", () => {
  assertEquals(
    caminhoAte("rev2", "cliente", pastas).map((p) => p.nome),
    ["Cliente", "Entrega final", "Revisão 2"]
  );
  assertEquals(caminhoAte("eletrica", "cliente", pastas), []);
});

Deno.test("entradas do portal exigem sessão, projeto e id válido", () => {
  const projeto = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";
  assertEquals(lerAcao({ acao: "listar", session_token: "t", projeto_id: projeto }).ok, true);
  assertEquals(lerAcao({ acao: "listar", projeto_id: projeto }), { ok: false, error: "session_token obrigatório" });
  assertEquals(lerAcao({ acao: "baixar", session_token: "t", projeto_id: projeto, arquivo_id: "x' or '1" }), {
    ok: false,
    error: "arquivo inválido",
  });
  assertEquals(lerAcao({ acao: "apagar", session_token: "t", projeto_id: projeto }).ok, false);
});
