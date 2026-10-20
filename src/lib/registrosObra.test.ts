import { describe, expect, it } from "vitest";
import {
  chipsDoExtraido,
  dataLocalIso,
  formatarDuracao,
  mensagemDoErro,
  rotuloDoDia,
  temOrganizacaoEmCurso,
} from "./registrosObra";

describe("chipsDoExtraido", () => {
  it("vazio ou nulo não gera chip", () => {
    expect(chipsDoExtraido(null)).toEqual([]);
    expect(chipsDoExtraido({})).toEqual([]);
  });

  it("monta pessoas, serviço, falta e pendência em frases curtas", () => {
    const chips = chipsDoExtraido({
      efetivo_total: 8,
      servicos: [
        { descricao: "Alvenaria 2º pav.", resultado: "comecou" },
        { descricao: "Elétrica", resultado: "parou" },
      ],
      materiais_faltando: ["Cimento"],
      pendencias: ["Entrega na quinta"],
    });
    expect(chips.map((c) => c.texto)).toEqual([
      "8 pessoas",
      "Alvenaria 2º pav.: começou",
      "Elétrica: parou",
      "Falta: Cimento",
      "Pendente: Entrega na quinta",
    ]);
    expect(chips[1].tom).toBe("positivo");
    expect(chips[2].tom).toBe("atencao");
    expect(chips[3].tom).toBe("atencao");
  });

  it("uma pessoa fica no singular e o efetivo zero ainda aparece", () => {
    expect(chipsDoExtraido({ efetivo_total: 1 })[0].texto).toBe("1 pessoa");
    expect(chipsDoExtraido({ efetivo_total: 0 })[0].texto).toBe("0 pessoas");
  });

  it("limita a 8 chips", () => {
    const chips = chipsDoExtraido({ problemas: Array.from({ length: 20 }, (_, i) => `p${i}`) });
    expect(chips).toHaveLength(8);
  });
});

describe("formatarDuracao", () => {
  it("formata minutos e segundos", () => {
    expect(formatarDuracao(0)).toBe("0:00");
    expect(formatarDuracao(48)).toBe("0:48");
    expect(formatarDuracao(180)).toBe("3:00");
    expect(formatarDuracao(-5)).toBe("0:00");
  });
});

describe("mensagemDoErro", () => {
  it("sempre diz que o registro está salvo (ou o que fazer)", () => {
    for (const erro of ["sem_tokens", "tempo_esgotado", "provedor_indisponivel", "saida_invalida", null]) {
      expect(mensagemDoErro(erro)).toMatch(/salvo/);
    }
    expect(mensagemDoErro("audio_indisponivel")).toMatch(/Grave de novo/);
  });
});

describe("temOrganizacaoEmCurso", () => {
  it("só enviado e organizando mantêm a lista atualizando", () => {
    expect(temOrganizacaoEmCurso([{ status: "pronto" }, { status: "falhou" }])).toBe(false);
    expect(temOrganizacaoEmCurso([{ status: "pronto" }, { status: "organizando" }])).toBe(true);
    expect(temOrganizacaoEmCurso([{ status: "enviado" }])).toBe(true);
    expect(temOrganizacaoEmCurso([])).toBe(false);
  });
});

describe("datas", () => {
  it("dataLocalIso usa o dia local, mesmo perto da meia-noite", () => {
    expect(dataLocalIso(new Date(2026, 9, 19, 23, 50))).toBe("2026-10-19");
    expect(dataLocalIso(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
  });

  it("rotuloDoDia: hoje, ontem e dia da semana", () => {
    const hoje = new Date(2026, 9, 19, 12);
    expect(rotuloDoDia("2026-10-19", hoje)).toBe("Hoje, 19 out");
    expect(rotuloDoDia("2026-10-18", hoje)).toBe("Ontem, 18 out");
    expect(rotuloDoDia("2026-10-16", hoje)).toBe("sexta, 16 out");
  });
});
