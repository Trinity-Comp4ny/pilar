// Chamada da função `ai-estimativa-itens` (SPEC 138, BEZ-83) e saldo de tokens mostrado antes de rodar. A resposta
// passa por schema na fronteira: o que não bate vira o estado "resposta inválida" da tela, nunca um item na ficha.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { interpretacaoSchema, type Interpretacao } from "./interpretacao";

export type TipoDeFalha = "bloqueio" | "erro" | "invalida";

export class FalhaDaIa extends Error {
  constructor(
    message: string,
    readonly tipo: TipoDeFalha
  ) {
    super(message);
  }
}

const TIPOS_DE_SAIDA_INVALIDA = new Set(["saida_invalida", "saida_truncada"]);

/**
 * Separa o que a pessoa resolve (saldo, limite, trial, texto curto ou longo demais: a mensagem do servidor já diz o
 * próximo passo) do que é falha do provedor e do que é resposta que a tela não consegue usar.
 */
export function classificarFalha(status: number | undefined, corpo: { error?: unknown; tipo?: unknown } | null) {
  const mensagem = typeof corpo?.error === "string" && corpo.error ? corpo.error : null;
  if (status !== undefined && [400, 402, 403, 429].includes(status) && mensagem) {
    return { tipo: "bloqueio", mensagem } as const;
  }
  if (typeof corpo?.tipo === "string" && TIPOS_DE_SAIDA_INVALIDA.has(corpo.tipo)) {
    return {
      tipo: "invalida",
      mensagem: mensagem ?? "A resposta da IA veio num formato que não deu para usar.",
    } as const;
  }
  return { tipo: "erro", mensagem: mensagem ?? "Não consegui falar com a IA agora." } as const;
}

async function interpretar(descricao: string): Promise<Interpretacao> {
  const { data, error } = await supabase.functions.invoke("ai-estimativa-itens", { body: { descricao } });
  if (error) {
    const status = error instanceof FunctionsHttpError ? error.context.status : undefined;
    const corpo = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    const falha = classificarFalha(status, corpo);
    throw new FalhaDaIa(falha.mensagem, falha.tipo);
  }
  const lida = interpretacaoSchema.safeParse(data);
  if (!lida.success) throw new FalhaDaIa("A resposta da IA veio num formato que não deu para usar.", "invalida");
  return lida.data;
}

export function useInterpretarObra() {
  return useMutation({ mutationFn: interpretar });
}

/** Saldo de tokens da empresa (plano + comprado), para dizer quanto sobra antes de gastar. null = não carregou. */
export function useSaldoDeTokens() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;
  return useQuery({
    queryKey: ["ai-token-saldo", empresaId],
    enabled: !!empresaId,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from("ai_token_saldo")
        .select("saldo_plano, saldo_comprado")
        .eq("empresa_id", empresaId!)
        .maybeSingle();
      if (error || !data) return null;
      return (data.saldo_plano ?? 0) + (data.saldo_comprado ?? 0);
    },
  });
}
