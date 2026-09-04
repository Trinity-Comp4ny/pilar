import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/**
 * Painel de gestão do /inicio (SPEC 092, ADR 0037).
 *
 * Uma chamada agregada para a tela inteira, em vez das ~12 queries de linha do
 * `useDashboardData`. O shape é validado com Zod na fronteira (ADR 0033): se o
 * SQL mudar de formato, a tela falha aqui com erro claro em vez de renderizar
 * `undefined` no meio de um gráfico.
 *
 * Nenhum campo é monetário, de propósito. Ver ADR 0037.
 */

const numeroOuNulo = z.number().nullable().default(null);

const ancoraConversao = z.object({
  valor: numeroOuNulo,
  anterior: numeroOuNulo,
  decididas: z.number().default(0),
});
const ancoraPrazo = z.object({ valor: numeroOuNulo, anterior: numeroOuNulo });
const ancoraSemana = z.object({ valor: z.number().default(0), media: numeroOuNulo });
const ancoraDesvio = z.object({ valor: numeroOuNulo });
const ancoraEspera = z.object({ valor: z.number().default(0), parados: z.number().default(0) });

const painelSchema = z.object({
  ancoras: z.object({
    conversao: ancoraConversao,
    prazo: ancoraPrazo,
    concluidasSemana: ancoraSemana,
    desvioHoras: ancoraDesvio,
    aguardandoCliente: ancoraEspera,
  }),
  comercial: z.object({
    funil: z.array(z.object({ etapa: z.string(), n: z.number() })),
    conversaoMensal: z.array(z.object({ mes: z.string(), ganhas: z.number(), perdidas: z.number() })),
    motivosPerda: z.array(z.object({ motivo: z.string(), n: z.number() })),
    esperaProposta: z.array(z.object({ faixa: z.string(), n: z.number() })),
    origemGanho: z.array(z.object({ origem: z.string(), leads: z.number(), ganhoPct: numeroOuNulo })),
  }),
  entrega: z.object({
    semaforo: z.object({
      noPrazo: z.number(),
      risco: z.number(),
      estourado: z.number(),
      semPrazo: z.number(),
    }),
    statusAtivos: z.array(z.object({ status: z.string(), n: z.number() })),
    pontualidadeMensal: z.array(z.object({ mes: z.string(), pct: numeroOuNulo, total: z.number() })),
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
        iniciais: z.string().nullable().default(null),
      })
    ),
  }),
  produtividade: z.object({
    throughputSemanal: z.array(z.object({ semana: z.string(), n: z.number() })),
    horasPorProjeto: z.array(
      z.object({
        projetoId: z.string(),
        projeto: z.string(),
        estimadas: z.coerce.number(),
        realizadas: z.coerce.number(),
        desvioPct: numeroOuNulo,
      })
    ),
    cargaEquipe: z.array(
      z.object({
        pessoaId: z.string(),
        nome: z.string(),
        iniciais: z.string(),
        emDia: z.number(),
        atrasada: z.number(),
      })
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
  cobertura: z.object({
    desde: z.string().nullable().default(null),
    projetosSemPrazo: z.number(),
    propostasSemHistorico: z.number(),
    leadsSemMotivoPadrao: z.number(),
  }),
});

export type PainelGestao = z.infer<typeof painelSchema>;
export type PrazoDisciplina = PainelGestao["entrega"]["prazos15Dias"][number];
export type CargaPessoa = PainelGestao["produtividade"]["cargaEquipe"][number];
export type HorasProjeto = PainelGestao["produtividade"]["horasPorProjeto"][number];
export type Aprovacao = PainelGestao["produtividade"]["filaAprovacao"][number];

export function usePainelGestao(enabled = true) {
  return useQuery({
    queryKey: ["painel-gestao"],
    enabled,
    queryFn: async (): Promise<PainelGestao> => {
      const { data, error } = await supabase.rpc("get_painel_gestao");
      if (error) throw error;

      const parsed = painelSchema.safeParse(data);
      if (!parsed.success) {
        // Formato do SQL divergiu do que a tela espera: falha cedo e clara
        // (ADR 0033), em vez de quebrar dentro de um gráfico.
        throw new Error(`Painel de gestão veio em formato inesperado: ${parsed.error.issues[0]?.message}`);
      }
      return parsed.data;
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
}
