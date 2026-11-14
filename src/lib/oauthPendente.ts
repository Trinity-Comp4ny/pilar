/**
 * Pedido de autorização OAuth à espera de login (SPEC 151).
 *
 * O ChatGPT/Claude manda o usuário para /oauth/autorizar?authorization_id=... Se ele não está
 * logado (ou falta o segundo fator), a tela guarda o id aqui e manda para o login. Login por
 * senha, Google e MFA terminam em /inicio; o PrivateRoute retoma o pedido de lá.
 *
 * sessionStorage: vale só para esta aba e morre com ela. O id sozinho não dá acesso a nada (o
 * Supabase Auth confere a sessão de quem aprova), então não é dado sensível.
 */
const CHAVE = "pilar_oauth_autorizacao";
const FORMATO = /^[A-Za-z0-9_-]{8,128}$/;

export const ROTA_AUTORIZAR = "/oauth/autorizar";

/** O id tem o formato que o Supabase Auth gera? Evita levar lixo da URL adiante. */
export function idDeAutorizacaoValido(id: string | null | undefined): id is string {
  return typeof id === "string" && FORMATO.test(id);
}

export function guardarAutorizacaoPendente(id: string): void {
  if (!idDeAutorizacaoValido(id)) return;
  try {
    sessionStorage.setItem(CHAVE, id);
  } catch {
    // Aba privada ou armazenamento bloqueado: o usuário refaz a conexão pelo ChatGPT/Claude.
  }
}

/**
 * Pedido pendente, sem apagar: o PrivateRoute lê durante o render (que o StrictMode roda duas
 * vezes). Quem apaga é a tela de autorização, quando assume o pedido.
 */
export function autorizacaoPendente(): string | null {
  try {
    const id = sessionStorage.getItem(CHAVE);
    return idDeAutorizacaoValido(id) ? id : null;
  } catch {
    return null;
  }
}

export function limparAutorizacaoPendente(): void {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    // Sem armazenamento, não há o que limpar.
  }
}

/** Troca de página inteira (o retorno é outro site, ex.: chatgpt.com). */
export function irPara(url: string): void {
  window.location.assign(url);
}

/** Rota da tela de autorização para um id. */
export function rotaDeAutorizacao(id: string): string {
  return `${ROTA_AUTORIZAR}?authorization_id=${encodeURIComponent(id)}`;
}

/**
 * Para onde o navegador volta depois da decisão. O endereço vem do Supabase Auth, mas o
 * cliente foi registrado por terceiro: só segue para http(s) ou para o esquema próprio de um
 * app de desktop, nunca javascript: ou data:.
 */
export function redirecionamentoSeguro(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const destino = new URL(url);
    const esquema = destino.protocol.replace(/:$/, "").toLowerCase();
    if (["javascript", "data", "vbscript", "file", "blob"].includes(esquema)) return null;
    return destino.toString();
  } catch {
    return null;
  }
}

/** Host para mostrar ao usuário ("você volta para chatgpt.com"); null se não der para ler. */
export function hostDoRetorno(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const destino = new URL(url);
    return destino.host || destino.protocol.replace(/:$/, "");
  } catch {
    return null;
  }
}
