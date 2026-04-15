import { z } from "zod";
import { parseCurrencyString } from "@/lib/currencyUtils";

/** Campo de data obrigatória */
export const dataVencimentoField = z.date({ required_error: "Data é obrigatória" });

/** Campo de descrição obrigatória */
export const descricaoField = z.string().min(1, "Descrição é obrigatória");

/** Campo de valor monetário (string formatada R$) com validação > 0 */
export const valorCurrencyField = z
  .string()
  .min(1, "Valor é obrigatório")
  .refine((val) => parseCurrencyString(val) > 0, { message: "Valor deve ser maior que zero" });

/** Campo de parcelas (1-60) */
export const parcelasField = z
  .string()
  .default("1")
  .refine(
    (val) => {
      const num = parseInt(val);
      return num >= 1 && num <= 60;
    },
    { message: "Parcelas deve ser entre 1 e 60" }
  );

/** Campo opcional com default string vazia */
export const optionalStringField = z.string().optional().default("");
