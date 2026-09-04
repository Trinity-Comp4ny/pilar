// Roda com: deno test --no-check --allow-env supabase/functions/notificacoes-email-cron
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.env.set("EMAIL_DRY_RUN", "true");
const { agruparPorPessoa, chaveIdempotencia, urlDoItem } = await import("./agrupar.ts");
const { MAX_ITENS_EMAIL } = await import("../_shared/email/index.ts");

const linha = (dest: string, id: string, extra: Partial<Parameters<typeof agruparPorPessoa>[0][number]> = {}) => ({
  destinatario_id: dest,
  email: `${dest}@x.com`,
  nome: dest,
  empresa_id: "e1",
  notificacao_id: id,
  categoria: "financeiro",
  severidade: "high",
  titulo: `t-${id}`,
  mensagem: null,
  link: "/financeiro",
  created_at: "2026-09-04T10:00:00Z",
  ...extra,
});
const opts = { appUrl: "https://app.test", sinoUrl: "https://app.test/inicio", maxPessoas: 200 };

Deno.test("urlDoItem: relativo vira APP_URL+link, absoluto passa, nulo cai no sino", () => {
  assertEquals(urlDoItem("/projetos/1", "https://app.test/", "https://app.test/inicio"), "https://app.test/projetos/1");
  assertEquals(urlDoItem("projetos/1", "https://app.test", "s"), "https://app.test/projetos/1");
  assertEquals(urlDoItem("https://outro/x", "https://app.test", "s"), "https://outro/x");
  assertEquals(urlDoItem(null, "https://app.test", "https://app.test/inicio"), "https://app.test/inicio");
});

Deno.test("agrupa por destinatário preservando ordem e guarda todos os ids", () => {
  const lotes = agruparPorPessoa([linha("a", "1"), linha("b", "2"), linha("a", "3")], opts);
  assertEquals(
    lotes.map((l) => l.destinatarioId),
    ["a", "b"]
  );
  assertEquals(lotes[0].notificacaoIds, ["1", "3"]);
  assertEquals(
    lotes[0].itens.map((i) => i.titulo),
    ["t-1", "t-3"]
  );
  assertEquals(lotes[0].itens[0].url, "https://app.test/financeiro");
});

Deno.test("acima de MAX_ITENS_EMAIL conta como oculto, mas o id ainda é marcado", () => {
  const linhas = Array.from({ length: MAX_ITENS_EMAIL + 5 }, (_, i) => linha("a", String(i)));
  const [lote] = agruparPorPessoa(linhas, opts);
  assertEquals(lote.itens.length, MAX_ITENS_EMAIL);
  assertEquals(lote.totalOculto, 5);
  assertEquals(lote.notificacaoIds.length, MAX_ITENS_EMAIL + 5);
});

Deno.test("maxPessoas corta por pessoa inteira, nunca no meio dos itens de alguém", () => {
  const linhas = [linha("a", "1"), linha("b", "2"), linha("c", "3"), linha("a", "4"), linha("c", "5")];
  const lotes = agruparPorPessoa(linhas, { ...opts, maxPessoas: 2 });
  assertEquals(
    lotes.map((l) => l.destinatarioId),
    ["a", "b"]
  );
  assertEquals(lotes[0].notificacaoIds, ["1", "4"], "itens da pessoa que entrou vêm inteiros");
});

Deno.test("chave de idempotência é estável para o mesmo conjunto de ids, em qualquer ordem", async () => {
  const [l1] = agruparPorPessoa([linha("a", "1"), linha("a", "2")], opts);
  const [l2] = agruparPorPessoa([linha("a", "2"), linha("a", "1")], opts);
  const [l3] = agruparPorPessoa([linha("a", "1"), linha("a", "3")], opts);
  assertEquals(await chaveIdempotencia("imediato", l1), await chaveIdempotencia("imediato", l2));
  assert((await chaveIdempotencia("imediato", l1)) !== (await chaveIdempotencia("imediato", l3)));
  assert((await chaveIdempotencia("imediato", l1)) !== (await chaveIdempotencia("semanal", l1)));
  assert((await chaveIdempotencia("imediato", l1)).startsWith("notif-imediato-a-"));
});
