/**
 * Google Drive da empresa (SPEC 163): OAuth, cifra do refresh token e as chamadas à API
 * do Drive que as funções `google-drive-oauth` e `google-drive` usam.
 *
 * Escopo `drive.file`: a Pilar só enxerga o que ela cria ou o que o usuário escolhe por
 * ela. É escopo não sensível (sem a auditoria anual que o escopo `drive` exige).
 *
 * Toda chamada recebe `fetch` por parâmetro (padrão: o global) para o teste trocar a rede.
 */
import { fetchComTempo } from "./http.ts";

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const ESCOPOS = "openid email https://www.googleapis.com/auth/drive.file";
export const MIME_PASTA = "application/vnd.google-apps.folder";
const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const TOKEN = "https://oauth2.googleapis.com/token";

export interface ConfigGoogle {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Erro da API do Google com o status HTTP, para a função decidir a resposta. */
export class ErroGoogle extends Error {
  constructor(
    public status: number,
    mensagem: string
  ) {
    super(mensagem);
  }
}

// ---------------------------------------------------------------- OAuth

export function urlDeAutorizacao(cfg: ConfigGoogle, estado: string, emailSugerido?: string): string {
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: ESCOPOS,
    access_type: "offline",
    // consent: garante o refresh_token mesmo quando a conta já autorizou antes.
    prompt: "consent",
    include_granted_scopes: "true",
    state: estado,
  });
  if (emailSugerido) p.set("login_hint", emailSugerido);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

/** State aleatório (vai na URL) e o hash dele (vai para o banco). */
export async function novoEstado(): Promise<{ estado: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const estado = base64Url(bytes);
  return { estado, hash: await hashDoEstado(estado) };
}

export async function hashDoEstado(estado: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(estado));
  return base64Url(new Uint8Array(digest));
}

export interface TokensGoogle {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
}

export async function trocarCodigo(cfg: ConfigGoogle, code: string, f: Fetch = fetch): Promise<TokensGoogle> {
  const r = await fetchComTempo(
    TOKEN,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.redirectUri,
        grant_type: "authorization_code",
      }),
    },
    undefined,
    f
  );
  if (!r.ok) throw new ErroGoogle(r.status, "Google recusou o código de autorização");
  return (await r.json()) as TokensGoogle;
}

export async function tokenDeAcesso(cfg: ConfigGoogle, refreshToken: string, f: Fetch = fetch): Promise<string> {
  const r = await fetchComTempo(
    TOKEN,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: "refresh_token",
      }),
    },
    undefined,
    f
  );
  // 400 invalid_grant: a conta revogou o acesso pelo Google. A tela pede para reconectar.
  if (!r.ok) throw new ErroGoogle(r.status === 400 ? 401 : r.status, "Conexão com o Google Drive expirou");
  return ((await r.json()) as TokensGoogle).access_token;
}

export async function revogar(token: string, f: Fetch = fetch): Promise<void> {
  await fetchComTempo(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    undefined,
    f
  );
}

/**
 * E-mail da conta, lido do id_token. Sem conferir a assinatura de propósito: o token
 * veio direto do endpoint do Google, por TLS, na troca do código feita por nós.
 */
export function emailDoIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const partes = idToken.split(".");
  if (partes.length !== 3) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(deBase64Url(partes[1])));
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- cifra do token

/** AES-GCM com chave de 32 bytes em base64. Saída: "v1:<iv>:<cifrado>" em base64url. */
export async function cifrar(texto: string, chaveBase64: string): Promise<string> {
  const chave = await importarChave(chaveBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, new TextEncoder().encode(texto));
  return `v1:${base64Url(iv)}:${base64Url(new Uint8Array(ct))}`;
}

export async function decifrar(cifrado: string, chaveBase64: string): Promise<string> {
  const [versao, iv, ct] = cifrado.split(":");
  if (versao !== "v1" || !iv || !ct) throw new Error("token cifrado em formato desconhecido");
  const chave = await importarChave(chaveBase64);
  const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64Url(iv) }, chave, deBase64Url(ct));
  return new TextDecoder().decode(claro);
}

