import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { z } from "../_shared/schemas.ts";
import { type Ferramenta, FERRAMENTA_POR_NOME, FERRAMENTAS } from "./ferramentas.ts";
import {
  instrucaoDeResposta,
  investigar,
  MAX_PASSOS,
  type Observacao,
  type Passo,
  PassoSchema,
  type Planejamento,
  promptPlanejador,
} from "./investigar.ts";

const ctx = { db: {} as never, empresaId: "e1" };

function plano(data: Passo): Planejamento {
  return { data, tokensEntrada: 10, tokensSaida: 5, attempts: 1 };
}

function ferramentaFalsa(nome: string, executar: Ferramenta["executar"]): Ferramenta {
  return { nome, descricao: "falsa", args: z.object({ n: z.number().int().default(1) }), executar };
}

Deno.test("PassoSchema: aceita consultar com chamadas e responder sem chamadas", () => {
  assert(PassoSchema.safeParse({ acao: "consultar", chamadas: [{ ferramenta: "listar_pendencias" }] }).success);
  assert(PassoSchema.safeParse({ acao: "responder" }).success);
  assertEquals(PassoSchema.safeParse({ acao: "inventar" }).success, false);
});

Deno.test("PassoSchema: mais de 3 chamadas por rodada é recusado", () => {
  const chamadas = Array.from({ length: 4 }, () => ({ ferramenta: "x", args: {} }));
  assertEquals(PassoSchema.safeParse({ acao: "consultar", chamadas }).success, false);
});

Deno.test("investigar: responde direto quando o planejador não pede consulta", async () => {
  const r = await investigar({
    planejar: async () => plano({ motivo: "saudação", acao: "responder", chamadas: [] }),
    ferramentas: new Map(),
    ctx,
  });
  assertEquals(r.observacoes.length, 0);
  assertEquals(r.passos, 1);
  assertEquals(r.uso, { tokensEntrada: 10, tokensSaida: 5, chamadas: 1 });
});

Deno.test("investigar: consulta, olha o resultado e responde na rodada seguinte", async () => {
  let rodada = 0;
  const f = ferramentaFalsa("lista", async () => ({ total: 2, linhas: [1, 2] }));
  const r = await investigar({
    planejar: async (obs) => {
      rodada++;
      return rodada === 1
        ? plano({ motivo: "", acao: "consultar", chamadas: [{ ferramenta: "lista", args: { n: 2 } }] })
        : (assertEquals(obs.length, 1), plano({ motivo: "", acao: "responder", chamadas: [] }));
    },
    ferramentas: new Map([["lista", f]]),
    ctx,
  });
  assertEquals(r.observacoes, [{ ferramenta: "lista", args: { n: 2 }, resultado: { total: 2, linhas: [1, 2] } }]);
  assertEquals(r.passos, 2);
  assertEquals(r.uso.chamadas, 2);
});

Deno.test("investigar: ferramenta inexistente e argumento inválido viram observação de erro", async () => {
  let rodada = 0;
  const f = ferramentaFalsa("lista", async () => ({}));
  const r = await investigar({
    planejar: async () =>
      ++rodada === 1
        ? plano({
            motivo: "",
            acao: "consultar",
            chamadas: [
              { ferramenta: "apagar_tudo", args: {} },
              { ferramenta: "lista", args: { n: "muitos" } },
            ],
          })
        : plano({ motivo: "", acao: "responder", chamadas: [] }),
    ferramentas: new Map([["lista", f]]),
    ctx,
  });
  assertEquals(r.observacoes[0].erro, "ferramenta inexistente");
  assert(r.observacoes[1].erro?.startsWith("argumentos inválidos"));
});

Deno.test("investigar: erro dentro da ferramenta não derruba a conversa", async () => {
  let rodada = 0;
  const f = ferramentaFalsa("lista", async () => {
    throw new Error("falha ao ler recebimentos: permission denied");
  });
  const r = await investigar({
    planejar: async () =>
      ++rodada === 1
        ? plano({ motivo: "", acao: "consultar", chamadas: [{ ferramenta: "lista", args: {} }] })
        : plano({ motivo: "", acao: "responder", chamadas: [] }),
    ferramentas: new Map([["lista", f]]),
    ctx,
  });
  assertEquals(r.observacoes[0].erro, "falha ao ler recebimentos: permission denied");
});

Deno.test("investigar: chamada repetida é ignorada e encerra o laço", async () => {
  let execucoes = 0;
  const f = ferramentaFalsa("lista", async () => {
    execucoes++;
    return { total: 0 };
  });
  const r = await investigar({
    planejar: async () => plano({ motivo: "", acao: "consultar", chamadas: [{ ferramenta: "lista", args: {} }] }),
    ferramentas: new Map([["lista", f]]),
    ctx,
  });
  assertEquals(execucoes, 1);
  assertEquals(r.passos, 2);
});

Deno.test("investigar: teto de rodadas mesmo com planejador que nunca para", async () => {
  let n = 0;
  const f = ferramentaFalsa("lista", async () => ({ total: 0 }));
  const r = await investigar({
    planejar: async () =>
      plano({ motivo: "", acao: "consultar", chamadas: [{ ferramenta: "lista", args: { n: ++n } }] }),
    ferramentas: new Map([["lista", f]]),
    ctx,
  });
  assertEquals(r.passos, MAX_PASSOS);
  assertEquals(r.observacoes.length, MAX_PASSOS);
});

Deno.test("investigar: avisa cada observação ao chamador (rastro em agent_actions)", async () => {
  const vistas: Observacao[] = [];
  const f = ferramentaFalsa("lista", async () => ({ total: 1 }));
  let rodada = 0;
  await investigar({
    planejar: async () =>
      ++rodada === 1
        ? plano({ motivo: "", acao: "consultar", chamadas: [{ ferramenta: "lista", args: {} }] })
        : plano({ motivo: "", acao: "responder", chamadas: [] }),
    ferramentas: new Map([["lista", f]]),
    ctx,
    aoObservar: async (o) => void vistas.push(o),
  });
  assertEquals(vistas.length, 1);
});

Deno.test("catálogo: toda ferramenta tem nome único, descrição e aparece no prompt do planejador", () => {
  assertEquals(new Set(FERRAMENTAS.map((f) => f.nome)).size, FERRAMENTAS.length);
  assertEquals(FERRAMENTA_POR_NOME.size, FERRAMENTAS.length);
  const prompt = promptPlanejador(FERRAMENTAS);
  for (const f of FERRAMENTAS) {
    assert(f.descricao.length > 20, f.nome);
    assert(prompt.includes(f.nome), f.nome);
  }
});

Deno.test("instrucaoDeResposta: sem consulta diz que não foi necessária; com consulta carrega o JSON", () => {
  assert(instrucaoDeResposta([], "").includes("Nenhuma consulta foi necessária"));
  const txt = instrucaoDeResposta([{ ferramenta: "lista", args: {}, resultado: { total: 3 } }], "");
  assert(txt.includes('"total":3'));
});
