import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada, MAX_IDS, PARTIDAS } from "./entrada.ts";

const A = "0b8e6a52-6f6c-4d6e-9a53-2b1f0c9d7e11";
const B = "1c9f7b63-7a7d-4e7f-8b64-3c2a1d0e8f22";

Deno.test("aceita ids únicos em minúsculas e o alvo", () => {
  assertEquals(lerEntrada({ ids: [A, A.toUpperCase(), B], alvo: "planejado" }), {
    ok: true,
    ids: [A, B],
    alvo: "planejado",
  });
});

Deno.test("recusa alvo fora da lista, ids vazios e id que não é uuid", () => {
  assertEquals(lerEntrada({ ids: [A], alvo: "descartado" }).ok, false);
  assertEquals(lerEntrada({ ids: [], alvo: "resolvido" }).ok, false);
  assertEquals(lerEntrada({ ids: [A, "123"], alvo: "resolvido" }).ok, false);
  assertEquals(lerEntrada(null).ok, false);
});

Deno.test("recusa lista maior que o limite", () => {
  const ids = Array.from({ length: MAX_IDS + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
  assertEquals(lerEntrada({ ids, alvo: "resolvido" }).ok, false);
});

Deno.test("a automação nunca parte de resolvido nem de descartado", () => {
  for (const partidas of Object.values(PARTIDAS)) {
    assertEquals(partidas.includes("resolvido") || partidas.includes("descartado"), false);
  }
});
