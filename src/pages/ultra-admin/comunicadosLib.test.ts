import { describe, expect, it } from "vitest";
import { erroDoComunicado, publicoDoComunicado, situacaoComunicado, type FormComunicado } from "./comunicadosLib";

const base: FormComunicado = {
  titulo: "Preço novo",
  mensagem: "A partir de dezembro",
  formato: "faixa",
  linkUrl: "",
  linkRotulo: "",
  empresaId: null,
  planoSlug: null,
  soAdmins: false,
  inicio: "",
  fim: "",
};

describe("comunicados (SPEC 157)", () => {
  it("valida título, mensagem, link e janela", () => {
    expect(erroDoComunicado(base)).toBeNull();
    expect(erroDoComunicado({ ...base, titulo: "" })).toMatch(/título/);
    expect(erroDoComunicado({ ...base, linkUrl: "javascript:alert(1)" })).toMatch(/link/);
    expect(erroDoComunicado({ ...base, linkUrl: "/gestao/financeiro" })).toBeNull();
    expect(erroDoComunicado({ ...base, inicio: "2026-12-01T10:00", fim: "2026-11-30T10:00" })).toMatch(/depois/);
  });

  it("descreve o público", () => {
    expect(publicoDoComunicado({ plano_slug: null, so_admins: false }, null)).toBe("Todos os escritórios");
    expect(publicoDoComunicado({ plano_slug: "pro", so_admins: true }, "Escritório X")).toBe(
      "Escritório X, plano pro, só administradores"
    );
  });

  it("situação pelo início, fim e encerramento", () => {
    const agora = new Date("2026-11-10T12:00:00Z").getTime();
    expect(situacaoComunicado({ inicio: "2026-11-01T00:00:00Z", fim: null, encerrado_em: null }, agora)).toBe("ativo");
    expect(situacaoComunicado({ inicio: "2026-11-20T00:00:00Z", fim: null, encerrado_em: null }, agora)).toBe(
      "programado"
    );
    expect(
      situacaoComunicado({ inicio: "2026-11-01T00:00:00Z", fim: "2026-11-05T00:00:00Z", encerrado_em: null }, agora)
    ).toBe("encerrado");
    expect(
      situacaoComunicado({ inicio: "2026-11-01T00:00:00Z", fim: null, encerrado_em: "2026-11-02T00:00:00Z" }, agora)
    ).toBe("encerrado");
  });
});
