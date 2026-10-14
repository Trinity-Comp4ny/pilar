import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

Deno.test("aceita as ações sem corpo extra", () => {
  for (const action of ["get", "remover", "testar"]) {
    assertEquals(lerEntrada({ action }).ok, true, action);
  }
});

Deno.test("save exige ambiente conhecido e apara a chave", () => {
  const r = lerEntrada({ action: "save", ambiente: "producao", api_key: "  $aact_abc  " });
  assertEquals(r.ok && r.data, { action: "save", ambiente: "producao", api_key: "$aact_abc" });

  const semAmbiente = lerEntrada({ action: "save", api_key: "x" });
  assertEquals(semAmbiente.ok, false);
  assertEquals(!semAmbiente.ok && semAmbiente.error, "ambiente: Ambiente inválido");
});

Deno.test("save sem chave é válido (troca só o ambiente)", () => {
  assertEquals(lerEntrada({ action: "save", ambiente: "sandbox" }).ok, true);
});

Deno.test("recusa ação desconhecida, corpo vazio e chave gigante", () => {
  assertEquals(lerEntrada({ action: "apagar_tudo" }).ok, false);
  assertEquals(lerEntrada(null).ok, false);
  assertEquals(lerEntrada({ action: "save", ambiente: "sandbox", api_key: "x".repeat(600) }).ok, false);
});
