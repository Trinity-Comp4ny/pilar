import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { type AssinaturaAsaas, type AssinaturaBanco, compararAssinatura, DIA_MS, deveAvisar } from "./regras.ts";

const agora = Date.UTC(2026, 9, 13, 12);
const dia = (n: number) => new Date(agora - n * DIA_MS).toISOString().slice(0, 10);
const banco = (b: Partial<AssinaturaBanco> = {}): AssinaturaBanco => ({
  status: "active",
  billing_cycle: "monthly",
  preco_mensal: 297,
  preco_anual: 2970,
  ...b,
});
const asaas = (a: Partial<AssinaturaAsaas> = {}): AssinaturaAsaas => ({
  status: "ACTIVE",
  value: 297,
  cycle: "MONTHLY",
  ...a,
});
const codigos = (b: AssinaturaBanco, a: AssinaturaAsaas, c: { status: string; dueDate: string }[] = []) =>
  compararAssinatura(b, a, c, agora).map((d) => d.codigo);

Deno.test("assinatura em ordem não gera divergência", () => {
  assertEquals(codigos(banco(), asaas(), [{ status: "RECEIVED", dueDate: dia(10) }]), []);
});

Deno.test("cancelada ou removida no Asaas com o banco em vigor", () => {
  assertEquals(codigos(banco(), asaas({ status: "INACTIVE" })), ["cancelada_no_asaas"]);
  assertEquals(codigos(banco({ status: "overdue" }), asaas({ deleted: true })), ["cancelada_no_asaas"]);
});

Deno.test("cancelada no banco e ainda cobrando no Asaas", () => {
  assertEquals(codigos(banco({ status: "canceled" }), asaas()), ["ativa_no_asaas"]);
  assertEquals(codigos(banco({ status: "canceled" }), asaas({ deleted: true })), []);
});

Deno.test("atraso no Asaas que o banco não registrou, com 1 dia de tolerância", () => {
  assertEquals(codigos(banco(), asaas(), [{ status: "OVERDUE", dueDate: dia(3) }]), ["atraso_nao_registrado"]);
  // Venceu hoje: o webhook pode estar a caminho.
  assertEquals(codigos(banco(), asaas(), [{ status: "OVERDUE", dueDate: dia(0) }]), []);
});

Deno.test("pagamento no Asaas que o banco não registrou", () => {
  assertEquals(codigos(banco({ status: "overdue" }), asaas(), [{ status: "CONFIRMED", dueDate: dia(5) }]), [
    "pagamento_nao_registrado",
  ]);
  // A mais recente vencida ainda está em atraso: o banco está certo.
  assertEquals(
    codigos(banco({ status: "overdue" }), asaas(), [
      { status: "OVERDUE", dueDate: dia(5) },
      { status: "RECEIVED", dueDate: dia(35) },
    ]),
    []
  );
});

Deno.test("valor e ciclo diferentes do plano", () => {
  assertEquals(codigos(banco(), asaas({ value: 197 })), ["valor_divergente"]);
  assertEquals(codigos(banco(), asaas({ value: 297.004 })), []);
  assertEquals(codigos(banco({ billing_cycle: "yearly" }), asaas({ cycle: "YEARLY", value: 2970 })), []);
  assertEquals(codigos(banco({ billing_cycle: "yearly" }), asaas({ cycle: "MONTHLY", value: 2970 })), [
    "ciclo_divergente",
  ]);
});

Deno.test("aviso: novo avisa, igual dentro de 7 dias silencia, lista diferente reavisa", () => {
  const divs = compararAssinatura(banco(), asaas({ value: 197 }), [], agora);
  assertEquals(deveAvisar(divs, null, agora), true);
  assertEquals(
    deveAvisar(divs, { chave: "valor_divergente", em: new Date(agora - 2 * DIA_MS).toISOString() }, agora),
    false
  );
  assertEquals(
    deveAvisar(divs, { chave: "valor_divergente", em: new Date(agora - 8 * DIA_MS).toISOString() }, agora),
    true
  );
  assertEquals(
    deveAvisar(divs, { chave: "ciclo_divergente", em: new Date(agora - 1 * DIA_MS).toISOString() }, agora),
    true
  );
  assertEquals(deveAvisar([], null, agora), false);
});
