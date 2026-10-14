import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { escolherCidade, lerEndereco } from "./endereco.ts";

const santaMaria = [
  { name: "Santa Maria", latitude: -29.68, longitude: -53.8, admin1: "Rio Grande do Sul" },
  { name: "Santa Maria", latitude: -15.9, longitude: -48.0, admin1: "Distrito Federal" },
];

Deno.test("escolhe a cidade homônima do estado informado (UF ou nome)", () => {
  assertEquals(escolherCidade(santaMaria, "DF")?.lat, "-15.9");
  assertEquals(escolherCidade(santaMaria, "rio grande do sul")?.lat, "-29.68");
});

Deno.test("sem estado, ou estado sem resultado, fica com a primeira com coordenada", () => {
  assertEquals(escolherCidade([{ name: "X" }, ...santaMaria])?.lat, "-29.68");
  assertEquals(escolherCidade(santaMaria, "AM")?.display_name, "Santa Maria, Rio Grande do Sul");
  assertEquals(escolherCidade([]), null);
});

Deno.test("endereço: precisa de ao menos um campo, só texto e curto", () => {
  assertEquals(lerEndereco({}), { ok: false, error: "Endereço é obrigatório" });
  assertEquals(lerEndereco({ city: "   " }), { ok: false, error: "Endereço é obrigatório" });
  assertEquals(lerEndereco({ address: "x".repeat(301) }), { ok: false, error: "Endereço longo demais" });
  const r = lerEndereco({ city: " Marília ", state: "SP", postalcode: 17500000 });
  assertEquals(r.ok && r.data, { city: "Marília", state: "SP", hasStructured: true });
});
