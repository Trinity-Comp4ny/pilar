import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { Interpretacao } from "../esquema.ts";
import { itensPermitidos, IDS_DA_IA } from "../catalogo.ts";
import { adicionaisDasMigrations } from "./adicionais-das-migrations.ts";
import { contaDeFalha, contarCaso, LIMITES, resumir, type ResultadoCaso } from "./avaliar.ts";
import { CASOS } from "./casos.ts";

const vazia: Interpretacao = {
  itens: [],
  ambientes: {},
  marcenaria: null,
  relevo: null,
  fora_do_catalogo: [],
  perguntas: [],
};

const com = (parcial: Partial<Interpretacao>): Interpretacao => ({ ...vazia, ...parcial });

Deno.test("caso: tudo certo não tem erro", () => {
  const c = contarCaso(
    { itens: { ac12: 6 }, marcenaria: "completa" },
    com({ itens: [{ id: "ac12", quantidade: 6, trecho: "" }], marcenaria: "completa" })
  );
  assertEquals(c.erros, []);
  assertEquals([c.itensCertos, c.quantidadesCertas, c.camposCertos, c.camposConferidos], [1, 1, 1, 1]);
});

Deno.test("caso: item a mais, item faltando e quantidade errada são contados à parte", () => {
  const c = contarCaso(
    { itens: { ac12: 6, fv: 10 } },
    com({
      itens: [
        { id: "ac12", quantidade: 5, trecho: "" },
        { id: "elevador", quantidade: 1, trecho: "" },
      ],
    })
  );
  assertEquals([c.itensCertos, c.itensFaltando, c.itensDemais, c.quantidadesCertas], [1, 1, 1, 0]);
  assertEquals(c.erros.length, 3);
});

Deno.test("caso: relevo e muro de arrimo conferem com a medida ou com nulo", () => {
  const sem = contarCaso(
    { itens: {}, relevo: { inclinado: true } },
    com({ relevo: { inclinado: true, arrimo_m2: null } })
  );
  assertEquals([sem.camposCertos, sem.camposConferidos], [2, 2]);
  const errado = contarCaso(
    { itens: {}, relevo: { inclinado: true, arrimo_m2: 60 } },
    com({ relevo: { inclinado: true, arrimo_m2: 30 } })
  );
  assertEquals([errado.camposCertos, errado.camposConferidos], [1, 2]);
  const nenhum = contarCaso({ itens: {}, relevo: null }, com({ relevo: { inclinado: true, arrimo_m2: null } }));
  assertEquals(nenhum.camposCertos, 0);
});

Deno.test("caso: fora do catálogo e perguntas pedem um mínimo", () => {
  const c = contarCaso(
    { itens: {}, foraDoCatalogo: 2, perguntas: 1 },
    com({ fora_do_catalogo: [{ texto: "spa", motivo: null }], perguntas: [{ id: null, pergunta: "?" }] })
  );
  assertEquals([c.foraOk, c.perguntasOk], [false, true]);
});

Deno.test("falha da chamada: tudo que era esperado conta como errado", () => {
  const c = contaDeFalha(
    { itens: { ac12: 1, fv: 2 }, marcenaria: null, relevo: { inclinado: true }, perguntas: 1 },
    "timeout"
  );
  assertEquals([c.itensFaltando, c.camposConferidos, c.camposCertos, c.perguntasOk], [2, 3, 0, false]);
});

const resultado = (parcial: Partial<ResultadoCaso>): ResultadoCaso => ({
  id: "x",
  categoria: "simples",
  falhou: false,
  latenciaMs: 1000,
  tokensEntrada: 2000,
  tokensSaida: 100,
  itensCertos: 0,
  itensDemais: 0,
  itensFaltando: 0,
  quantidadesCertas: 0,
  camposConferidos: 0,
  camposCertos: 0,
  foraOk: null,
  perguntasOk: null,
  erros: [],
  ...parcial,
});

Deno.test("resumo: aprova dentro dos limites e reprova item inventado em excesso", () => {
  const bom = Array.from({ length: 20 }, () => resultado({ itensCertos: 3, quantidadesCertas: 3 }));
  assertEquals(resumir(bom).aprovado, true);
  const inventa = Array.from({ length: 20 }, () => resultado({ itensCertos: 3, quantidadesCertas: 3, itensDemais: 1 }));
  const r = resumir(inventa);
  assertEquals(r.aprovado, false);
  assertEquals(r.itensDemais, 20);
});

Deno.test("resumo: quantidade errada reprova mesmo com o item certo", () => {
  const rs = Array.from({ length: 10 }, (_, i) => resultado({ itensCertos: 1, quantidadesCertas: i < 5 ? 1 : 0 }));
  const r = resumir(rs, LIMITES);
  assertEquals(r.item, 1);
  assertEquals(r.quantidade, 0.5);
  assertEquals(r.aprovado, false);
});

Deno.test("resumo: p95 de latência e de tokens", () => {
  const rs = Array.from({ length: 20 }, (_, i) =>
    resultado({ latenciaMs: (i + 1) * 100, tokensEntrada: (i + 1) * 100 })
  );
  const r = resumir(rs);
  assertEquals(r.latenciaP95Ms, 2000);
  assertEquals(r.tokensP95, 2100);
});

Deno.test("casos: ids únicos, itens do catálogo da IA e quantidades positivas", () => {
  assertEquals(new Set(CASOS.map((c) => c.id)).size, CASOS.length);
  for (const c of CASOS) {
    for (const [id, q] of Object.entries(c.esperado.itens)) {
      assertEquals((IDS_DA_IA as readonly string[]).includes(id), true, `${c.id}: ${id}`);
      assertEquals((q as number) > 0, true);
    }
    assertEquals(c.descricao.length <= 2000, true);
  }
});

Deno.test("casos: cobrem as seis categorias e a suíte tem entre 30 e 50 casos", () => {
  const categorias = new Set(CASOS.map((c) => c.categoria));
  assertEquals(categorias.size, 6);
  assertEquals(CASOS.length >= 30 && CASOS.length <= 50, true);
});

Deno.test("catálogo das migrations: todos os itens da IA existem nos parâmetros", async () => {
  const adicionais = await adicionaisDasMigrations(Deno.cwd().includes("/evals") ? "../../../.." : ".");
  assertEquals(
    itensPermitidos(adicionais).map((i) => i.id),
    [...IDS_DA_IA]
  );
});