async function importarChave(chaveBase64: string): Promise<CryptoKey> {
  const bruto = Uint8Array.from(atob(chaveBase64), (c) => c.charCodeAt(0));
  if (bruto.length !== 32) throw new Error("GOOGLE_DRIVE_TOKEN_KEY precisa ter 32 bytes em base64");
  return crypto.subtle.importKey("raw", bruto, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// ---------------------------------------------------------------- Drive

export interface ItemDrive {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
}

const CAMPOS_ITEM = "id,name,mimeType,size,modifiedTime,webViewLink,iconLink,parents";

/** Id de arquivo do Drive: letras, números, - e _. Barra injeção na consulta `q`. */
export function idDriveValido(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(id);
}

/** Nome de pasta ou arquivo: sem caractere de controle, espaços colapsados, até 200. */
export function nomeLimpo(nome: string): string {
  return (
    nome
      // Tirar caractere de controle é o objetivo deste regex.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200)
  );
}

async function drive<T>(token: string, url: string, init: RequestInit = {}, f: Fetch = fetch): Promise<T> {
  const r = await fetchComTempo(
    url,
    { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } },
    undefined,
    f
  );
  if (!r.ok) throw new ErroGoogle(r.status, `Google Drive respondeu ${r.status}`);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

export function criarPasta(token: string, nome: string, paiId: string, f: Fetch = fetch): Promise<ItemDrive> {
  return drive<ItemDrive>(
    token,
    `${DRIVE}/files?fields=${CAMPOS_ITEM}&supportsAllDrives=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nomeLimpo(nome), mimeType: MIME_PASTA, ...(paiId ? { parents: [paiId] } : {}) }),
    },
    f
  );
}

/** Pastas primeiro, depois arquivos, cada grupo por nome. */
export async function listarFilhos(token: string, pastaId: string, f: Fetch = fetch): Promise<ItemDrive[]> {
  if (!idDriveValido(pastaId)) throw new ErroGoogle(400, "pasta inválida");
  const itens: ItemDrive[] = [];
  let pagina: string | undefined;
  do {
    const p = new URLSearchParams({
      q: `'${pastaId}' in parents and trashed = false`,
      fields: `nextPageToken,files(${CAMPOS_ITEM})`,
      orderBy: "folder,name",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pagina) p.set("pageToken", pagina);
    const r = await drive<{ files: ItemDrive[]; nextPageToken?: string }>(token, `${DRIVE}/files?${p}`, {}, f);
    itens.push(...(r.files ?? []));
    pagina = r.nextPageToken;
  } while (pagina && itens.length < 1000);
  return itens;
}

export function metadados(token: string, id: string, f: Fetch = fetch): Promise<ItemDrive> {
  if (!idDriveValido(id)) throw new ErroGoogle(400, "arquivo inválido");
  return drive<ItemDrive>(token, `${DRIVE}/files/${id}?fields=${CAMPOS_ITEM}&supportsAllDrives=true`, {}, f);
}

export function moverParaLixeira(token: string, id: string, f: Fetch = fetch): Promise<ItemDrive> {
  if (!idDriveValido(id)) throw new ErroGoogle(400, "arquivo inválido");
  return drive<ItemDrive>(
    token,
    `${DRIVE}/files/${id}?fields=id&supportsAllDrives=true`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) },
    f
  );
}

export async function baixar(token: string, id: string, f: Fetch = fetch): Promise<Response> {
  if (!idDriveValido(id)) throw new ErroGoogle(400, "arquivo inválido");
  // Sem tempo limite curto: arquivo grande leva mais que 15 s para descer.
  const r = await f(`${DRIVE}/files/${id}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new ErroGoogle(r.status, `Google Drive respondeu ${r.status}`);
  return r;
}

/**
 * Abre um upload retomável e devolve a URL da sessão. O navegador manda o arquivo direto
 * para essa URL (o binário não passa pela Pilar). O `Origin` vai junto para o Google
 * liberar o CORS do PUT feito pelo navegador.
 */
export async function iniciarUpload(
  token: string,
  dados: { nome: string; mime: string; tamanho: number; paiId: string; origin: string },
  f: Fetch = fetch
): Promise<string> {
  const r = await fetchComTempo(
    `${UPLOAD}?uploadType=resumable&supportsAllDrives=true&fields=${CAMPOS_ITEM}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": dados.mime || "application/octet-stream",
        "X-Upload-Content-Length": String(dados.tamanho),
        Origin: dados.origin,
      },
      body: JSON.stringify({ name: nomeLimpo(dados.nome), parents: [dados.paiId] }),
    },
    undefined,
    f
  );
  const local = r.headers.get("Location");
  if (!r.ok || !local) throw new ErroGoogle(r.status || 502, "Google Drive não abriu o envio");
  return local;
}

// ---------------------------------------------------------------- base64url

function base64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
