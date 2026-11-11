/**
 * Versão dos documentos legais no momento do aceite (SPEC 049).
 * Bump aqui quando /termos ou /privacidade mudar de forma material; usuários
 * que já aceitaram uma versão anterior não são forçados a re-aceitar
 * automaticamente (fora de escopo da v1, ver spec).
 */
export const TERMS_VERSION = "2.0";
export const PRIVACY_VERSION = "2.1";

/**
 * Data em que a versão atual dos Termos passa a valer para quem aceitou uma anterior
 * (aviso de 30 dias por e-mail, cláusula 15). Até lá o administrador vê uma faixa que
 * pode adiar; depois, precisa aceitar para seguir usando. Mesma data de `/termos`.
 */
export const TERMS_VIGENCIA_ISO = "2026-12-10T00:00:00-03:00";
export const TERMS_VIGENCIA_TEXTO = "10 de dezembro de 2026";

/** A versão atual dos Termos já vale para quem aceitou a anterior? */
export function termosVigentes(agora: number = Date.now()): boolean {
  return agora >= Date.parse(TERMS_VIGENCIA_ISO);
}
