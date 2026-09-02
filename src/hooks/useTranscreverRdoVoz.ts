import { useMutation } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { reportInvokeError } from "@/lib/monitoring";
import type { RdoVozExtracao } from "@/lib/obras";

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o áudio gravado"));
    reader.readAsDataURL(blob);
  });
}

export interface RefLista {
  id: string;
  nome: string;
}

interface TranscreverRdoVozInput {
  blob: Blob;
  mimeType: string;
  /** Cadastro da empresa, pro backend casar sugestão de efetivo/visita (spec 086). */
  fornecedores: RefLista[];
  /** Tarefas abertas do cronograma da obra, pro backend casar sugestão de tarefa (spec 086). */
  tarefasAbertas: RefLista[];
}

/**
 * Transcreve um áudio curto do RDO via edge ai-rdo-voz (spec 080), com
 * sugestões estruturadas casadas contra fornecedores/tarefas reais (spec
 * 085). O áudio some da memória do navegador assim que a resposta chega —
 * não é persistido nem aqui nem no backend.
 */
export function useTranscreverRdoVoz() {
  return useMutation({
    mutationFn: async ({
      blob,
      mimeType,
      fornecedores,
      tarefasAbertas,
    }: TranscreverRdoVozInput): Promise<RdoVozExtracao> => {
      const audioBase64 = await blobParaBase64(blob);
      const { data, error } = await supabase.functions.invoke("ai-rdo-voz", {
        body: { audioBase64, mimeType, fornecedores, tarefasAbertas },
      });
      if (error) {
        let motivo = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const corpo = await error.context.json();
            if (corpo?.error) motivo = corpo.error;
          } catch {
            // corpo não-JSON: mantém a mensagem genérica
          }
        }
        reportInvokeError(error, "ai-rdo-voz");
        throw new Error(motivo);
      }
      return data as RdoVozExtracao;
    },
  });
}
