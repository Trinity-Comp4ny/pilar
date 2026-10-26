import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safeError";

interface CamposDeParcela {
  parcelas?: string;
  dia_pagamento?: string;
  cliente_id?: string;
}

export interface ParcelasDoForm {
  numParcelas: number;
  diaFixo: number;
  /** Número e dia válidos: é a condição para gerar parcelas ao criar o projeto. */
  geraParcelas: boolean;
  /** As parcelas entram no financeiro com o cliente do projeto: sem cliente, nascem órfãs. */
  faltaCliente: boolean;
}

export function parcelasDoForm(form: CamposDeParcela): ParcelasDoForm {
  const numParcelas = parseInt(form.parcelas || "0", 10);
  const diaFixo = parseInt(form.dia_pagamento || "0", 10);
  const geraParcelas = numParcelas > 0 && diaFixo >= 1 && diaFixo <= 31;
  return { numParcelas, diaFixo, geraParcelas, faltaCliente: geraParcelas && !form.cliente_id };
}

/** Gera as parcelas do contrato (dia fixo) logo depois de criar o projeto e avisa o resultado. */
export async function gerarParcelasDoProjeto(projetoId: string, { numParcelas, diaFixo }: ParcelasDoForm) {
  const { error } = await (
    supabase.rpc as unknown as (
      name: "rpc_gerar_parcelas_dia_fixo",
      args: { p_projeto_id: string; p_num_parcelas: number; p_dia_fixo: number }
    ) => Promise<{ error: { message: string } | null }>
  )("rpc_gerar_parcelas_dia_fixo", { p_projeto_id: projetoId, p_num_parcelas: numParcelas, p_dia_fixo: diaFixo });
  if (error) {
    toast.error("Projeto salvo, mas as parcelas não foram geradas", {
      description: getSafeErrorMessage(error, "Gere as parcelas de novo na aba de pagamentos."),
    });
    return;
  }
  toast.success(`${numParcelas} parcela(s) geradas`, { description: `Vencimento dia ${diaFixo} de cada mês` });
}
