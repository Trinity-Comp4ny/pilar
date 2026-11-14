import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerAcao } from "./entrada.ts";

const reuniao = {
  titulo: "Reunião com a VRZ",
  inicio: "2026-11-20T14:00:00-03:00",
  fim: "2026-11-20T15:00:00-03:00",
  dia_inteiro: false,
  convidados: ["Cliente@VRZ.com"],
  meet: true,
  lembrete_minutos: 10,
};

Deno.test("Agenda aceita as ações conhecidas e nunca o cron pelo corpo", () => {
  assertEquals(lerAcao({ acao: "iniciar", retorno: "/gestao/tarefas" }).ok, true);
  assertEquals(lerAcao({ acao: "sincronizar" }).ok, true);
  assertEquals(lerAcao({ acao: "desconectar" }).ok, true);
  // "cron" só vale com o segredo do cron, nunca pelo corpo de quem está logado.
  assertEquals(lerAcao({ acao: "cron" }).ok, false);
  assertEquals(lerAcao(null).ok, false);
});

Deno.test("criar valida a reunião e normaliza o e-mail do convidado", () => {
  const r = lerAcao({ acao: "criar", reuniao });
  assertEquals(r.ok, true);
  if (r.ok && r.data.acao === "criar") assertEquals(r.data.reuniao.convidados, ["cliente@vrz.com"]);
  assertEquals(lerAcao({ acao: "criar", reuniao: { ...reuniao, titulo: "  " } }).ok, false);
  assertEquals(lerAcao({ acao: "criar", reuniao: { ...reuniao, fim: reuniao.inicio } }).ok, false);
  assertEquals(lerAcao({ acao: "criar", reuniao: { ...reuniao, convidados: ["não é e-mail"] } }).ok, false);
  assertEquals(lerAcao({ acao: "criar", reuniao: { ...reuniao, lembrete_minutos: -5 } }).ok, false);
});

Deno.test("dia inteiro usa datas; editar e excluir pedem o id da Pilar", () => {
  const diaInteiro = { titulo: "Visita à obra", inicio: "2026-11-21", fim: "2026-11-21", dia_inteiro: true };
  assertEquals(lerAcao({ acao: "criar", reuniao: diaInteiro }).ok, true);
  assertEquals(lerAcao({ acao: "criar", reuniao: { ...diaInteiro, fim: "2026-11-20" } }).ok, false);
  const id = "a1640000-0000-0000-0000-00000000e001";
  assertEquals(lerAcao({ acao: "editar", id, reuniao }).ok, true);
  assertEquals(lerAcao({ acao: "excluir", id }).ok, true);
  assertEquals(lerAcao({ acao: "excluir", id: "abc" }).ok, false);
});
