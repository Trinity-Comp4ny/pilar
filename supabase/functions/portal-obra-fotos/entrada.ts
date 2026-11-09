import { textoObrigatorio, validar, z } from "../_shared/schemas.ts";

export const MAX_FOTOS = 30;
export const MAX_REGISTROS = 60;

const listaDeUuid = (campo: string, max: number) =>
  z
    .array(z.unknown(), { invalid_type_error: `${campo} inválido` })
    .max(max, `${campo} inválido`)
    .pipe(z.array(z.string().uuid(`${campo} inválido`)))
    .default([]);

export const entradaSchema = z.object({
  session_token: textoObrigatorio("session_token obrigatório"),
  // Fotos de RDO (spec 087) e registros da equipe liberados ao cliente (SPEC 135, fase C).
  foto_ids: listaDeUuid("foto_ids", MAX_FOTOS),
  registro_ids: listaDeUuid("registro_ids", MAX_REGISTROS),
});

export function lerEntrada(corpo: unknown) {
  const r = validar(entradaSchema, corpo);
  if (!r.ok) return r;
  if (r.data.foto_ids.length === 0 && r.data.registro_ids.length === 0) {
    return { ok: false as const, error: "foto_ids obrigatório" };
  }
  return r;
}
