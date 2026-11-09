import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  escolherCidade,
  type GeoResult,
  lerCepGeo,
  lerEndereco,
  type Provedores,
  resolverEndereco,
} from "./endereco.ts";

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

const MARILIA: GeoResult = {
  lat: "-22.21",
  lon: "-49.95",
  display_name: "Marília, São Paulo",
};
const ENDERECO = {
  street: "Rua A 10",
  city: "Marília",
  state: "SP",
  hasStructured: true,
};

function provedores(over: Partial<Provedores> = {}): Provedores {
  return {
    nominatim: () => Promise.resolve(null),
    openMeteoCidade: () => Promise.resolve(null),
    brasilApiCep: () => Promise.resolve(null),
    ...over,
  };
}

const bloqueado = () => Promise.reject(new Error("Nominatim retornou 403"));

Deno.test("cascata: Nominatim bloqueado cai no centro da cidade", async () => {
  const r = await resolverEndereco(
    ENDERECO,
    provedores({
      nominatim: bloqueado,
      openMeteoCidade: () => Promise.resolve(MARILIA),
    })
  );
  assertEquals(r, { found: true, result: MARILIA });
});

Deno.test("cascata: bloqueado e sem cidade nem CEP não é erro, é indisponível", async () => {
  const r = await resolverEndereco({ street: "Rua A 10", hasStructured: true }, provedores({ nominatim: bloqueado }));
  assertEquals(r, { found: false, indisponivel: true });
});

Deno.test("cascata: bloqueado e Open-Meteo sem a cidade ou fora do ar também é indisponível", async () => {
  assertEquals(await resolverEndereco(ENDERECO, provedores({ nominatim: bloqueado })), {
    found: false,
    indisponivel: true,
  });
  const fora = provedores({
    nominatim: bloqueado,
    openMeteoCidade: () => Promise.reject(new Error("Open-Meteo retornou 500")),
  });
  assertEquals(await resolverEndereco(ENDERECO, fora), {
    found: false,
    indisponivel: true,
  });
});

Deno.test("cascata: sem cidade, o CEP dá a cidade para o Open-Meteo", async () => {
  const r = await resolverEndereco(
    { postalcode: "17500-000", hasStructured: true },
    provedores({
      nominatim: bloqueado,
      brasilApiCep: () => Promise.resolve({ coordenadas: null, city: "Marília", state: "SP" }),
      openMeteoCidade: (c, s) => Promise.resolve(c === "Marília" && s === "SP" ? MARILIA : null),
    })
  );
  assertEquals(r, { found: true, result: MARILIA });
});

Deno.test("cascata: ninguém achou, sem falha de provedor, é só não localizado", async () => {
  assertEquals(await resolverEndereco(ENDERECO, provedores()), {
    found: false,
    indisponivel: false,
  });
});

Deno.test("cascata: Nominatim sem endereço tenta só a cidade antes de desistir", async () => {
  const pedidas: string[] = [];
  const r = await resolverEndereco(
    ENDERECO,
    provedores({
      nominatim: (params) => {
        pedidas.push(params.has("street") ? "endereco" : "cidade");
        return Promise.resolve(params.has("street") ? null : MARILIA);
      },
    })
  );
  assertEquals(pedidas, ["endereco", "cidade"]);
  assertEquals(r.found && r.result, MARILIA);
});
