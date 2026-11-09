import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  alteracoesDoCancelamento,
  type AssinaturaGerenciada,
  cobrancaParaEstornar,
  dentroDoArrependimento,
  planejarTrocaDePlano,
  verificarAssinatura,
  verificarCancelamento,
} from "./gestao.ts";

const AGORA = new Date("2026-11-07T12:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * DIA).toISOString();

const sub: AssinaturaGerenciada = {
  id: "s1",
  asaas_subscription_id: "sub_asaas",
  plan_id: "p1",
  billing_cycle: "monthly",
  status: "active",
  current_period_start: diasAtras(2),
};

const pro = { id: "p2", slug: "pro", nome: "Pro", preco_mensal: 690, preco_anual: 6900 };

// --- Assinatura gerenciável ---

Deno.test("sem assinatura: 404; sem referência no Asaas: 400", () => {
  assertEquals(verificarAssinatura(null), { ok: false, status: 404, error: "Assinatura não encontrada" });
  assertEquals(verificarAssinatura({ ...sub, asaas_subscription_id: null }), {
    ok: false,
    status: 400,
    error: "Assinatura sem referência Asaas",
  });
  assertEquals(verificarAssinatura(sub).ok, true);
});

// --- Cancelamento ---

Deno.test("cancelar assinatura já cancelada é recusado (400) antes de chamar o Asaas", () => {
  assertEquals(verificarCancelamento("canceled"), { ok: false, status: 400, error: "Assinatura já cancelada" });
});

Deno.test("cancelar é permitido em qualquer outro status (ativa, em atraso, em teste, expirada)", () => {
  for (const status of ["active", "overdue", "trialing", "expired"]) {
    assertEquals(verificarCancelamento(status), { ok: true }, status);
  }
});

Deno.test("arrependimento: até 7 dias da 1ª cobrança estorna, depois não", () => {
  assertEquals(dentroDoArrependimento(diasAtras(0), AGORA.getTime()), true);
  assertEquals(dentroDoArrependimento(diasAtras(6.9), AGORA.getTime()), true);
  assertEquals(dentroDoArrependimento(diasAtras(7), AGORA.getTime()), true);
  assertEquals(dentroDoArrependimento(diasAtras(7.01), AGORA.getTime()), false);
  assertEquals(dentroDoArrependimento(diasAtras(30), AGORA.getTime()), false);
});

Deno.test("arrependimento: sem data de início (nunca cobrou) não estorna", () => {
  assertEquals(dentroDoArrependimento(null, AGORA.getTime()), false);
});

Deno.test("estorno só da 1ª cobrança paga; pendente, vencida ou já estornada não estorna", () => {
  assertEquals(cobrancaParaEstornar([{ id: "pay_1", status: "CONFIRMED" }])?.id, "pay_1");
  assertEquals(cobrancaParaEstornar([{ id: "pay_1", status: "RECEIVED" }])?.id, "pay_1");
  for (const status of ["PENDING", "OVERDUE", "REFUNDED", "AWAITING_RISK_ANALYSIS"]) {
    assertEquals(cobrancaParaEstornar([{ id: "pay_1", status }]), null, status);
  }
  assertEquals(cobrancaParaEstornar([]), null);
});

Deno.test("estorno olha só a 1ª cobrança, mesmo que uma posterior esteja paga", () => {
  assertEquals(
    cobrancaParaEstornar([
      { id: "pay_1", status: "PENDING" },
      { id: "pay_2", status: "CONFIRMED" },
    ]),
    null
  );
});

Deno.test("cancelamento com estorno encerra o acesso agora; sem estorno mantém até o fim do período", () => {
  assertEquals(alteracoesDoCancelamento(true, AGORA), {
    status: "canceled",
    canceled_at: AGORA.toISOString(),
    current_period_end: AGORA.toISOString(),
  });
  const semEstorno = alteracoesDoCancelamento(false, AGORA);
  assertEquals(semEstorno, { status: "canceled", canceled_at: AGORA.toISOString() });
  assertEquals("current_period_end" in semEstorno, false);
});

// --- Troca de plano ---

Deno.test("troca de plano: ciclo pedido manda; valor vem do plano no banco", () => {
  const r = planejarTrocaDePlano(pro, "yearly", "monthly");
  assertEquals(r, {
    ok: true,
    cycle: "yearly",
    value: 6900,
    asaas: {
      value: 6900,
      cycle: "YEARLY",
      description: "Pilar Pro — assinatura anual",
      updatePendingPayments: true,
    },
  });
});

Deno.test("troca de plano sem ciclo mantém o ciclo atual; sem ciclo atual cai em mensal", () => {
  const anual = planejarTrocaDePlano(pro, undefined, "yearly");
  assertEquals(anual.ok && anual.cycle, "yearly");
  assertEquals(anual.ok && anual.value, 6900);

  const semCiclo = planejarTrocaDePlano(pro, undefined, null);
  assertEquals(semCiclo.ok && semCiclo.cycle, "monthly");
  assertEquals(semCiclo.ok && semCiclo.asaas.cycle, "MONTHLY");
  assertEquals(semCiclo.ok && semCiclo.value, 690);
});

Deno.test("troca de plano atualiza as cobranças pendentes no Asaas (não só as futuras)", () => {
  const r = planejarTrocaDePlano(pro, "monthly", "monthly");
  assertEquals(r.ok && r.asaas.updatePendingPayments, true);
});

Deno.test("plano sem preço no ciclo pedido é recusado (400) antes do Asaas", () => {
  const semAnual = { ...pro, preco_anual: null };
  assertEquals(planejarTrocaDePlano(semAnual, "yearly", "monthly"), {
    ok: false,
    status: 400,
    error: "Valor do plano indisponível",
  });
  assertEquals(planejarTrocaDePlano({ ...pro, preco_mensal: 0 }, "monthly", null).ok, false);
  assertEquals(planejarTrocaDePlano({ ...pro, preco_mensal: -10 }, "monthly", null).ok, false);
});

Deno.test("troca para o mesmo plano e ciclo é aceita e reenvia o mesmo valor (idempotente no Asaas)", () => {
  const r = planejarTrocaDePlano(pro, "monthly", "monthly");
  assertEquals(r.ok && r.value, 690);
  assertEquals(r.ok && r.asaas.cycle, "MONTHLY");
});
