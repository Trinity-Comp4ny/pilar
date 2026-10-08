import { describe, expect, it } from "vitest";
import { cobraNaHora, ehConvidada, podeAtivarPlano } from "./cobranca";

const agora = new Date("2026-10-08T12:00:00.000Z");

describe("ehConvidada", () => {
  it("sem assinatura é convidada (empresa antiga)", () => {
    expect(ehConvidada(null)).toBe(true);
  });

  it("ativa sem Asaas é convidada; com Asaas é pagante", () => {
    expect(ehConvidada({ status: "active", trial_ends_at: null, asaas_subscription_id: null })).toBe(true);
    expect(ehConvidada({ status: "active", trial_ends_at: null, asaas_subscription_id: "sub_1" })).toBe(false);
  });

  it("em teste ou vencida não é convidada", () => {
    expect(ehConvidada({ status: "trialing", trial_ends_at: "2026-10-10T00:00:00Z" })).toBe(false);
    expect(ehConvidada({ status: "expired", trial_ends_at: "2026-10-01T00:00:00Z" })).toBe(false);
  });
});

describe("cobraNaHora", () => {
  it("teste vencido ou assinatura cancelada cobra na hora", () => {
    expect(cobraNaHora({ status: "expired", trial_ends_at: null }, agora)).toBe(true);
    expect(cobraNaHora({ status: "canceled", trial_ends_at: null }, agora)).toBe(true);
  });

  it("trialing com a data passada cobra na hora; no prazo, não", () => {
    expect(cobraNaHora({ status: "trialing", trial_ends_at: "2026-10-08T11:00:00Z" }, agora)).toBe(true);
    expect(cobraNaHora({ status: "trialing", trial_ends_at: "2026-10-09T11:00:00Z" }, agora)).toBe(false);
  });
});

describe("podeAtivarPlano", () => {
  it("em teste, vencido ou cancelada; nunca ativa ou em atraso", () => {
    expect(podeAtivarPlano({ status: "trialing", trial_ends_at: null })).toBe(true);
    expect(podeAtivarPlano({ status: "expired", trial_ends_at: null })).toBe(true);
    expect(podeAtivarPlano({ status: "canceled", trial_ends_at: null })).toBe(true);
    expect(podeAtivarPlano({ status: "active", trial_ends_at: null })).toBe(false);
    expect(podeAtivarPlano({ status: "overdue", trial_ends_at: null })).toBe(false);
  });
});
