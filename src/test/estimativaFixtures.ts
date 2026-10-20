// Dados de teste da estimativa de obra (SPEC 136). Os parâmetros vêm da própria migration: se o seed
// deixar de passar no schema, os testes de tela caem junto.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcularEstimativa, fichaInicial } from "@/lib/estimativaObra";
import type { Insumos } from "@/pages/obras/estimativa/hooks";
import {
  parametrosSchema,
  type CubLinha,
  type Ficha,
  type Parametros,
  type ResultadoEstimativa,
} from "@/schemas/estimativaObra";

function parametrosDaMigration(): Parametros {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261114000100_estimativa_obra.sql"), "utf8");
  return parametrosSchema.parse(JSON.parse(sql.match(/\$json\$([\s\S]*?)\$json\$/)![1]));
}

const linha = (uf: CubLinha["uf"], subtipo: string, padrao: CubLinha["padrao"], valor: number): CubLinha => ({
  uf,
  subtipo,
  padrao,
  mes_base: "2026-09-01",
  valor_m2: valor,
});

export const CUB_FIXTURE: CubLinha[] = [
  linha("SP", "R1", "baixo", 2150),
  linha("SP", "R1", "normal", 2700),
  linha("SP", "R1", "alto", 3350),
  linha("SP", "R8", "normal", 2450),
  linha("SP", "CSL-8", "normal", 2600),
  linha("SP", "CSL-8", "alto", 3150),
  linha("SP", "GI", "unico", 1500),
];

export const FICHA_SOBRADO: Ficha = {
  ...fichaInicial("2027-03"),
  subtipo: "sobrado",
  padrao: "alto",
  area: 320,
  pavimentos: 2,
  terreno: 600,
  quartos: 4,
  suites: 4,
  banheiros: 5,
  lavabo: 1,
  vagas: 4,
  piscina: 32,
  gourmet: true,
  paisagismo: true,
  marcenaria: "completa",
};

export function insumosProntos(validado = false): Extract<Insumos, { estado: "ok" }> {
  return { estado: "ok", cub: CUB_FIXTURE, parametros: parametrosDaMigration(), ajustes: null, validado };
}

export function resultadoDoSobrado(validado = false): ResultadoEstimativa {
  const i = insumosProntos(validado);
  const saida = calcularEstimativa({
    ficha: FICHA_SOBRADO,
    cub: i.cub,
    parametros: i.parametros,
    parametrosValidados: validado,
  });
  if (!saida.ok) throw new Error(saida.mensagem);
  return saida.resultado;
}
