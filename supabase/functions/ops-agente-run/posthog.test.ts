import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { configPosthog, indicadoresPosthog, resumoPosthog, usoDoPosthog } from "./posthog.ts";

const CFG = { chave: "k", host: "https://us.posthog.com", projeto: "679166" };

/** fetch falso: responde pela ordem das consultas (totais, telas, erros). */
function falso(respostas: unknown[][][], status = 200) {
  let i = 0;
  const corpos: string[] = [];
  const buscar = ((_url: string, init?: RequestInit) => {
    corpos.push(String(init?.body));
    return Promise.resolve(new Response(JSON.stringify({ results: respostas[i++] ?? [] }), { status }));
  }) as unknown as typeof fetch;
  return { buscar, corpos };
}

Deno.test("posthog: sem chave não há configuração; com chave usa os padrões da Pilar", () => {
  assertEquals(
    configPosthog(() => undefined),
    null
  );
  assertEquals(configPosthog((k) => (k === "POSTHOG_PERSONAL_API_KEY" ? " k " : undefined)), CFG);
});

Deno.test("posthog: uso agrega logins, telas e erros", async () => {
  const { buscar, corpos } = falso([[[12, 3, 5, 4]], [["projetos", 40], ["obras", 9]], [["disciplina:criar", 3]]]);
  const u = await usoDoPosthog(CFG, buscar);
  assertEquals(u.logins_7d, 12);
  assertEquals(u.escritorios_logaram_7d, 3);
  assertEquals(u.pessoas_logaram_7d, 5);
  assertEquals(u.erros_exibidos_28d, 4);
  assertEquals(u.telas, [{ modulo: "projetos", vezes: 40 }, { modulo: "obras", vezes: 9 }]);
  assertEquals(u.erros, [{ contexto: "disciplina:criar", vezes: 3 }]);
  assertEquals(corpos.length, 3);
});

Deno.test("posthog: indicadores levam a janela no nome", async () => {
  const { buscar } = falso([[[1, 1, 1, 0]], [["projetos", 7]], []]);
  const i = indicadoresPosthog(await usoDoPosthog(CFG, buscar));
  assertEquals(i.telas_vistas_28d_projetos, 7);
  assertEquals(i.logins_7d, 1);
});

Deno.test("posthog: chave recusada e resposta fora do contrato viram erro claro", async () => {
  await assertRejects(() => usoDoPosthog(CFG, falso([], 403).buscar), Error, "recusou a chave");
  const torta = (() => Promise.resolve(new Response(JSON.stringify({ x: 1 })))) as unknown as typeof fetch;
  await assertRejects(() => usoDoPosthog(CFG, torta), Error, "fora do contrato");
});

Deno.test("posthog: resumo diz o que falta e que o número é de quem aceitou", () => {
  assertEquals(resumoPosthog(null).startsWith("PostHog fora desta rodada"), true);
  const vazio = { logins_7d: 0, escritorios_logaram_7d: 0, pessoas_logaram_7d: 0, erros_exibidos_28d: 0, telas: [], erros: [] };
  assertEquals(resumoPosthog(vazio).includes("ninguém aceitou"), true);
  const uso = { ...vazio, logins_7d: 4, pessoas_logaram_7d: 2, escritorios_logaram_7d: 1, telas: [{ modulo: "obras", vezes: 9 }], erros: [{ contexto: "obra:criar", vezes: 2 }] };
  const r = resumoPosthog(uso);
  assertEquals(r.includes("só quem aceitou"), true);
  assertEquals(r.includes("2 pessoas de 1 escritório"), true);
  assertEquals(r.includes("obra:criar (2)"), true);
});
