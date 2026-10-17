import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { escolherCidade, lerCepGeo, lerEndereco } from "./endereco.ts";

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

Deno.test("lerCepGeo usa a coordenada do BrasilAPI quando existe (vem como texto)", () => {
  const r = lerCepGeo({
    city: "Caetité",
    state: "BA",
    location: { coordinates: { latitude: "-14.06944", longitude: "-42.475" } },
  });
  assertEquals(r?.coordenadas, { lat: "-14.06944", lon: "-42.475", display_name: "Caetité, BA" });
});

Deno.test("lerCepGeo sem coordenada devolve só cidade e UF para o fallback do Open-Meteo", () => {
  const r = lerCepGeo({ city: "Marília", state: "SP", location: { coordinates: {} } });
  assertEquals(r, { coordenadas: null, city: "Marília", state: "SP" });
});

Deno.test("lerCepGeo recusa resposta fora do formato", () => {
  assertEquals(lerCepGeo(null), null);
  assertEquals(lerCepGeo("erro"), null);
  assertEquals(lerCepGeo({ location: {} }), null);
  assertEquals(
    lerCepGeo({ city: "X", location: { coordinates: { latitude: "abc", longitude: "1" } } })?.coordenadas,
    null
  );
});
