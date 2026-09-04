/**
 * E-mails de autenticação (Supabase Auth via auth-email-hook). Classe plataforma.
 * Layout curto: título, uma frase, botão, aviso de segurança.
 */

import { BRAND } from "../brand.ts";
import { html } from "../html.ts";
import { accent, button, lead, shell, small, strong, title } from "../layout.ts";
import type { EmailTemplate } from "./types.ts";

const FOOTER_AUTH = `Este e-mail foi enviado pelo ${BRAND.nome} em resposta a uma ação na sua conta.`;

export function templateRecuperacaoSenha(link: string): EmailTemplate {
  return {
    subject: `Redefinir senha, ${BRAND.nome}`,
    html: shell({
      preview: `Redefina sua senha no ${BRAND.nome}`,
      footerNote: FOOTER_AUTH,
      content: [
        title(html`Redefinir ${accent("senha")}`),
        lead(html`Clique no botão para criar uma nova senha. O link expira em ${strong("1 hora")}.`),
        button("Redefinir senha", link),
        small("Se você não pediu a redefinição, ignore este e-mail. Sua senha atual continua valendo."),
      ],
    }),
  };
}

export function templateConviteUsuario(link: string, nome?: string): EmailTemplate {
  const saudacao = nome ? html`Olá, ${strong(nome)}.` : html`Olá.`;
  return {
    subject: `Você foi convidado para o ${BRAND.nome}`,
    html: shell({
      preview: `Você foi convidado para o ${BRAND.nome}`,
      footerNote: FOOTER_AUTH,
      content: [
        title(html`Bem-vindo ao ${accent(BRAND.nome)}`),
        lead(
          html`${saudacao} Você foi convidado a acessar o ${BRAND.nome}. Aceite o convite para criar sua senha e entrar.`
        ),
        button("Aceitar convite", link),
        small(html`O convite expira em ${strong("24 horas")}. Se você não esperava este e-mail, ignore.`),
      ],
    }),
  };
}

export function templateMagicLink(link: string): EmailTemplate {
  return {
    subject: `Seu link de acesso, ${BRAND.nome}`,
    html: shell({
      preview: `Seu link de acesso ao ${BRAND.nome}`,
      footerNote: FOOTER_AUTH,
      content: [
        title(html`Seu link de ${accent("acesso")}`),
        lead(html`Clique no botão para entrar. O link expira em ${strong("10 minutos")} e só funciona uma vez.`),
        button(`Entrar no ${BRAND.nome}`, link),
        small("Se você não pediu este link, ignore este e-mail."),
      ],
    }),
  };
}

export function templateConfirmacaoCadastro(link: string): EmailTemplate {
  return {
    subject: `Confirme seu e-mail, ${BRAND.nome}`,
    html: shell({
      preview: `Confirme seu e-mail para ativar a conta`,
      footerNote: FOOTER_AUTH,
      content: [
        title(html`Confirme seu ${accent("e-mail")}`),
        lead("Clique no botão para confirmar seu endereço e ativar a conta."),
        button("Confirmar e-mail", link),
        small(html`Se você não criou uma conta no ${BRAND.nome}, ignore este e-mail.`),
      ],
    }),
  };
}
