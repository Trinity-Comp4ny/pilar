// Casos de borda da reconciliação (SPEC 114): status que não entram na conta, dados
// faltando do Asaas ou do banco, e a leitura do último aviso na auditoria.
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  assinaturaDaLista,
  type AssinaturaAsaas,
  type AssinaturaBanco,
  compararAssinatura,
  DIA_MS,
  deveAvisar,
  SILENCIO_DIAS,
  ultimoAvisoDoRegistro,
} from "./regras.ts";

const agora = Date.UTC(2026, 10, 7, 12);
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

Deno.test("trial no banco não acusa divergência de cobrança, mesmo inativa no Asaas", () => {
  assertEquals(codigos(banco({ status: "trialing" }), asaas({ status: "INACTIVE" })), []);
  assertEquals(codigos(banco({ status: "trialing" }), asaas({ value: 1 })), []);
});

Deno.test("cancelada nos dois lados está em ordem", () => {
  assertEquals(codigos(banco({ status: "canceled" }), asaas({ status: "INACTIVE" })), []);
  assertEquals(codigos(banco({ status: "canceled" }), asaas({ deleted: true })), []);
});

Deno.test("removida no Asaas, mesmo com status ACTIVE, conta como não cobrando", () => {
  assertEquals(codigos(banco(), asaas({ deleted: true })), ["cancelada_no_asaas"]);
  // E não acusa valor/ciclo de algo que nem existe mais.
  assertEquals(codigos(banco(), asaas({ deleted: true, value: 1, cycle: "YEARLY" })), ["cancelada_no_asaas"]);
});

Deno.test("em atraso no banco e expirada no Asaas acusa cancelada no Asaas", () => {
  assertEquals(codigos(banco({ status: "overdue" }), asaas({ status: "EXPIRED" })), ["cancelada_no_asaas"]);
});

Deno.test("pagamento em dinheiro (RECEIVED_IN_CASH) também conta como pago", () => {
  assertEquals(codigos(banco({ status: "overdue" }), asaas(), [{ status: "RECEIVED_IN_CASH", dueDate: dia(5) }]), [
    "pagamento_nao_registrado",
  ]);
});

Deno.test("só a cobrança vencida mais recente decide atraso; uma futura pendente não conta", () => {
  // Mais recente primeiro: a futura (PENDING) é ignorada, a vencida paga diz que está em dia.
  assertEquals(
    codigos(banco(), asaas(), [
      { status: "PENDING", dueDate: dia(-20) },
      { status: "RECEIVED", dueDate: dia(10) },
      { status: "OVERDUE", dueDate: dia(40) },
    ]),
    []
  );
});

Deno.test("data de vencimento inválida é ignorada, não vira atraso", () => {
  assertEquals(codigos(banco(), asaas(), [{ status: "OVERDUE", dueDate: "não é data" }]), []);
});

Deno.test("sem cobranças no Asaas não acusa atraso nem pagamento", () => {
  assertEquals(codigos(banco(), asaas(), []), []);
  assertEquals(codigos(banco({ status: "overdue" }), asaas(), []), []);
});

Deno.test("diferença de centavo (arredondamento) não acusa valor divergente", () => {
  assertEquals(codigos(banco(), asaas({ value: 297.005 })), []);
  assertEquals(codigos(banco(), asaas({ value: 297.02 })), ["valor_divergente"]);
});

Deno.test("plano sem preço no banco ou ciclo nulo não acusa valor/ciclo", () => {
  assertEquals(codigos(banco({ preco_mensal: null }), asaas({ value: 999 })), []);
  assertEquals(codigos(banco({ billing_cycle: null }), asaas({ cycle: "YEARLY" })), []);
});

Deno.test("anual no banco compara com o preço anual", () => {
  assertEquals(codigos(banco({ billing_cycle: "yearly" }), asaas({ cycle: "YEARLY", value: 2970 })), []);
  assertEquals(codigos(banco({ billing_cycle: "yearly" }), asaas({ cycle: "YEARLY", value: 297 })), [
    "valor_divergente",
  ]);
});

Deno.test("ciclo do Asaas fora de mensal/anual (ex. trimestral) é divergência", () => {
  assertEquals(codigos(banco(), asaas({ cycle: "QUARTERLY" })), ["ciclo_divergente"]);
});

Deno.test("descrição em reais com vírgula", () => {
  const [d] = compararAssinatura(banco(), asaas({ value: 300 }), [], agora);
  assertEquals(d.descricao, "Plano custa R$ 297,00 no ciclo do banco, Asaas cobra R$ 300,00.");
});

Deno.test("chave da lista ignora ordem e repetição", () => {
  const a = { codigo: "valor_divergente" as const, descricao: "" };
  const b = { codigo: "ciclo_divergente" as const, descricao: "" };
  assertEquals(assinaturaDaLista([a, b, a]), "ciclo_divergente,valor_divergente");
  assertEquals(assinaturaDaLista([b, a]), assinaturaDaLista([a, b]));
});

Deno.test("aviso igual reavisa exatamente após o silêncio; sem divergência nunca avisa", () => {
  const d = [{ codigo: "valor_divergente" as const, descricao: "" }];
  const chave = assinaturaDaLista(d);
  const em = (dias: number) => new Date(agora - dias * DIA_MS).toISOString();
  assertEquals(deveAvisar(d, { chave, em: em(SILENCIO_DIAS) }, agora), true);
  assertEquals(deveAvisar(d, { chave, em: em(SILENCIO_DIAS - 0.01) }, agora), false);
  assertEquals(deveAvisar([], null, agora), false);
});

Deno.test("último aviso: só registro que avisou e tem chave conta", () => {
  const em = "2026-11-01T06:30:00.000Z";
  assertEquals(ultimoAvisoDoRegistro({ created_at: em, metadata: { chave: "x", avisado: true } }), {
    chave: "x",
    em,
  });
  // Registro silenciado (avisado=false) não reinicia a contagem dos 7 dias.
  assertEquals(ultimoAvisoDoRegistro({ created_at: em, metadata: { chave: "x", avisado: false } }), null);
  assertEquals(ultimoAvisoDoRegistro({ created_at: em, metadata: { avisado: true } }), null);
  assertEquals(ultimoAvisoDoRegistro({ created_at: em, metadata: null }), null);
  assertEquals(ultimoAvisoDoRegistro(null), null);
});
