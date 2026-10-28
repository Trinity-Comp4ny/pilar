import { z } from "zod";
import { parseCurrencyString } from "@/lib/currencyUtils";

/** O que a pessoa digita: tudo texto, como está nos campos da tela. */
export interface CamposProposta {
  valor: string;
  valorParcelado: string;
  condicao: string;
  desconto: string;
  prazo: string;
  observacoes: string;
}

export type ErrosProposta = Partial<Record<keyof CamposProposta, string>>;

/** Corpo que a edge `cotacao-link` espera (mesmos limites do schema dela). */
export interface PropostaEnviada {
  valor: number;
  valor_parcelado: number | null;
  condicao_pagamento: string;
  desconto_pct: number | null;
  prazo_entrega_dias: number;
  observacoes: string | null;
}

const reais = (rotulo: string, obrigatorio: boolean) =>
  z.string().transform((v, ctx) => {
    const n = v.trim() === "" ? 0 : parseCurrencyString(v);
    if (n === 0 && !obrigatorio) return null;
    if (!(n > 0)) {
      ctx.addIssue({ code: "custom", message: `Informe ${rotulo}, maior que zero.` });
      return z.NEVER;
    }
    if (n > 999_999_999) {
      ctx.addIssue({ code: "custom", message: "Valor alto demais." });
      return z.NEVER;
    }
    return n;
  });

const numeroBR = (v: string) => Number(v.trim().replace(",", "."));

const schema = z.object({
  valor: reais("o valor à vista", true),
  valorParcelado: reais("o valor parcelado", false),
  condicao: z.string().trim().min(1, "Informe a condição de pagamento.").max(200, "Texto longo demais."),
  desconto: z.string().transform((v, ctx) => {
    if (v.trim() === "") return null;
    const n = numeroBR(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "O desconto vai de 0 a 100." });
      return z.NEVER;
    }
    return n;
  }),
  prazo: z.string().transform((v, ctx) => {
    const n = numeroBR(v);
    if (v.trim() === "" || !Number.isInteger(n) || n < 0 || n > 3650) {
      ctx.addIssue({ code: "custom", message: "Informe o prazo em dias, com número inteiro." });
      return z.NEVER;
    }
    return n;
  }),
  observacoes: z.string().trim().max(1000, "Texto longo demais."),
});

/** Valida os campos digitados e monta o corpo da edge; erro por campo, na ordem do formulário. */
export function lerProposta(
  campos: CamposProposta
): { ok: true; dados: PropostaEnviada } | { ok: false; erros: ErrosProposta } {
  const r = schema.safeParse(campos);
  if (!r.success) {
    const erros: ErrosProposta = {};
    for (const issue of r.error.issues) {
      const campo = issue.path[0] as keyof CamposProposta;
      if (!erros[campo]) erros[campo] = issue.message;
    }
    return { ok: false, erros };
  }
  const v = r.data;
  return {
    ok: true,
    dados: {
      valor: v.valor as number,
      valor_parcelado: v.valorParcelado,
      condicao_pagamento: v.condicao,
      desconto_pct: v.desconto,
      prazo_entrega_dias: v.prazo,
      observacoes: v.observacoes === "" ? null : v.observacoes,
    },
  };
}
