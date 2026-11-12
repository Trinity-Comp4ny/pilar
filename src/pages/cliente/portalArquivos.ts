import { supabase } from "@/integrations/supabase/client";
import { getPortalToken } from "@/hooks/useClienteAuth";
import { mensagemDaFunction } from "@/lib/edgeError";

/**
 * Arquivos da pasta "Cliente" do projeto, vistos pelo cliente no portal (SPEC 163).
 * A sessão é a do portal (token no sessionStorage), não a do app.
 */

export interface ArquivoPortal {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

export interface ConteudoPortal {
  /** null quando o escritório não tem Drive conectado ou o projeto ainda não tem a pasta. */
  pasta: { id: string } | null;
  caminho?: { id: string; nome: string }[];
  itens: ArquivoPortal[];
}

const MIME_PASTA = "application/vnd.google-apps.folder";
export const ehPastaPortal = (a: Pick<ArquivoPortal, "mimeType">) => a.mimeType === MIME_PASTA;
const ehDocumentoGoogle = (a: Pick<ArquivoPortal, "mimeType">) =>
  a.mimeType.startsWith("application/vnd.google-apps.") && !ehPastaPortal(a);

async function chamar<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const session_token = getPortalToken();
  if (!session_token) throw new Error("Sessão expirada. Entre de novo no portal.");
  const { data, error } = await supabase.functions.invoke("portal-arquivos", { body: { ...body, session_token } });
  if (error) throw new Error(await mensagemDaFunction(error, fallback));
  return data as T;
}

export const listarArquivosPortal = (projetoId: string, pastaId?: string) =>
  chamar<ConteudoPortal>(
    { acao: "listar", projeto_id: projetoId, ...(pastaId ? { pasta_id: pastaId } : {}) },
    "Não foi possível abrir os arquivos."
  );

/** Baixa o arquivo; documento do Google chega como PDF. */
export async function baixarArquivoPortal(projetoId: string, arquivo: ArquivoPortal): Promise<void> {
  const blob = await chamar<Blob>(
    { acao: "baixar", projeto_id: projetoId, arquivo_id: arquivo.id },
    "Não foi possível baixar o arquivo."
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ehDocumentoGoogle(arquivo) ? `${arquivo.name}.pdf` : arquivo.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
