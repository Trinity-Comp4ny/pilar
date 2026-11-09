import { textoObrigatorio, uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({
  token: textoObrigatorio("token ausente"),
  registro_id: uuidObrigatorio("registro_id inválido"),
});

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);

/** Quem pode abrir os arquivos de um registro: só a conta que o gravou, na própria obra (ADR 0062). */
export function ehDoDono(
  sessao: { account_id?: string; obra_id?: string },
  registro: { obra_id: string; autor_campo_account_id: string | null }
): boolean {
  return Boolean(
    sessao.account_id &&
    sessao.obra_id &&
    registro.autor_campo_account_id === sessao.account_id &&
    registro.obra_id === sessao.obra_id
  );
}
