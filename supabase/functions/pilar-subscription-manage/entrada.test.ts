import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

Deno.test("cancel não precisa de mais nada", () => {
  const r = lerEntrada({ action: "cancel" });
  assertEquals(r.ok && r.data, { action: "cancel" });
});

Deno.test("update_plan exige slug e aceita só os ciclos conhecidos", () => {
  const r = lerEntrada({ action: "update_plan", new_plan_slug: "pro", new_cycle: "yearly" });
  assertEquals(r.ok && r.data, { action: "update_plan", new_plan_slug: "pro", new_cycle: "yearly" });

  assertEquals(lerEntrada({ action: "update_plan" }).ok, false);
  assertEquals(lerEntrada({ action: "update_plan", new_plan_slug: "pro", new_cycle: "weekly" }).ok, false);
});

Deno.test("slug com caractere fora do padrão é recusado", () => {
  assertEquals(lerEntrada({ action: "update_plan", new_plan_slug: "pro%' or '1" }).ok, false);
  assertEquals(lerEntrada({ action: "update_plan", new_plan_slug: "" }).ok, false);
});

Deno.test("corpo nulo ou ação desconhecida vira 400, não erro de runtime", () => {
  assertEquals(lerEntrada(null).ok, false);
  assertEquals(lerEntrada({ action: "refund" }).ok, false);
});
