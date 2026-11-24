import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { consultaTexto, mapearLugares, normalizarTelefone } from "./places.ts";

Deno.test("normalizarTelefone: celular com DDD", () => {
  assertEquals(normalizarTelefone("(11) 99999-0000"), { e164: "5511999990000", tipo: "celular" });
});

Deno.test("normalizarTelefone: fixo internacional", () => {
  assertEquals(normalizarTelefone("+55 14 3433-0000"), { e164: "551434330000", tipo: "fixo" });
});

Deno.test("normalizarTelefone: rejeita curto e vazio", () => {
  assertEquals(normalizarTelefone("3433-0000"), null);
  assertEquals(normalizarTelefone(null), null);
});

Deno.test("mapearLugares: deduplica, descarta fechado e sem nome", () => {
  const r = mapearLugares([
    {
      id: "a",
      displayName: { text: "Estúdio Teste" },
      nationalPhoneNumber: "(11) 99999-0000",
      businessStatus: "OPERATIONAL",
    },
    { id: "a", displayName: { text: "Duplicado" } },
    { id: "b", displayName: { text: "Fechado" }, businessStatus: "CLOSED_PERMANENTLY" },
    { id: "c", displayName: { text: "  " } },
    { id: "d", displayName: { text: "Sem telefone" } },
  ]);
  assertEquals(
    r.map((l) => l.place_id),
    ["a", "d"]
  );
  assertEquals(r[0].tipo_telefone, "celular");
  assertEquals(r[1].tipo_telefone, "sem");
});

Deno.test("consultaTexto: monta a busca", () => {
  assertEquals(consultaTexto("escritório de arquitetura", "Marília", "SP"), "escritório de arquitetura em Marília, SP");
});
