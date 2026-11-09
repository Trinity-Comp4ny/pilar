import { describe, expect, it } from "vitest";
import {
  diaDoTimestamp,
  estadoDoConvite,
  formatarNota,
  linkDaCotacao,
  notaGeral,
  podeRevogarConvite,
  type ConviteDatas,
} from "./cotacaoConvite";

const agora = new Date("2026-10-28T12:00:00Z");
const base: ConviteDatas = {
  expira_em: "2026-11-04T12:00:00Z",
  aberto_em: null,
  respondido_em: null,
  revogado_em: null,
};

describe("estadoDoConvite", () => {
  it("recém-gerado é enviado, e aberto depois que o fornecedor abre", () => {
    expect(estadoDoConvite(base, agora)).toBe("enviado");
    expect(estadoDoConvite({ ...base, aberto_em: "2026-10-29T09:00:00Z" }, agora)).toBe("aberto");
  });

  it("resposta vale mais que o relógio: respondido não vira expirado", () => {
    const c = { ...base, expira_em: "2026-10-01T00:00:00Z", respondido_em: "2026-09-30T10:00:00Z" };
    expect(estadoDoConvite(c, agora)).toBe("respondido");
  });

  it("sem resposta e vencido é expirado", () => {
    expect(estadoDoConvite({ ...base, expira_em: "2026-10-28T11:59:59Z" }, agora)).toBe("expirado");
  });

  it("revogar vale primeiro, até sobre a resposta", () => {
    const c = { ...base, respondido_em: "2026-10-29T09:00:00Z", revogado_em: "2026-10-29T10:00:00Z" };
    expect(estadoDoConvite(c, agora)).toBe("revogado");
  });

  it("só enviado e aberto podem ser revogados", () => {
    expect(
      ["enviado", "aberto", "respondido", "expirado", "revogado"].filter((e) => podeRevogarConvite(e as never))
    ).toEqual(["enviado", "aberto"]);
  });
});

describe("notaGeral", () => {
  it("é a média dos critérios preenchidos, com uma casa", () => {
    expect(notaGeral({ demora: 5, preco: 4, prazo: 3, qualidade: 4 })).toBe(4);
    expect(notaGeral({ demora: 5, preco: 4, prazo: null, qualidade: null })).toBe(4.5);
    expect(notaGeral({ demora: 4, preco: 4, prazo: 5, qualidade: null })).toBe(4.3);
  });

  it("sem nenhum critério não há nota", () => {
    expect(notaGeral({ demora: null, preco: null, prazo: null, qualidade: null })).toBeNull();
  });

  it("zero é nota, não ausência", () => {
    expect(notaGeral({ demora: 0, preco: null, prazo: null, qualidade: null })).toBe(0);
  });
});

describe("diaDoTimestamp", () => {
  it("formata o dia de um timestamp e não quebra com valor vazio ou inválido", () => {
    expect(diaDoTimestamp("2026-11-04T15:00:00Z")).toBe("04/11/2026");
    expect(diaDoTimestamp(null)).toBe("-");
    expect(diaDoTimestamp("lixo")).toBe("-");
  });
});

describe("formatação", () => {
  it("nota com vírgula e link com o token no fim", () => {
    expect(formatarNota(4.2)).toBe("4,2");
    expect(formatarNota(null)).toBe("-");
    expect(linkDaCotacao("https://app.pilarsoft.com.br", "abc")).toBe("https://app.pilarsoft.com.br/cotar/abc");
  });
});
