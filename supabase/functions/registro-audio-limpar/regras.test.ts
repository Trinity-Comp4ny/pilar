import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { type Deps, type ItemApagar, limparAudios, MAX_LOTES, TAMANHO_LOTE } from "./regras.ts";

const item = (n: number, registro = true): ItemApagar => ({
  path: `e/o/${n}.webm`,
  registro_id: registro ? `r${n}` : null,
  motivo: registro ? "vencido" : "orfao",
});

function depsCom(fila: ItemApagar[][], extra: Partial<Deps> = {}) {
  const chamadas = { removidos: [] as string[][], marcados: [] as string[][] };
  const deps: Deps = {
    listar: () => Promise.resolve(fila.shift() ?? []),
    remover: (paths) => {
      chamadas.removidos.push(paths);
      return Promise.resolve({ erro: null });
    },
    marcarApagados: (ids) => {
      chamadas.marcados.push(ids);
      return Promise.resolve({ erro: null });
    },
    ...extra,
  };
  return { deps, chamadas };
}

Deno.test("lista vazia não chama Storage nem banco", async () => {
  const { deps, chamadas } = depsCom([]);
  const r = await limparAudios(deps);
  assertEquals(r, { apagados: 0, registrosMarcados: 0, lotes: 0, erro: null });
  assertEquals(chamadas.removidos.length, 0);
});

Deno.test("apaga do Storage e marca só os registros, órfão não tem registro", async () => {
  const { deps, chamadas } = depsCom([[item(1), item(2, false), item(3)]]);
  const r = await limparAudios(deps);
  assertEquals(r.apagados, 3);
  assertEquals(r.registrosMarcados, 2);
  assertEquals(chamadas.removidos[0], ["e/o/1.webm", "e/o/2.webm", "e/o/3.webm"]);
  assertEquals(chamadas.marcados[0], ["r1", "r3"]);
});

Deno.test("só órfãos: não chama marcarApagados", async () => {
  const { deps, chamadas } = depsCom([[item(1, false)]]);
  await limparAudios(deps);
  assertEquals(chamadas.marcados.length, 0);
});

Deno.test("erro do Storage para o lote e não marca registro", async () => {
  const { deps, chamadas } = depsCom([[item(1)]], { remover: () => Promise.resolve({ erro: "storage fora" }) });
  const r = await limparAudios(deps);
  assertEquals(r.erro, "storage fora");
  assertEquals(r.registrosMarcados, 0);
  assertEquals(chamadas.marcados.length, 0);
});

Deno.test("erro ao marcar devolve o erro com o que já foi apagado", async () => {
  const { deps } = depsCom([[item(1)]], { marcarApagados: () => Promise.resolve({ erro: "update falhou" }) });
  const r = await limparAudios(deps);
  assertEquals(r.erro, "update falhou");
  assertEquals(r.apagados, 1);
});

Deno.test("lote cheio continua, lote parcial termina", async () => {
  const cheio = Array.from({ length: TAMANHO_LOTE }, (_, i) => item(i));
  const { deps } = depsCom([cheio, [item(9999)]]);
  const r = await limparAudios(deps);
  assertEquals(r.lotes, 2);
  assertEquals(r.apagados, TAMANHO_LOTE + 1);
});

Deno.test("respeita o teto de lotes por execução", async () => {
  const cheio = () => Array.from({ length: TAMANHO_LOTE }, (_, i) => item(i));
  const { deps } = depsCom(Array.from({ length: MAX_LOTES + 3 }, cheio));
  const r = await limparAudios(deps);
  assertEquals(r.lotes, MAX_LOTES);
});
