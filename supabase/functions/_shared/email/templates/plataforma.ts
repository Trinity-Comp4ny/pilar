/**
 * E-mails da Pilar para quem administra uma empresa: trial e LGPD. Classe plataforma.
 */

import { BRAND } from "../brand.ts";
import { html } from "../html.ts";
import {
  button,
  callout,
  card,
  divider,
  em,
  emphasis,
  kv,
  kvDivider,
  link,
  paragraph,
  shell,
  small,
  strong,
} from "../layout.ts";
import type { EmailTemplate } from "./types.ts";

export function templateTrialAviso(params: {
  empresaNome: string;
  daysLeft: number;
  billingUrl: string;
}): EmailTemplate {
  const { empresaNome, daysLeft, billingUrl } = params;
  const ultimoDia = daysLeft <= 1;
  const prazo = ultimoDia ? emphasis("amanhã", "negative") : strong(`em ${daysLeft} dias`);

  return {
    subject: ultimoDia ? "Seu trial expira amanhã" : `Seu trial expira em ${daysLeft} dias`,
    html: shell({
      preview: ultimoDia ? "Último dia de trial" : `Faltam ${daysLeft} dias de trial`,
      footerNote: `Você recebeu este e-mail por administrar a empresa ${empresaNome} na ${BRAND.nome}.`,
      hero: {
        titulo: ultimoDia ? html`Seu trial termina ${em("amanhã")}` : html`Seu trial está ${em("acabando")}`,
        lead: html`O período de teste da ${strong(empresaNome)} expira ${prazo}. Assine um plano para seguir sem
        interrupção.`,
      },
      content: [
        callout(
          ultimoDia
            ? "Depois do vencimento a conta fica em modo leitura: seus dados continuam guardados, mas ninguém edita nada."
            : "Ao vencer, a conta entra em modo leitura. Os dados continuam guardados.",
          ultimoDia ? "negative" : "warning",
          { mt: 0 }
        ),
        button("Ver planos", billingUrl),
        small("Dúvidas sobre planos ou nota fiscal? Responda este e-mail."),
      ],
    }),
  };
}

export function templateLgpdExclusaoDados(params: {
  adminNome: string;
  empresaNome: string;
  solicitanteEmail: string;
  solicitanteNome?: string;
  motivo: string | null;
  requestedAt: string;
  adminPanelUrl: string;
  requestId: string;
}): EmailTemplate {
  const { adminNome, empresaNome, solicitanteEmail, solicitanteNome, motivo, requestedAt, adminPanelUrl, requestId } =
    params;
  const solicitante = solicitanteNome ? `${solicitanteNome} (${solicitanteEmail})` : solicitanteEmail;

  return {
    subject: `[LGPD] Solicitação de exclusão de dados, ${empresaNome}`,
    html: shell({
      preview: `Um usuário da ${empresaNome} pediu a exclusão dos próprios dados`,
      footerNote: `Notificação automática da ${BRAND.nome} para o admin responsável (LGPD, art. 18, IV).`,
      hero: {
        titulo: html`Pedido de ${em("exclusão de dados")}`,
        lead: html`Olá, ${strong(adminNome)}. Um usuário da ${strong(empresaNome)} pediu a eliminação dos próprios
        dados, direito previsto no art. 18, IV da LGPD.`,
      },
      content: [
        card(
          [
            kv("Solicitante", solicitante),
            kvDivider(),
            kv("Solicitado em", requestedAt),
            ...(motivo ? [kvDivider(), kv("Motivo informado", motivo)] : []),
            kvDivider(),
            kv("ID da solicitação", requestId, { mono: true }),
          ],
          { accent: "warning", mt: 0 }
        ),
        button("Abrir painel", adminPanelUrl),
        divider(),
        paragraph(
          html`Você tem ${strong("até 15 dias")} para processar a solicitação. Dados sob retenção legal (fiscal,
          auditoria) podem ser mantidos pelo prazo exigido: registre a justificativa no painel.`,
          { mt: 0 }
        ),
        small(
          html`Referência:
          ${link("art. 18 da LGPD", "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm")}.`
        ),
      ],
    }),
  };
}
