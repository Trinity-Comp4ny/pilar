// Lógica de verificação de CNPJ/CPF (SPEC 098), separada de index.ts de
// propósito: index.ts chama serve(...) no top-level do módulo, então
// importá-lo de um teste ligaria um listener HTTP de verdade. Este arquivo
// não tem side effect nenhum (só faz fetch quando as funções são chamadas),
// é seguro de importar. Mesmo padrão de supabase/functions/lookup-cep/providers.ts.

import { z } from "https://esm.sh/zod@3.23.8";
import { captureException } from "../_shared/sentry.ts";

export type TipoDocumento = "cnpj" | "cpf";

export function apenasDigitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

export function detectarTipoDocumento(digits: string): TipoDocumento | null {
  if (digits.length === 14) return "cnpj";
  if (digits.length === 11) return "cpf";
  return null;
}

// Dígito verificador padrão da Receita (mesmo algoritmo usado por qualquer
// validador de CNPJ). Sem chamada externa: só descarta número obviamente
// inválido antes de gastar uma consulta na BrasilAPI.
export function validarDigitoCnpj(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const calcDigito = (base: string, pesos: number[]): number => {
    const soma = base.split("").reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calcDigito(digits.slice(0, 12), pesos1);
  const d2 = calcDigito(digits.slice(0, 12) + d1, pesos2);

  return digits === digits.slice(0, 12) + String(d1) + String(d2);
}

// Sem API pública gratuita pra CPF (spec 098, fora de escopo verificação
// externa); só o dígito verificador padrão.
export function validarDigitoCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calcDigito = (base: string, pesoInicial: number): number => {
    const soma = base.split("").reduce((acc, d, i) => acc + Number(d) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calcDigito(digits.slice(0, 9), 10);
  const d2 = calcDigito(digits.slice(0, 9) + d1, 11);

  return digits === digits.slice(0, 9) + String(d1) + String(d2);
}

export interface CnpjInfo {
  razaoSocial: string;
  situacaoCadastral: string;
  cnaePrincipal: string | null;
}

export type CnpjConsultaResultado =
  | { status: "ok"; info: CnpjInfo }
  | { status: "indisponivel" }; // BrasilAPI fora do ar / mudou de formato: fica "pendente"

const brasilApiCnpjSchema = z.object({
  razao_social: z.string().min(1),
  descricao_situacao_cadastral: z.string().min(1),
  cnae_fiscal: z.union([z.string(), z.number()]).optional(),
});

export async function consultarCnpjBrasilApi(cnpjDigits: string): Promise<CnpjConsultaResultado> {
  let res: Response;
  try {
    res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`);
  } catch (err) {
    await captureException(err, { fn: "verificar-documento", tags: { provider: "brasilapi", reason: "request-failed" } });
    return { status: "indisponivel" };
  }

  if (res.status === 404) {
    return { status: "indisponivel" };
  }
  if (!res.ok) {
    await captureException(new Error(`BrasilAPI retornou ${res.status}`), {
      fn: "verificar-documento",
      tags: { provider: "brasilapi", reason: "http-error" },
    });
    return { status: "indisponivel" };
  }

  const raw = await res.json();
  const parsed = brasilApiCnpjSchema.safeParse(raw);
  if (!parsed.success) {
    await captureException(new Error("BrasilAPI: formato de resposta do CNPJ mudou"), {
      fn: "verificar-documento",
      tags: { provider: "brasilapi", reason: "shape-mismatch" },
      extra: { issues: parsed.error.issues, raw },
    });
    return { status: "indisponivel" };
  }

  const d = parsed.data;
  return {
    status: "ok",
    info: {
      razaoSocial: d.razao_social,
      situacaoCadastral: d.descricao_situacao_cadastral.toUpperCase(),
      cnaePrincipal: d.cnae_fiscal != null ? String(d.cnae_fiscal) : null,
    },
  };
}

// SITUAÇÕES da Receita que sobem o nível pra Prata (requisito 11 da SPEC 098).
// BAIXADA/INAPTA/SUSPENSA/NULA recusam com mensagem clara.
export function situacaoPermiteSubirNivel(situacao: string): boolean {
  return situacao === "ATIVA";
}
