import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { diasEntre, FERRAMENTA_POR_NOME, hojeBR, LIMITE_LINHAS, somarDias } from "./ferramentas.ts";

Deno.test("hojeBR: às 22h de Brasília ainda é o mesmo dia (UTC já virou)", () => {
  assertEquals(hojeBR(new Date("2026-10-31T01:30:00Z")), "2026-10-30");
  assertEquals(hojeBR(new Date("2026-10-30T12:00:00Z")), "2026-10-30");
});

Deno.test("somarDias e diasEntre: viram mês e ano, e negativo é passado", () => {
  assertEquals(somarDias("2026-10-30", 7), "2026-11-06");
  assertEquals(somarDias("2026-12-30", 3), "2027-01-02");
  assertEquals(diasEntre("2026-10-30", "2026-11-06"), 7);
  assertEquals(diasEntre("2026-10-30", "2026-10-25"), -5);
});

Deno.test("argumentos: padrões e limites vêm do schema", () => {
  const rec = FERRAMENTA_POR_NOME.get("listar_recebimentos")!;
  assertEquals(rec.args.parse({ situacao: "a_vencer" }), { situacao: "a_vencer", dias: 7 });
  assertEquals(rec.args.safeParse({ situacao: "a_vencer", dias: 400 }).success, false);
  assertEquals(rec.args.safeParse({ situacao: "tudo" }).success, false);
  assertEquals(rec.args.safeParse({ situacao: "atrasados", projeto: "x" }).success, false, "busca com 1 letra");
});

Deno.test("listar_pendencias: sem argumento obrigatório", () => {
  const f = FERRAMENTA_POR_NOME.get("listar_pendencias")!;
  assertEquals(f.args.parse({}), { somente_urgentes: false });
  assertEquals(f.args.safeParse({ area: "rh" }).success, false);
});

Deno.test("limite de linhas fica pequeno o bastante para caber no contexto", () => {
  assert(LIMITE_LINHAS <= 30);
});

Deno.test("o chat não lê coluna de dinheiro das tabelas base (SELECT revogado, ADR 0034)", async () => {
  const arquivos = ["coleta.ts", "ferramentas.ts", "index.ts"];
  for (const nome of arquivos) {
    const src = await Deno.readTextFile(new URL(`./${nome}`, import.meta.url));
    const consultas = src.match(/\.from\("projetos"\)[\s\S]{0,300}?\)/g) ?? [];
    for (const c of consultas) assert(!/valor_contrato|custo_indireto_pct/.test(c), `${nome}: ${c.slice(0, 80)}`);
    const leads = src.match(/\.from\("leads"\)[\s\S]{0,300}?\)/g) ?? [];
    for (const c of leads) assert(!/valor_estimado/.test(c), `${nome}: leads.valor_estimado`);
  }
});
