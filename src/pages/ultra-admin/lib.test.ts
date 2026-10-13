import { describe, expect, it } from "vitest";
import type { Cobranca } from "./api";
import {
  descreverAcao,
  descreverMutacao,
  ehEcoDeExclusaoManual,
  estadoDosComponentes,
  nomeDoAtor,
  prazoTeste,
  quandoRelativo,
  situacaoEmpresa,
  testeVenceEmBreve,
} from "./lib";

const cobranca = (c: Partial<Cobranca>): Cobranca => ({
  status: null,
  trialEndsAt: null,
  isPaying: false,
  convidada: false,
  ...c,
});

describe("situacaoEmpresa", () => {
  it("status da empresa vence a cobrança", () => {
    expect(situacaoEmpresa("cancelled", cobranca({ isPaying: true, status: "active" }))).toBe("arquivada");
    expect(situacaoEmpresa("suspended", cobranca({ convidada: true }))).toBe("suspensa");
  });

  it("traduz o estado da assinatura", () => {
    expect(situacaoEmpresa("active", cobranca({ convidada: true, status: "active" }))).toBe("convidada");
    expect(situacaoEmpresa("active", cobranca({ isPaying: true, status: "active" }))).toBe("pagante");
    expect(situacaoEmpresa("active", cobranca({ status: "trialing" }))).toBe("em_teste");
    expect(situacaoEmpresa("active", cobranca({ isPaying: true, status: "trialing" }))).toBe("em_teste");
    expect(situacaoEmpresa("active", cobranca({ status: "expired" }))).toBe("teste_vencido");
    expect(situacaoEmpresa("active", cobranca({ status: "overdue", isPaying: true }))).toBe("em_atraso");
    expect(situacaoEmpresa("active", cobranca({ status: "canceled" }))).toBe("assinatura_cancelada");
    expect(situacaoEmpresa("active", cobranca({}))).toBe("sem_assinatura");
  });
});

describe("prazoTeste", () => {
  const agora = new Date("2026-10-13T12:00:00Z").getTime();
  it("fala em horas no último dia e em dias antes disso", () => {
    expect(prazoTeste("2026-10-13T17:00:00Z", agora)).toBe("vence em 5 h");
    expect(prazoTeste("2026-10-13T12:30:00Z", agora)).toBe("vence em menos de 1 h");
    expect(prazoTeste("2026-10-14T13:00:00Z", agora)).toBe("vence em 2 dias");
    expect(prazoTeste("2026-10-14T11:00:00Z", agora)).toBe("vence em 23 h");
  });
  it("diz quando já venceu", () => {
    expect(prazoTeste("2026-10-13T08:00:00Z", agora)).toBe("venceu hoje");
    expect(prazoTeste("2026-10-10T08:00:00Z", agora)).toBe("venceu há 3 dias");
    expect(prazoTeste(null, agora)).toBeNull();
  });
  it("teste vencendo em até 48 h entra na atenção, vencido não", () => {
    expect(testeVenceEmBreve("2026-10-14T12:00:00Z", 48, agora)).toBe(true);
    expect(testeVenceEmBreve("2026-10-20T12:00:00Z", 48, agora)).toBe(false);
    expect(testeVenceEmBreve("2026-10-12T12:00:00Z", 48, agora)).toBe(false);
  });
});

describe("quandoRelativo", () => {
  const agora = new Date("2026-10-13T12:00:00Z").getTime();
  it("encurta datas recentes e mostra a data quando passa de 30 dias", () => {
    expect(quandoRelativo("2026-10-13T11:30:00Z", agora)).toBe("agora há pouco");
    expect(quandoRelativo("2026-10-13T09:00:00Z", agora)).toBe("há 3 h");
    expect(quandoRelativo("2026-10-12T10:00:00Z", agora)).toBe("ontem");
    expect(quandoRelativo("2026-10-08T12:00:00Z", agora)).toBe("há 5 dias");
    expect(quandoRelativo("2026-08-01T12:00:00Z", agora)).toBe("01/08/2026");
    expect(quandoRelativo(null, agora)).toBeNull();
  });
});

