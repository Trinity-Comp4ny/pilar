import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lembreteVencido, parcelaEmAberto, podeEnviarLembrete } from "./regras.ts";

Deno.test("admin, financeiro e operacional enviam lembrete", () => {
  for (const role of ["admin", "financeiro", "operacional"]) assertEquals(podeEnviarLembrete(role), true, role);
});

Deno.test("outros papéis, papel vazio ou ausente não enviam", () => {
  for (const role of ["colaborador", "coordenador", "user", "ultra_admin", "Admin", "", null, undefined]) {
    assertEquals(podeEnviarLembrete(role), false, String(role));
  }
});

Deno.test("vencida: parcela em aberto com vencimento antes de hoje", () => {
  assertEquals(lembreteVencido("2026-11-06", "Pendente", "2026-11-07"), true);
  assertEquals(lembreteVencido("2026-10-01", "Atrasado", "2026-11-07"), true);
});

Deno.test("não vencida: vence hoje ou depois", () => {
  assertEquals(lembreteVencido("2026-11-07", "Pendente", "2026-11-07"), false);
  assertEquals(lembreteVencido("2026-12-01", "Pendente", "2026-11-07"), false);
});

Deno.test("parcela já recebida ou cancelada nunca é tratada como atraso", () => {
  assertEquals(lembreteVencido("2026-10-01", "Recebido", "2026-11-07"), false);
  assertEquals(lembreteVencido("2026-10-01", "Cancelado", "2026-11-07"), false);
});

Deno.test("só parcela pendente ou atrasada recebe lembrete", () => {
  assertEquals(parcelaEmAberto("Pendente"), true);
  assertEquals(parcelaEmAberto("Atrasado"), true);
  assertEquals(parcelaEmAberto("Pago"), false);
  assertEquals(parcelaEmAberto("Recebido"), false);
  assertEquals(parcelaEmAberto("Cancelado"), false);
  assertEquals(parcelaEmAberto(""), false);
});
