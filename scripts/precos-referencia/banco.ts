// Acesso ao banco da coleta de preços de referência, por SQL direto.
//
// Usa o `SUPABASE_DB_URL` que os environments `Staging` e `production-automation` do GitHub já têm (o mesmo do
// backup noturno e da auditoria): nada de chave nova. Conecta como dono do banco, então a RLS de ultra admin não
// se aplica; por isso o script só toca as três tabelas abaixo, e cada gravação é uma transação (ou entra o mês
// inteiro da UF, ou nada).
import postgres from "postgres";
import type { Regime } from "@/schemas/estimativaObra";
import type { MesBase } from "./fonte.ts";
import type { LinhaCub } from "./cub.ts";

export interface LinhaSinapiParaGravar {
  codigo: number;
  uf: string;
  regime: Regime;
  mes_base: string;
  valor: number;
  origem: "C" | "CR";
  descricao: string;
  unidade: string;
}

export interface CubGravado {
  uf: string;
  subtipo: string;
  padrao: string;
  mes_base: string;
  regime: string;
  valor_m2: number;
}

export type Tabela = "cub_valores" | "sinapi_precos_insumo";

const mesTexto = (d: unknown): string =>
  d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? "").slice(0, 10);

export function abrirBanco(url: string) {
  if (!url) throw new Error("Falta SUPABASE_DB_URL.");
  // prepare: false porque o pooler do Supabase em modo transação não guarda statement preparado.
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 30, onnotice: () => {} });

  return {
    /** Mês mais novo com os dois regimes (o mais velho dos dois), ou null se algum regime não tem nada. */
    async ultimoMes(tabela: Tabela): Promise<MesBase | null> {
      const linhas = await sql<{ regime: string; mes: unknown }[]>`
        SELECT regime, max(mes_base) AS mes FROM ${sql(tabela)} GROUP BY regime`;
      const porRegime = new Map(linhas.map((l) => [l.regime, mesTexto(l.mes)]));
      const on = porRegime.get("onerado");
      const des = porRegime.get("desonerado");
      if (!on || !des) return null;
      return on < des ? on : des;
    },

    async parametros(): Promise<unknown> {
      const [linha] = await sql<{ parametros: unknown }[]>`
        SELECT parametros FROM public.estimativa_parametros WHERE id = 'default'`;
      if (!linha) throw new Error("Os parâmetros da estimativa não estão no banco.");
      return linha.parametros;
    },

    async fonteSinapi(mes: MesBase): Promise<string | null> {
      const [linha] = await sql<{ fonte: string }[]>`
        SELECT fonte FROM public.sinapi_precos_insumo WHERE mes_base = ${mes} LIMIT 1`;
      return linha?.fonte ?? null;
    },

    async gravarSinapi(linhas: LinhaSinapiParaGravar[], fonte: string): Promise<void> {
      if (linhas.length === 0) return;
      await sql.begin(async (tx) => {
        const valores = linhas.map((l) => ({ ...l, fonte }));
        for (let i = 0; i < valores.length; i += 500) {
          await tx`
            INSERT INTO public.sinapi_precos_insumo
              ${tx(valores.slice(i, i + 500), "codigo", "uf", "regime", "mes_base", "valor", "origem", "descricao", "unidade", "fonte")}
            ON CONFLICT (codigo, uf, regime, mes_base) DO UPDATE SET
              valor = EXCLUDED.valor, origem = EXCLUDED.origem, descricao = EXCLUDED.descricao,
              unidade = EXCLUDED.unidade, fonte = EXCLUDED.fonte, created_at = now()`;
        }
      });
    },

    async cubDesde(mes: MesBase): Promise<CubGravado[]> {
      const linhas = await sql<(Omit<CubGravado, "valor_m2" | "mes_base"> & { valor_m2: string; mes_base: unknown })[]>`
        SELECT uf, subtipo, padrao, mes_base, regime, valor_m2 FROM public.cub_valores WHERE mes_base >= ${mes}`;
      return linhas.map((l) => ({ ...l, mes_base: mesTexto(l.mes_base), valor_m2: Number(l.valor_m2) }));
    },

    async gravarCub(linhas: LinhaCub[], fonte: string): Promise<void> {
      if (linhas.length === 0) return;
      await sql.begin(async (tx) => {
        await tx`
          INSERT INTO public.cub_valores
            ${tx(
              linhas.map((l) => ({ ...l, fonte })),
              "uf",
              "subtipo",
              "padrao",
              "mes_base",
              "regime",
              "valor_m2",
              "fonte"
            )}
          ON CONFLICT (uf, subtipo, padrao, mes_base, regime) DO UPDATE SET
            valor_m2 = EXCLUDED.valor_m2, fonte = EXCLUDED.fonte, created_at = now()`;
      });
    },

    async fechar(): Promise<void> {
      await sql.end({ timeout: 5 });
    },
  };
}

export type Banco = ReturnType<typeof abrirBanco>;

/**
 * Banco de mentira para a sondagem: nada gravado, nada lido além dos parâmetros dados. Serve para conferir as
 * fontes reais (Caixa, CBIC, portais) sem credencial, por exemplo no PR.
 */
export function bancoDeSondagem(parametros: unknown, ultimoSinapi: MesBase): Banco {
  return {
    ultimoMes: async (tabela: Tabela) => (tabela === "sinapi_precos_insumo" ? ultimoSinapi : null),
    parametros: async () => parametros,
    fonteSinapi: async () => null,
    gravarSinapi: async () => {},
    cubDesde: async () => [],
    gravarCub: async () => {},
    fechar: async () => {},
  };
}
