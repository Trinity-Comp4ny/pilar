import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  avaliarSinal,
  COMPONENTES,
  type CheckStatus,
  type Componente,
  montarResposta,
  pior,
} from "../_shared/healthcheck.ts";

// Regra de saúde por componente (SPEC 105) e o HTTP que os monitores da status page leem.

const agora = Date.parse("2026-10-09T12:00:00Z");
const ha = (min: number) => new Date(agora - min * 60_000).toISOString();

Deno.test("avaliarSinal: sem dado não pesa (pg_cron ausente ou RPC fora)", () => {
  assertEquals(avaliarSinal(undefined, 3), "skipped");
  assertEquals(avaliarSinal({ ok: 0, falhas: 0, disponivel: false }, 1), "skipped");
});

Deno.test("avaliarSinal: nenhuma falha é ok, mesmo sem volume", () => {
  assertEquals(avaliarSinal({ ok: 0, falhas: 0 }, 3), "ok");
});

Deno.test("avaliarSinal: falha isolada com sucesso depois já se recuperou", () => {
  assertEquals(avaliarSinal({ ok: 5, falhas: 1, ultima_falha: ha(30), ultimo_ok: ha(5) }, 3), "ok");
});

Deno.test("avaliarSinal: falha mais recente que o último sucesso é degradado", () => {
  assertEquals(avaliarSinal({ ok: 5, falhas: 1, ultima_falha: ha(2), ultimo_ok: ha(20) }, 3), "degraded");
});

Deno.test("avaliarSinal: só falha na janela é degradado", () => {
  assertEquals(avaliarSinal({ ok: 0, falhas: 1, ultima_falha: ha(2), ultimo_ok: null }, 3), "degraded");
});

Deno.test("avaliarSinal: chegar no limite degrada mesmo com sucesso depois", () => {
  assertEquals(avaliarSinal({ ok: 9, falhas: 3, ultima_falha: ha(40), ultimo_ok: ha(1) }, 3), "degraded");
  assertEquals(avaliarSinal({ ok: 9, falhas: 1, ultima_falha: ha(40), ultimo_ok: ha(1) }, 1), "degraded");
});

Deno.test("avaliarSinal: crons sem nenhuma execução em 24 h é o agendador parado", () => {
  assertEquals(avaliarSinal({ ok: 0, falhas: 0, disponivel: true }, 1, { exigeAtividade: true }), "degraded");
  assertEquals(avaliarSinal({ ok: 12, falhas: 0, disponivel: true }, 1, { exigeAtividade: true }), "ok");
  // Sem pg_cron (banco local, CI): não dá para afirmar nada.
  assertEquals(avaliarSinal({ ok: 0, falhas: 0, disponivel: false }, 1, { exigeAtividade: true }), "skipped");
});

Deno.test("pior: down vence degraded, que vence ok; skipped só sozinho", () => {
  assertEquals(pior("ok", "degraded"), "degraded");
  assertEquals(pior("degraded", "down", "ok"), "down");
  assertEquals(pior("skipped", "ok"), "ok");
  assertEquals(pior(undefined, "skipped"), "skipped");
});

const tudoOk = (): Record<Componente, CheckStatus> =>
  Object.fromEntries(COMPONENTES.map((c) => [c, "ok"])) as Record<Componente, CheckStatus>;

Deno.test("montarResposta: tudo ok é 200 ok", () => {
  assertEquals(montarResposta(tudoOk(), null), { http: 200, status: "ok" });
});

Deno.test("montarResposta: componente não crítico degradado deixa o geral 200 degraded", () => {
  const c = { ...tudoOk(), emails: "degraded" as CheckStatus };
  assertEquals(montarResposta(c, null), { http: 200, status: "degraded" });
});

Deno.test("montarResposta: banco ou autenticação fora é 503 down", () => {
  assertEquals(montarResposta({ ...tudoOk(), banco: "down" }, null), { http: 503, status: "down" });
  assertEquals(montarResposta({ ...tudoOk(), autenticacao: "down" }, null), { http: 503, status: "down" });
});

Deno.test("montarResposta: ?componente responde 503 só pelo componente pedido", () => {
  const c = { ...tudoOk(), pagamentos: "degraded" as CheckStatus };
  assertEquals(montarResposta(c, "pagamentos").http, 503);
  assertEquals(montarResposta(c, "emails").http, 200);
});

Deno.test("montarResposta: ?componente sem dado (skipped) não derruba o monitor", () => {
  assertEquals(montarResposta({ ...tudoOk(), crons: "skipped" }, "crons").http, 200);
});

Deno.test("montarResposta: componente desconhecido é 400 com a lista", () => {
  const r = montarResposta(tudoOk(), "pagamento");
  assertEquals(r.http, 400);
  assertEquals(r.erro?.includes("pagamentos"), true);
});
