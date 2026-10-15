import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { analytics } from "@/lib/analytics";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionError";

/**
 * Resumo semanal do Início (SPEC 121, ADR 0058).
 *
 * Leitura: `get_resumo_semanal` devolve o escopo que cabe a quem abre (empresa para quem vê
 * dinheiro, pessoa para os demais) e o resumo da semana, se já existir. Sem resumo, a tela
 * pede a geração UMA vez por semana (edge function `resumo-semanal`); a função responde com
 * o texto da IA ou com o resumo automático quando a IA não pode (sem tokens, falha do
 * provedor, número que não bate nos fatos).
 *
 * Não há botão de atualizar: o resumo é um por semana e escopo, então o gasto de tokens é
 * previsível e não depende de clique.
 *
 * O resumo automático não é gravado no banco. Ele fica no cache do React Query durante a
 * sessão, para voltar ao Início não chamar a função de novo à toa.
 *
 * Os dois formatos são validados com Zod na fronteira (ADR 0033).
 */

const TONS = ["positivo", "atencao", "neutro"] as const;
export type Tom = (typeof TONS)[number];

const conteudoSchema = z.object({
  manchete: z.string(),
  destaques: z.array(z.object({ tom: z.enum(TONS), texto: z.string() })),
});

type ConteudoResumo = z.infer<typeof conteudoSchema>;

const escopoSchema = z.enum(["empresa", "pessoa"]);
type EscopoResumo = z.infer<typeof escopoSchema>;

const leituraSchema = z.object({
  escopo: escopoSchema,
  semana_inicio: z.string(),
  resumo: z.object({ conteudo: conteudoSchema, gerado_em: z.string() }).nullable(),
});

const respostaSchema = z.object({
  escopo: escopoSchema,
  resumo: conteudoSchema,
  origem: z.enum(["ia", "automatico"]),
  motivo: z.string().optional(),
  gerado_em: z.string().optional(),
});

export type ResumoSemanal = {
  escopo: EscopoResumo;
  conteudo: ConteudoResumo;
  origem: "ia" | "automatico";
  /** Por que o texto é automático, em linguagem de usuário. */
  motivo: string | null;
  geradoEm: string | null;
};

const CHAVE_LEITURA = ["resumo-semanal", "leitura"] as const;
const CHAVE_GERADO = ["resumo-semanal", "gerado"] as const;

type Leitura = z.infer<typeof leituraSchema>;
type Resposta = z.infer<typeof respostaSchema>;

function deLeitura(l: Leitura): ResumoSemanal | null {
  if (!l.resumo) return null;
  return {
    escopo: l.escopo,
    conteudo: l.resumo.conteudo,
    origem: "ia",
    motivo: null,
    geradoEm: l.resumo.gerado_em,
  };
}

function deResposta(r: Resposta): ResumoSemanal {
  return {
    escopo: r.escopo,
    conteudo: r.resumo,
    origem: r.origem,
    motivo: r.motivo ?? null,
    geradoEm: r.gerado_em ?? null,
  };
}

export type EstadoResumo = "carregando" | "gerando" | "pronto" | "erro";

export function useResumoSemanal(ativo: boolean) {
  const queryClient = useQueryClient();

  const leitura = useQuery({
    queryKey: CHAVE_LEITURA,
    enabled: ativo,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_resumo_semanal");
      if (error) throw error;
      return leituraSchema.parse(data);
    },
  });

  // Resumo automático (não gravado no banco), guardado no cache da sessão.
  const gerado = useQuery<ResumoSemanal | null>({
    queryKey: CHAVE_GERADO,
    enabled: false,
    staleTime: Infinity,
    queryFn: () => Promise.resolve(null),
  });

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("resumo-semanal", { body: {} });
      if (error) throw new Error(await edgeFunctionErrorMessage(error, "Não foi possível gerar o resumo agora."));
      return respostaSchema.parse(data);
    },
    onSuccess: (resposta) => {
      const resumo = deResposta(resposta);
      if (resumo.origem === "ia") {
        queryClient.setQueryData<Leitura>(CHAVE_LEITURA, (anterior) => ({
          escopo: resposta.escopo,
          semana_inicio: anterior?.semana_inicio ?? "",
          resumo: { conteudo: resposta.resumo, gerado_em: resumo.geradoEm ?? new Date().toISOString() },
        }));
        queryClient.setQueryData(CHAVE_GERADO, null);
      } else {
        queryClient.setQueryData(CHAVE_GERADO, resumo);
      }
      analytics.track("inicio_resumo_exibido", { escopo: resposta.escopo, origem: resposta.origem });
    },
  });

  // Pede a geração uma vez por montagem, só quando a leitura confirmou que a semana não tem
  // resumo e que o automático desta sessão ainda não existe. O ref segura o double-effect do
  // StrictMode.
  const pediu = useRef(false);
  const { mutate } = gerar;
  useEffect(() => {
    if (!ativo || pediu.current) return;
    if (!leitura.data || leitura.data.resumo || gerado.data) return;
    pediu.current = true;
    mutate();
  }, [ativo, leitura.data, gerado.data, mutate]);

  const tentarDeNovo = useCallback(() => {
    pediu.current = false;
    if (leitura.isError) void leitura.refetch();
    else gerar.mutate();
  }, [leitura, gerar]);

  const resumo: ResumoSemanal | null = leitura.data ? (deLeitura(leitura.data) ?? gerado.data ?? null) : null;

  let estado: EstadoResumo = "pronto";
  if (leitura.isLoading) estado = "carregando";
  else if (leitura.isError) estado = "erro";
  else if (gerar.isPending && !resumo) estado = "gerando";
  else if (!resumo && gerar.isError) estado = "erro";
  else if (!resumo) estado = "gerando";

  return {
    estado,
    resumo,
    erro: gerar.error?.message ?? (leitura.error ? "Não foi possível carregar o resumo da semana." : null),
    tentarDeNovo,
  };
}
