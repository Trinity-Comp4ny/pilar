import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerPeriodo } from "./entrada.ts";

const p = (q: string) => new URLSearchParams(q);

Deno.test("período: desde obrigatório, ate padrão é hoje", () => {
  assertEquals(lerPeriodo(p("desde=2026-10-01"), "2026-10-16"), { ok: true, desde: "2026-10-01", ate: "2026-10-16" });
  assertEquals(lerPeriodo(p(""), "2026-10-16").ok, false);
});

Deno.test("período: recusa data inválida, invertida e janela grande", () => {
  assertEquals(lerPeriodo(p("desde=2026-02-30"), "2026-10-16").ok, false);
  assertEquals(lerPeriodo(p("desde=2026-10-10&ate=2026-10-01"), "2026-10-16").ok, false);
  assertEquals(lerPeriodo(p("desde=2026-01-01&ate=2026-10-16"), "2026-10-16").ok, false);
  assertEquals(lerPeriodo(p("desde=2026-06-18&ate=2026-10-16"), "2026-10-16").ok, true);
});
