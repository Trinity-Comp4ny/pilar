import { supabase } from "@/integrations/supabase/client";
import { lerErro } from "@/lib/registroUpload";
import { getCampoToken } from "./useCampoAuth";

export interface ArquivosDoRegistro {
  audioUrl: string | null;
  fotos: string[];
}

/**
 * URLs assinadas (5 min) das fotos e do áudio de um registro PRÓPRIO, pela edge
 * `campo-registro-arquivos` (SPEC 135, ADR 0062). Lança com uma frase que a tela pode mostrar.
 */
export async function buscarArquivosDoRegistro(registroId: string): Promise<ArquivosDoRegistro> {
  const token = getCampoToken();
  if (!token) throw new Error("Sua sessão venceu. Entre de novo.");
  const { data, error } = await supabase.functions.invoke("campo-registro-arquivos", {
    body: { token, registro_id: registroId },
  });
  if (error) {
    const { status } = await lerErro(error);
    throw new Error(
      status === 401
        ? "Sua sessão venceu. Entre de novo."
        : "Não deu para abrir agora. Confira o sinal e tente de novo."
    );
  }
  const r = data as { audio_url?: string | null; fotos?: string[] } | null;
  return { audioUrl: r?.audio_url ?? null, fotos: r?.fotos ?? [] };
}