describe("descreverAcao", () => {
  it("vira frase legível, nunca o código cru", () => {
    expect(
      descreverAcao({ action: "create_company", category: "empresa", targetName: "VRZ", metadata: null }).frase
    ).toBe("criou a empresa VRZ");
    expect(
      descreverAcao({
        action: "convert_to_paid",
        category: "empresa",
        targetName: "VRZ",
        metadata: { dias_prazo: 7 },
      }).frase
    ).toBe("começou a cobrar VRZ, com 7 dias para assinar");
    expect(
      descreverAcao({
        action: "bulk_toggle_feature",
        category: "empresa",
        targetName: "timesheet",
        metadata: { feature: "timesheet", value: false, affected: 3 },
      }).frase
    ).toBe("desligou Timesheet em 3 empresas");
    expect(
      descreverAcao({
        action: "update_user_access",
        category: "member",
        targetName: "ana@vrz.com",
        metadata: { new: { role: "coordenador" } },
      })
    ).toEqual({ frase: "mudou o acesso de ana@vrz.com para coordenador", tipo: "usuarios" });
  });

  it("ação desconhecida aparece com o código, sem sumir", () => {
    expect(descreverAcao({ action: "algo_novo", category: "billing", targetName: "X", metadata: null })).toEqual({
      frase: "algo novo (X)",
      tipo: "cobranca",
    });
  });

  it("ator vira nome curto ou Sistema", () => {
    expect(nomeDoAtor("matheus@pilarsoft.co")).toBe("matheus");
    expect(nomeDoAtor(null)).toBe("Sistema");
    expect(nomeDoAtor("system@pilar")).toBe("Sistema");
  });
});

describe("descreverMutacao", () => {
  it("verbo pela ação e substantivo pela tabela", () => {
    expect(descreverMutacao("INSERT", "projetos")).toBe("criou um projeto");
    expect(descreverMutacao("DELETE", "despesas")).toBe("apagou uma despesa");
    expect(descreverMutacao("UPDATE", "tabela_nova")).toBe("editou um registro em tabela nova");
    expect(descreverMutacao("UPDATE", null)).toBe("editou um registro");
  });
});

describe("estadoDosComponentes", () => {
  it("pior severidade entre incidentes abertos; resolvido não conta", () => {
    const estado = estadoDosComponentes(
      ["app", "api", "email"],
      [
        { status: "investigando", severidade: "degradado", componentIds: ["app", "api"] },
        { status: "monitorando", severidade: "outage", componentIds: ["api"] },
        { status: "resolvido", severidade: "outage", componentIds: ["email"] },
      ]
    );
    expect(estado.get("app")).toBe("degradado");
    expect(estado.get("api")).toBe("outage");
    expect(estado.get("email")).toBe("operacional");
  });
});

describe("feed de exclusão e status", () => {
  it("mudança de status vira verbo próprio", () => {
    const base = { action: "update_company", category: "empresa", targetName: "VRZ" };
    expect(descreverAcao({ ...base, metadata: { old_status: "active", new_status: "cancelled" } }).frase).toBe(
      "arquivou VRZ"
    );
    expect(descreverAcao({ ...base, metadata: { old_status: "cancelled", new_status: "active" } }).frase).toBe(
      "reativou VRZ"
    );
    expect(descreverAcao({ ...base, metadata: { old_status: "active", new_status: "active" } }).frase).toBe(
      "editou os dados de VRZ"
    );
  });

  it("esconde a linha duplicada da RPC na exclusão manual, mantém a do cron", () => {
    expect(
      ehEcoDeExclusaoManual("empresa_excluida_retencao", { motivo: "Exclusão manual no portal ultra admin: x" })
    ).toBe(true);
    expect(ehEcoDeExclusaoManual("empresa_excluida_retencao", { motivo: "Retenção pós-trial: 90 dias" })).toBe(false);
    expect(ehEcoDeExclusaoManual("delete_company", null)).toBe(false);
  });
});
