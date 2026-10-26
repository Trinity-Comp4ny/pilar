// Providers de busca de CEP, separados de index.ts de propósito: index.ts
// chama serve(...) no top-level do módulo, então importá-lo de um teste
// ligaria um listener HTTP de verdade. Este arquivo não tem side effect
// nenhum (só faz fetch quando as funções são chamadas), é seguro de importar.

import { z } from "https://esm.sh/zod@3.23.8";
import { captureException } from "../_shared/sentry.ts";
import { fetchComTempo } from "../_shared/http.ts";

export interface CepResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

// CEP de cidade pequena não tem logradouro nem bairro: os providers devolvem
// null (não só ausente). Esses campos são nullish de propósito (PILAR-3M/3K).
const brasilApiSchema = z.object({
  cep: z.string().nullish(),
  city: z.string().min(1),
  state: z.string().min(1),
  street: z.string().nullish(),
  neighborhood: z.string().nullish(),
});

const viaCepSchema = z.union([
  z.object({ erro: z.literal(true) }),
  z.object({
    cep: z.string().nullish(),
    logradouro: z.string().nullish(),
    bairro: z.string().nullish(),
    localidade: z.string().min(1),
    uf: z.string().min(1),
  }),
]);

export async function fromBrasilApi(cepDigits: string): Promise<CepResult | null> {
  const res = await fetchComTempo(`https://brasilapi.com.br/api/cep/v2/${cepDigits}`, {}, 5_000);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`BrasilAPI retornou ${res.status}`);
  const raw = await res.json();
  const parsed = brasilApiSchema.safeParse(raw);
  if (!parsed.success) {
    await captureException(new Error("BrasilAPI: formato de resposta mudou"), {
      fn: "lookup-cep",
      tags: { provider: "brasilapi", reason: "shape-mismatch" },
      extra: { issues: parsed.error.issues, raw },
    });
    return null;
  }
  const d = parsed.data;
  return {
    cep: d.cep ?? cepDigits,
    street: d.street ?? "",
    neighborhood: d.neighborhood ?? "",
    city: d.city,
    state: d.state,
  };
}

export async function fromViaCep(cepDigits: string): Promise<CepResult | null> {
  const res = await fetchComTempo(`https://viacep.com.br/ws/${cepDigits}/json/`, {}, 5_000);
  if (!res.ok) throw new Error(`ViaCEP retornou ${res.status}`);
  const raw = await res.json();
  const parsed = viaCepSchema.safeParse(raw);
  if (!parsed.success) {
    await captureException(new Error("ViaCEP: formato de resposta mudou"), {
      fn: "lookup-cep",
      tags: { provider: "viacep", reason: "shape-mismatch" },
      extra: { issues: parsed.error.issues, raw },
    });
    return null;
  }
  if ("erro" in parsed.data) return null;
  const d = parsed.data;
  return {
    cep: d.cep ?? cepDigits,
    street: d.logradouro ?? "",
    neighborhood: d.bairro ?? "",
    city: d.localidade,
    state: d.uf,
  };
}
