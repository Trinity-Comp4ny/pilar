import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { configSentry, ERROS_COM_ESCRITORIOS, errosDas24h, resolvidos } from "./sentry.ts";

const CFG = {
  token: "t",
  apiUrl: "https://us.sentry.io",
  org: "bez-company",
  projeto: "pilar",
  ambiente: "staging",
};

function issue(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    shortId: `PILAR-${id}`,
    title: "TypeError: x",
    culprit: "/gestao/financeiro",
    permalink: `https://bez-company.sentry.io/issues/${id}/`,
    count: "4",
    userCount: 3,
    firstSeen: "2026-10-15T08:00:00Z",
    lastSeen: "2026-10-15T12:00:00Z",
    status: "unresolved",
    substatus: "new",
    ...extra,
  };
}

/** fetch falso: responde por trecho do caminho e guarda as URLs pedidas. */
function falso(rotas: Array<[string, unknown, number?]>) {
  const pedidas: URL[] = [];
  const buscar = ((input: URL | Request | string) => {
    const url = new URL(String(input));
    pedidas.push(url);
    const rota = rotas.find(([trecho]) => url.pathname.includes(trecho));
    if (!rota) return Promise.resolve(new Response("não achei", { status: 404 }));
    return Promise.resolve(new Response(JSON.stringify(rota[1]), { status: rota[2] ?? 200 }));
  }) as typeof fetch;
  return { buscar, pedidas };
}

Deno.test("sentry: sem token não há configuração; com token usa os padrões da Pilar", () => {
  assertEquals(
    configSentry(() => undefined),
    null
  );
  assertEquals(
    configSentry((k) => (k === "SENTRY_READ_TOKEN" ? " t " : k === "SENTRY_ENV" ? "staging" : undefined)),
    CFG
  );
});

Deno.test("sentry: erros do ambiente com os escritórios da tag empresa_id", async () => {
  const { buscar, pedidas } = falso([
    ["/tags/empresa_id/values/", [{ value: "e1" }, { value: null }, { value: "e2" }]],
    ["/organizations/bez-company/issues/", [issue("1"), issue("2", { substatus: "regressed", count: 7 })]],
    ["/projects/bez-company/pilar/", { id: "42" }],
  ]);
  const erros = await errosDas24h(CFG, buscar);
  assertEquals(erros.length, 2);
  assertEquals(erros[0].empresas, ["e1", "e2"]);
  assertEquals(erros[0].ocorrencias, 4);
  assertEquals(erros[1].regressao, true);
  const lista = pedidas.find((u) => u.pathname.endsWith("/organizations/bez-company/issues/"))!;
  assertEquals(lista.searchParams.get("project"), "42");
  assertEquals(lista.searchParams.get("environment"), "staging");
  assertEquals(lista.searchParams.get("statsPeriod"), "24h");
});

Deno.test("sentry: erro sem a tag empresa_id (404 do Sentry) fica sem escritórios, não falha", async () => {
  const { buscar } = falso([
    ["/tags/empresa_id/values/", { detail: "Tag not found" }, 404],
    ["/organizations/bez-company/issues/", [issue("1")]],
    ["/projects/bez-company/pilar/", { id: "42" }],
  ]);
  const erros = await errosDas24h(CFG, buscar);
  assertEquals(erros.length, 1);
  assertEquals(erros[0].empresas, []);
});

Deno.test("sentry: só os primeiros erros consultam escritórios (uma chamada por erro)", async () => {
  const muitos = Array.from({ length: ERROS_COM_ESCRITORIOS + 3 }, (_, i) => issue(String(i)));
  const { buscar, pedidas } = falso([
    ["/tags/empresa_id/values/", [{ value: "e1" }]],
    ["/organizations/bez-company/issues/", muitos],
    ["/projects/bez-company/pilar/", { id: "42" }],
  ]);
  const erros = await errosDas24h(CFG, buscar);
  assertEquals(pedidas.filter((u) => u.pathname.includes("/tags/")).length, ERROS_COM_ESCRITORIOS);
  assertEquals(erros.at(-1)!.empresas, []);
});

Deno.test("sentry: token recusado e resposta fora do contrato viram erro claro", async () => {
  await assertRejects(
    () => errosDas24h(CFG, falso([["/projects/", {}, 401]]).buscar),
    Error,
    "Sentry recusou o token (401)"
  );
  await assertRejects(
    () =>
      errosDas24h(
        CFG,
        falso([
          ["/organizations/bez-company/issues/", [{ id: 1 }]],
          ["/projects/bez-company/pilar/", { id: "42" }],
        ]).buscar
      ),
    Error,
    "fora do contrato"
  );
});

Deno.test("sentry: resolvidos devolve só os fechados", async () => {
  const { buscar } = falso([
    ["/issues/1/", { id: "1", status: "resolved" }],
    ["/issues/2/", { id: "2", status: "unresolved" }],
  ]);
  assertEquals([...(await resolvidos(CFG, ["1", "2"], buscar))], ["1"]);
});
