import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/**
 * Dados do painel do /inicio (SPEC 092, ADR 0037 e 0038).
 *
 * Uma chamada agregada para a tela inteira, por módulo do produto: gestao,
 * projetos, obras, mais financeiro. O bloco `financeiro` vem NULO para quem não
 * passa em `can_view_financeiro()` no servidor, então a tela não precisa
 * esconder nada: o dado não chega.
 *
 * O shape é validado com Zod na fronteira (ADR 0033): se o SQL mudar de
 * formato, falha aqui com erro claro em vez de renderizar `undefined` no meio
 * de um gráfico.
 */

const num = z.number().nullable().default(null);

const totaisProjetos = z.object({
  ativos: z.number(),
  emAndamento: z.number(),
  planejamento: z.number(),
  paralisado: z.number(),
  atrasados: z.number(),
  risco: z.number(),
  semPrazo: z.number(),
  concluidosAno: z.number(),
});

const painelSchema = z.object({
  gestao: z.object({
    propostasTotais: z.object({
      enviadas: z.number(),
      ganhas: z.number(),
      perdidas: z.number(),
      aguardando: z.number(),
      conversaoPct: num,
    }),
    funil: z.array(z.object({ etapa: z.string(), n: z.number() })),
    conversaoMensal: z.array(z.object({ mes: z.string(), ganhas: z.number(), perdidas: z.number() })),
    motivosPerda: z.array(z.object({ motivo: z.string(), n: z.number() })),
    esperaProposta: z.array(z.object({ faixa: z.string(), n: z.number() })),
    origemGanho: z.array(z.object({ origem: z.string(), leads: z.number(), ganhoPct: num })),
    throughputSemanal: z.array(z.object({ semana: z.string(), n: z.number() })),
    cargaEquipe: z.array(
      z.object({ pessoaId: z.string(), nome: z.string(), emDia: z.number(), atrasada: z.number() })
    ),
    filaAprovacao: z.array(
      z.object({
        escopoId: z.string(),
        tipo: z.string(),
        projetoId: z.string(),
        projeto: z.string(),
        dias: z.number(),
      })
    ),
  }),
  projetos: z.object({
    totais: totaisProjetos,
    statusAtivos: z.array(z.object({ status: z.string(), n: z.number() })),
    pontualidadeMensal: z.array(z.object({ mes: z.string(), pct: num, total: z.number() })),
    atrasoPorDisciplina: z.array(
      z.object({ disciplina: z.string(), diasMedio: z.number(), entregas: z.number() })
    ),
    prazos15Dias: z.array(
      z.object({
        disciplinaId: z.string(),
        disciplina: z.string(),
        projetoId: z.string(),
        projeto: z.string(),
        dias: z.number(),
        responsavel: z.string().nullable().default(null),
      })
    ),
    horasPorProjeto: z.array(
      z.object({
        projetoId: z.string(),
        projeto: z.string(),
        estimadas: z.coerce.number(),
        realizadas: z.coerce.number(),
        desvioPct: num,
      })
    ),
  }),
  obras: z.object({
    totais: z.object({
      emAndamento: z.number(),
      planejadas: z.number(),
      paralisadas: z.number(),
      atrasadas: z.number(),
    }),
    rdoPorObra: z.array(
      z.object({
        obraId: z.string(),
        obra: z.string(),
        ultimoRdo: z.string().nullable().default(null),
        diasSemRdo: num,
      })
    ),
    avancoPorObra: z.array(
      z.object({
        obraId: z.string(),
        obra: z.string(),
        concluidas: z.number(),
        total: z.number(),
        pct: num,
      })
    ),
  }),
  // Nulo, e não ausente, quando o usuário não pode ver dinheiro.
  financeiro: z
    .object({
      mes: z.object({ recebido: z.number(), aReceber: z.number(), receberVencido: z.number() }),
      despesaMes: z.object({ pago: z.number(), aPagar: z.number(), pagarVencido: z.number() }),
      faturamento: z.array(z.object({ mes: z.string(), previsto: z.number(), faturado: z.number() })),
      margemPorProjeto: z.array(z.object({ projetoId: z.string(), projeto: z.string(), pct: num })),
    })
    .nullable(),
  cobertura: z.object({
    desde: z.string().nullable().default(null),
    projetosSemPrazo: z.number(),
    leadsSemMotivoPadrao: z.number(),
  }),
});

export type PainelGestao = z.infer<typeof painelSchema>;
export type PainelSecao = "gestao" | "projetos" | "obras" | "financeiro";

export function usePainelGestao(enabled = true) {
  return useQuery({
    queryKey: ["painel-gestao"],
    enabled,
    queryFn: async (): Promise<PainelGestao> => {
      const { data, error } = await supabase.rpc("get_painel_gestao");
      if (error) throw error;

      const parsed = painelSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(`Painel veio em formato inesperado: ${parsed.error.issues[0]?.message}`);
      }
      return parsed.data;
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
}
