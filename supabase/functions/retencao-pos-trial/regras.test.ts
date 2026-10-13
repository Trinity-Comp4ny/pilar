import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { DIA_MS, type EmpresaEmLeitura, proximaAcao } from "./regras.ts";

const agora = Date.UTC(2026, 9, 13);
const diasAtras = (n: number) => new Date(agora - n * DIA_MS).toISOString();
const empresa = (leituraHa: number, aviso60Ha?: number, aviso85Ha?: number): EmpresaEmLeitura => ({
  id: "e1",
  nome: "Escritório",
  leitura_desde: diasAtras(leituraHa),
  retencao_aviso_60d_sent_at: aviso60Ha === undefined ? null : diasAtras(aviso60Ha),
  retencao_aviso_85d_sent_at: aviso85Ha === undefined ? null : diasAtras(aviso85Ha),
});

Deno.test("antes do dia 60 nada acontece", () => {
  assertEquals(proximaAcao(empresa(59), agora), null);
});

Deno.test("dia 60 avisa com 30 dias de prazo, uma vez só", () => {
  const a = proximaAcao(empresa(60), agora);
  assertEquals(a?.tipo === "avisar" && [a.dias, a.diasRestantes], [60, 30]);
  assertEquals(proximaAcao(empresa(70, 10), agora), null);
});

Deno.test("dia 85 avisa com 5 dias de prazo", () => {
  const a = proximaAcao(empresa(85, 25), agora);
  assertEquals(a?.tipo === "avisar" && [a.dias, a.diasRestantes], [85, 5]);
});

Deno.test("dia 90 exclui quando o aviso final saiu há 5 dias ou mais", () => {
  assertEquals(proximaAcao(empresa(90, 30, 5), agora)?.tipo, "excluir");
});

Deno.test("cron atrasado: empresa nunca avisada recebe o aviso final antes, não é excluída", () => {
  const a = proximaAcao(empresa(120), agora);
  assertEquals(a?.tipo === "avisar" && [a.dias, a.diasRestantes], [85, 5]);
});

Deno.test("aviso final recente segura a exclusão até o prazo", () => {
  assertEquals(proximaAcao(empresa(95, 35, 2), agora), null);
  assertEquals(proximaAcao(empresa(95, 35, 5), agora)?.tipo, "excluir");
});

Deno.test("data de início inválida não dispara nada", () => {
  assertEquals(proximaAcao({ ...empresa(100), leitura_desde: "não é data" }, agora), null);
});
