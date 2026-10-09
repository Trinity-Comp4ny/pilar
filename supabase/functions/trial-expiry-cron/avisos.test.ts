import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { JANELAS_DE_AVISO, limitesDaJanela } from "./avisos.ts";

const agora = new Date("2026-10-08T12:00:00.000Z");
const horas = (h: number) => new Date(agora.getTime() + h * 60 * 60 * 1000).toISOString();

function janelasQueDisparam(trialEndsAt: string): number[] {
  return JANELAS_DE_AVISO.filter((j) => {
    const { depoisDe, ateInclusive } = limitesDaJanela(j.days, agora);
    return trialEndsAt > depoisDe && trialEndsAt <= ateInclusive;
  }).map((j) => j.days);
}

Deno.test("não existe aviso de 3 dias", () => {
  assert(!JANELAS_DE_AVISO.some((j) => (j.days as number) === 3));
});

Deno.test("trial de 3 dias recém-criado não recebe aviso nenhum", () => {
  assertEquals(janelasQueDisparam(horas(72)), []);
  assertEquals(janelasQueDisparam(horas(71)), []);
});

Deno.test("trial que vence em 20h recebe só o aviso de 1 dia", () => {
  assertEquals(janelasQueDisparam(horas(20)), [1]);
});

Deno.test("trial que vence em exatamente 24h já recebe o aviso de 1 dia", () => {
  assertEquals(janelasQueDisparam(horas(24)), [1]);
});

Deno.test("prazo longo recebe o aviso de 7 dias na janela certa", () => {
  assertEquals(janelasQueDisparam(horas(7 * 24)), [7]);
  assertEquals(janelasQueDisparam(horas(6 * 24 + 1)), [7]);
  assertEquals(janelasQueDisparam(horas(6 * 24)), []);
});

Deno.test("trial já vencido não recebe aviso", () => {
  assertEquals(janelasQueDisparam(horas(-1)), []);
});
