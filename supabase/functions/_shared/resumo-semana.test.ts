import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  limparResumo,
  MAX_REGISTROS_NO_RESUMO,
  MAX_TEXTO_REGISTRO,
  mensagemResumoSemana,
  montarFonte,
  type RegistroLiberado,
  resumoSchema,
} from "./resumo-semana.ts";

const reg = (id: string, data: string, org: string | null, bruto: string | null = null): RegistroLiberado => ({
  id,
  data_registro: data,
  texto_organizado: org,
  texto_bruto: bruto,
});

Deno.test("a fonte tem só data e texto, em ordem de data", async () => {
  const f = await montarFonte([
    reg("b", "2026-10-20", "Laje concretada."),
    reg("a", "2026-10-19", "Fiação concluída."),
  ]);
  assertEquals(f.itens, [
    { data: "2026-10-19", texto: "Fiação concluída." },
    { data: "2026-10-20", texto: "Laje concretada." },
  ]);
  assertEquals(mensagemResumoSemana(f), "2026-10-19: Fiação concluída.\n2026-10-20: Laje concretada.");
});

Deno.test("usa o texto organizado e cai no bruto; registro sem texto fica de fora", async () => {
  const f = await montarFonte([
    reg("a", "2026-10-19", null, "texto bruto"),
    reg("b", "2026-10-19", "  ", null),
    reg("c", "2026-10-19", null, null),
  ]);
  assertEquals(f.itens, [{ data: "2026-10-19", texto: "texto bruto" }]);
});

Deno.test("o hash muda quando o texto muda e não muda com a mesma fonte", async () => {
  const base = [reg("a", "2026-10-19", "Fiação concluída.")];
  const h1 = (await montarFonte(base)).hash;
  const h2 = (await montarFonte(base)).hash;
  const h3 = (await montarFonte([reg("a", "2026-10-19", "Fiação concluída e testada.")])).hash;
  const h4 = (await montarFonte([...base, reg("b", "2026-10-20", "Laje.")])).hash;
  assertEquals(h1, h2);
  assertNotEquals(h1, h3);
  assertNotEquals(h1, h4);
});

Deno.test("o hash não depende da ordem em que os registros chegam", async () => {
  const a = reg("a", "2026-10-19", "Um.");
  const b = reg("b", "2026-10-19", "Dois.");
  assertEquals((await montarFonte([a, b])).hash, (await montarFonte([b, a])).hash);
});

Deno.test("limita o tamanho do texto e a quantidade de registros (os mais recentes ficam)", async () => {
  const longo = await montarFonte([reg("a", "2026-10-19", "x".repeat(MAX_TEXTO_REGISTRO + 100))]);
  assertEquals(longo.itens[0].texto.length, MAX_TEXTO_REGISTRO);
  const muitos = await montarFonte(
    Array.from({ length: MAX_REGISTROS_NO_RESUMO + 5 }, (_, i) =>
      reg(`r${String(i).padStart(3, "0")}`, `2026-10-${String(10 + (i % 10)).padStart(2, "0")}`, `Texto ${i}`)
    )
  );
  assertEquals(muitos.itens.length, MAX_REGISTROS_NO_RESUMO);
});

Deno.test("o que vai ao modelo é só data e texto liberado", async () => {
  const f = await montarFonte([
    {
      id: "a",
      data_registro: "2026-10-19",
      texto_organizado: "Laje concretada.",
      texto_bruto: null,
      // campos internos que nunca devem aparecer, mesmo se alguém passar objeto maior
      ...({ extraido: { pendencias: ["segredo interno"] }, autor_nome: "Zé" } as Record<string, unknown>),
    } as RegistroLiberado,
  ]);
  const msg = mensagemResumoSemana(f);
  assert(!msg.includes("segredo interno"));
  assert(!msg.includes("Zé"));
});

Deno.test("limparResumo tira travessão e espaço sobrando", () => {
  assertEquals(limparResumo("A laje — concretada.  Cura amanhã."), "A laje, concretada. Cura amanhã.");
});

Deno.test("o schema recusa resumo vazio ou grande demais", () => {
  assertEquals(resumoSchema.safeParse({ resumo: "  " }).success, false);
  assertEquals(resumoSchema.safeParse({ resumo: "x".repeat(601) }).success, false);
  assertEquals(resumoSchema.safeParse({ resumo: "Laje concretada." }).success, true);
});
