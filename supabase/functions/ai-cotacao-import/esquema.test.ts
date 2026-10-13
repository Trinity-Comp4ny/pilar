import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { CestaSchema, ComparativoSchema, ItemUnicoSchema, lerEntrada, MAX_CONTEXTO_CHARS } from "./esquema.ts";

Deno.test("cesta: array na raiz é embrulhado em itens", () => {
  const r = CestaSchema.safeParse([{ descricao: "Cimento", valor_total: 300 }]);
  assertEquals(r.success && r.data.itens.length, 1);
  assertEquals(r.success && r.data.avisos, []);
});

Deno.test("comparativo: array na raiz vira propostas e confiança tem padrão", () => {
  const r = ComparativoSchema.safeParse([{ fornecedor_nome: "Loja A", valor_a_vista: 100 }]);
  assertEquals(r.success && r.data.propostas[0].confianca, 0.7);
});

Deno.test("valores negativos e loja sem nome são recusados (cotação não pode mentir preço)", () => {
  assertEquals(CestaSchema.safeParse({ itens: [{ descricao: "x", valor_total: -1 }] }).success, false);
  assertEquals(ComparativoSchema.safeParse({ propostas: [{ fornecedor_nome: "", valor_a_vista: 1 }] }).success, false);
  assertEquals(ItemUnicoSchema.safeParse({ valor_total: -5 }).success, false);
});

Deno.test("entrada: modo desconhecido vira auto e contexto é encurtado", () => {
  const r = lerEntrada({
    arquivoBase64: "AAA",
    mimeType: "application/pdf",
    modo: "outro",
    contexto: "Cimento\n\nCP-II " + "x".repeat(900),
  });
  assertEquals(r.ok && r.modoPedido, "auto");
  assertEquals(r.ok && r.contexto.length, MAX_CONTEXTO_CHARS);
  assertEquals(r.ok && r.contexto.startsWith("Cimento CP-II"), true);
});

Deno.test("entrada: arquivo ausente ou de formato não suportado", () => {
  assertEquals(lerEntrada({ mimeType: "application/pdf" }), { ok: false, error: "Nenhum arquivo enviado" });
  assertEquals(lerEntrada({ arquivoBase64: "A", mimeType: "text/html" }), {
    ok: false,
    error: "Formato não suportado. Envie PDF, PNG, JPG ou WebP.",
  });
});
