import { supabase } from "@/integrations/supabase/client";
import { mensagemDaFunction } from "@/lib/edgeError";

/**
 * Google Drive da empresa (SPEC 163): chamadas às Edge Functions `google-drive` e
 * `google-drive-oauth`, e o envio direto do arquivo para o Google.
 */

export const MIME_PASTA = "application/vnd.google-apps.folder";

export interface ItemDrive {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
}

export interface PastaDrive {
  pasta_id: string;
  pasta_pai_id: string | null;
  projeto_id: string;
  projeto_disciplina_id: string | null;
  nome: string;
}

/** Erro com o código que a função devolve (nao_conectado, reconectar, sumiu). */
export class ErroDrive extends Error {
  constructor(
    mensagem: string,
    public codigo?: string
  ) {
    super(mensagem);
  }
}

export const ehPasta = (item: Pick<ItemDrive, "mimeType">) => item.mimeType === MIME_PASTA;

async function invocar<T>(funcao: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(funcao, { body });
  if (error) {
    let codigo: string | undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      codigo = ((await ctx?.clone().json()) as { codigo?: string } | null)?.codigo;
    } catch {
      // corpo não é JSON: fica só a mensagem
    }
    throw new ErroDrive(await mensagemDaFunction(error, fallback), codigo);
  }
  return data as T;
}

export const pastaDoProjeto = (projetoId: string) =>
  invocar<{ raiz: PastaDrive | null; pastas: PastaDrive[] }>(
    "google-drive",
    { acao: "pasta_projeto", projeto_id: projetoId },
    "Não foi possível abrir a pasta do projeto."
  );

export const listarPasta = (pastaId: string) =>
  invocar<{ pasta: PastaDrive; itens: ItemDrive[] }>(
    "google-drive",
    { acao: "listar", pasta_id: pastaId },
    "Não foi possível listar a pasta."
  );

export const criarPasta = (pastaPaiId: string, nome: string) =>
  invocar<{ item: ItemDrive }>(
    "google-drive",
    { acao: "criar_pasta", pasta_pai_id: pastaPaiId, nome },
    "Não foi possível criar a pasta."
  );

export const moverParaLixeira = (arquivoId: string) =>
  invocar<{ ok: true }>("google-drive", { acao: "lixeira", arquivo_id: arquivoId }, "Não foi possível excluir.");

/** Baixa o arquivo; documento do Google (sem binário) volta como link para abrir. */
export async function baixarArquivo(item: ItemDrive): Promise<void> {
  const r = await invocar<Blob | { abrir?: string }>(
    "google-drive",
    { acao: "baixar", arquivo_id: item.id },
    "Não foi possível baixar o arquivo."
  );
  if (!(r instanceof Blob)) {
    if (r?.abrir) window.open(r.abrir, "_blank", "noopener,noreferrer");
    return;
  }
  const url = URL.createObjectURL(r);
  const a = document.createElement("a");
  a.href = url;
  a.download = item.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Envia o arquivo: a função abre a sessão retomável e o navegador manda o binário direto
 * para o Google (não passa pela Pilar). XHR por causa do progresso.
 */
export async function enviarArquivo(
  pastaId: string,
  arquivo: File,
  aoProgredir?: (fracao: number) => void
): Promise<ItemDrive> {
  const { upload_url } = await invocar<{ upload_url: string }>(
    "google-drive",
    {
      acao: "iniciar_upload",
      pasta_id: pastaId,
      nome: arquivo.name,
      mime: arquivo.type || "application/octet-stream",
      tamanho: arquivo.size,
    },
    "Não foi possível iniciar o envio."
  );
  return new Promise<ItemDrive>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", upload_url);
    xhr.upload.onprogress = (e) => e.lengthComputable && aoProgredir?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as ItemDrive);
        } catch {
          resolve({ id: "", name: arquivo.name, mimeType: arquivo.type });
        }
      } else reject(new ErroDrive(`O Google Drive recusou o envio de ${arquivo.name}.`));
    };
    xhr.onerror = () => reject(new ErroDrive(`Falha de rede ao enviar ${arquivo.name}.`));
    xhr.send(arquivo);
  });
}

/** URL de consentimento do Google; `retorno` é a página para onde o Google devolve. */
export const iniciarConexaoDrive = (retorno: string) =>
  invocar<{ url: string }>(
    "google-drive-oauth",
    { acao: "iniciar", retorno },
    "Não foi possível abrir o Google para conectar."
  );

export const desconectarDrive = () =>
  invocar<{ ok: true }>("google-drive-oauth", { acao: "desconectar" }, "Não foi possível desconectar.");

/** Leva o admin ao consentimento do Google; o Google devolve para a página atual. */
export async function conectarGoogleDrive(
  retorno = `${window.location.pathname}${window.location.search}${window.location.hash}`
) {
  const { url } = await iniciarConexaoDrive(retorno);
  window.location.assign(url);
}

/** Lê e tira da URL o `?drive=` que o retorno do Google deixa. */
export function lerRetornoDoDrive(): "conectado" | "erro" | "negado" | null {
  const url = new URL(window.location.href);
  const v = url.searchParams.get("drive");
  if (v !== "conectado" && v !== "erro" && v !== "negado") return null;
  url.searchParams.delete("drive");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  return v;
}
