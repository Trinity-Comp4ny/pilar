/**
 * Módulo de e-mail do Pilar (ADR 0039). Importar daqui, nunca dos arquivos internos:
 *   import { sendEmail, templateConviteUsuario } from "../_shared/email/index.ts";
 */

export { sendEmail, type EmailClasse, type EmailEmpresa, type SendEmailInput, type SendEmailResult } from "./client.ts";
export { BRAND } from "./brand.ts";
export { em } from "./layout.ts";
export type { EmailTemplate } from "./templates/types.ts";

export {
  templateConfirmacaoCadastro,
  templateConviteUsuario,
  templateMagicLink,
  templateRecuperacaoSenha,
} from "./templates/auth.ts";
export {
  templateAcessoPortalCliente,
  templateCobrancaDireta,
  templateMensagemManual,
  templatePropostaEnvio,
} from "./templates/escritorio.ts";
export { templateLgpdExclusaoDados, templateTrialAviso } from "./templates/plataforma.ts";
export {
  MAX_ITENS_EMAIL,
  templateNotificacoes,
  type NotifCategoria,
  type NotificacoesParams,
  type NotifItem,
  type NotifSeveridade,
} from "./templates/notificacoes.ts";
