/**
 * E-mails de autenticação (Supabase Auth via auth-email-hook). Classe plataforma.
 * Layout curto: cabeçalho editorial com o título, botão no corpo, aviso de segurança.
 */

import { BRAND } from "../brand.ts";
import { html } from "../html.ts";
import { button, em, shell, small, strong } from "../layout.ts";
import type { EmailTemplate } from "./types.ts";

const FOOTER_AUTH = `Este e-mail foi enviado pela ${BRAND.nome} em resposta a uma ação na sua conta.`;

export function templateRecuperacaoSenha(link: string): EmailTemplate {
  return {
    subject: "Redefinir sua senha",
    html: shell({
      preview: "Crie uma nova senha de acesso",
      footerNote: FOOTER_AUTH,
      hero: {
        titulo: html`Redefinir sua ${em("senha")}`,
        lead: html`Crie uma nova senha pelo botão abaixo. O link vale por ${strong("1 hora")}.`,
      },
      content: [
        button("Redefinir senha", link, { mt: 0 }),
        small("Se você não pediu a redefinição, ignore este e-mail. Sua senha atual continua valendo."),
      ],
    }),
  };
}

export function templateConviteUsuario(link: string, nome?: string): EmailTemplate {
  return {
    subject: `Seu convite para a ${BRAND.nome}`,
    html: shell({
      preview: `Você foi convidado para a ${BRAND.nome}`,
      footerNote: FOOTER_AUTH,
      hero: {
        titulo: html`Seu ${em("convite")} chegou`,
        lead: nome
          ? html`Olá, ${strong(nome)}. Sua equipe abriu um acesso para você. Aceite o convite para criar sua senha e
            começar.`
          : html`Sua equipe abriu um acesso para você. Aceite o convite para criar sua senha e começar.`,
      },
      content: [
        button("Aceitar convite", link, { mt: 0 }),
        small(html`O convite vale por ${strong("24 horas")}. Se você não esperava este e-mail, ignore.`),
      ],
    }),
  };
}

export function templateMagicLink(link: string): EmailTemplate {
  return {
    subject: "Seu link de acesso",
    html: shell({
      preview: "Entre sem senha por este link",
      footerNote: FOOTER_AUTH,
      hero: {
        titulo: html`Seu link de ${em("acesso")}`,
        lead: html`Entre pelo botão abaixo. O link vale por ${strong("10 minutos")} e funciona uma vez só.`,
      },
      content: [button("Entrar", link, { mt: 0 }), small("Se você não pediu este link, ignore este e-mail.")],
    }),
  };
}

export function templateConfirmacaoCadastro(link: string): EmailTemplate {
  return {
    subject: "Confirme seu e-mail",
    html: shell({
      preview: "Confirme seu endereço para ativar a conta",
      footerNote: FOOTER_AUTH,
      hero: {
        titulo: html`Confirme seu ${em("e-mail")}`,
        lead: "Falta um passo: confirme este endereço para ativar sua conta.",
      },
      content: [
        button("Confirmar e-mail", link, { mt: 0 }),
        small(html`Se você não criou uma conta na ${BRAND.nome}, ignore este e-mail.`),
      ],
    }),
  };
}
