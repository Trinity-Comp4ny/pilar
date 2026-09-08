/**
 * E-mails que o escritório manda ao cliente final, via Pilar.
 *
 * O cabeçalho é sempre o da Pilar: o escritório aparece nomeado no texto, no
 * rodapé e no remetente ("<Empresa> via Pilar", com reply-to no e-mail dela).
 * Sem logo de terceiro no cabeçalho, que exigiria curar o ativo de cada cliente.
 */

import { BRAND } from "../brand.ts";
import { html, multiline } from "../html.ts";
import {
  button,
  callout,
  card,
  codeBox,
  divider,
  em,
  emphasis,
  kv,
  kvDivider,
  label,
  paragraph,
  shell,
  small,
  spacer,
  strong,
} from "../layout.ts";
import type { EmailTemplate } from "./types.ts";

const rodape = (empresaNome: string) => `Enviado por ${empresaNome} via ${BRAND.nome}.`;

export function templateMensagemManual(params: {
  assunto: string;
  mensagem: string;
  empresaNome: string;
}): EmailTemplate {
  const { assunto, mensagem, empresaNome } = params;
  return {
    subject: assunto,
    html: shell({
      preview: mensagem.slice(0, 140),
      footerNote: rodape(empresaNome),
      hero: {
        titulo: assunto,
        lead: html`${strong(empresaNome)} enviou esta mensagem para você.`,
      },
      content: [
        paragraph(multiline(mensagem), { mt: 0 }),
        divider(),
        small(html`Responda este e-mail para falar com a equipe de ${strong(empresaNome)}.`, { mt: 0 }),
      ],
    }),
  };
}

export function templateCobrancaDireta(params: {
  clienteNome: string;
  empresaNome: string;
  descricao: string;
  valorFormatado: string;
  dataVencimento: string;
  vencida: boolean;
  pixChave?: string;
  pixInstrucoes?: string;
}): EmailTemplate {
  const { clienteNome, empresaNome, descricao, valorFormatado, dataVencimento, vencida, pixChave, pixInstrucoes } =
    params;

  const pix = pixChave
    ? [spacer(26), label("Chave Pix"), codeBox(pixChave), ...(pixInstrucoes ? [small(pixInstrucoes, { mt: 8 })] : [])]
    : [];

  return {
    subject: vencida ? `Fatura em atraso: ${descricao}` : `Lembrete de pagamento: ${descricao}`,
    html: shell({
      preview: vencida ? `Fatura em atraso, ${valorFormatado}` : `Vence em ${dataVencimento}, ${valorFormatado}`,
      footerNote: `Você recebeu esta cobrança de ${empresaNome} via ${BRAND.nome}.`,
      hero: {
        titulo: vencida ? html`Fatura ${emphasis(em("em atraso"), "negative")}` : html`${em("Lembrete")} de pagamento`,
        lead: vencida
          ? html`Olá, ${strong(clienteNome)}. A fatura de ${strong(empresaNome)} abaixo venceu e continua em aberto.`
          : html`Olá, ${strong(clienteNome)}. ${strong(empresaNome)} enviou esta cobrança referente ao serviço abaixo.`,
      },
      content: [
        card(
          [
            kv("Descrição", descricao),
            kvDivider(),
            kv("Valor", valorFormatado, { size: "xl" }),
            kvDivider(),
            kv("Vencimento", dataVencimento, { tone: vencida ? "negative" : undefined }),
          ],
          { accent: vencida ? "negative" : "brand", mt: 0 }
        ),
        ...pix,
        divider(),
        small(html`Em caso de dúvida, responda este e-mail: ele vai direto para ${strong(empresaNome)}.`, { mt: 0 }),
      ],
    }),
  };
}

export function templateAcessoPortalCliente(params: {
  nomeCliente: string;
  email: string;
  senha: string;
  loginUrl: string;
  isReset?: boolean;
  empresaNome?: string;
}): EmailTemplate {
  const { nomeCliente, email, senha, loginUrl, isReset = false, empresaNome } = params;
  const quem = empresaNome ? strong(empresaNome) : "Seu escritório";

  return {
    subject: isReset ? "Sua senha do portal foi redefinida" : "Seu acesso ao portal do cliente",
    html: shell({
      preview: isReset ? "Nova senha do portal do cliente" : "Credenciais de acesso ao portal",
      footerNote: empresaNome
        ? `Acesso criado por ${empresaNome} via ${BRAND.nome}.`
        : "Você recebeu este e-mail porque um escritório criou seu acesso ao portal.",
      hero: {
        titulo: isReset ? html`Sua senha foi ${em("redefinida")}` : html`Seu acesso ao ${em("portal do cliente")}`,
        lead: isReset
          ? html`Olá, ${strong(nomeCliente)}. ${quem} redefiniu a senha do seu acesso. Use as credenciais abaixo.`
          : html`Olá, ${strong(nomeCliente)}. ${quem} criou seu acesso ao portal, onde você acompanha o andamento do
            projeto, entregas e aprovações.`,
      },
      content: [
        card([kv("E-mail", email), kvDivider(), kv("Senha temporária", senha, { mono: true, size: "lg" })], { mt: 0 }),
        button("Acessar portal", loginUrl),
        callout("Troque a senha no primeiro acesso. Esta senha é temporária e foi enviada só para você.", "info"),
      ],
    }),
  };
}

export function templatePropostaEnvio(params: {
  nomeCliente: string;
  tituloProposta: string;
  empresaNome: string;
  mensagem?: string;
}): EmailTemplate {
  const { nomeCliente, tituloProposta, empresaNome, mensagem } = params;
  return {
    subject: tituloProposta,
    html: shell({
      preview: `${tituloProposta}, enviada por ${empresaNome}`,
      footerNote: `Você recebeu esta proposta de ${empresaNome} via ${BRAND.nome}.`,
      hero: {
        titulo: html`Sua ${em("proposta")} chegou`,
        lead: html`Olá, ${strong(nomeCliente)}. ${strong(empresaNome)} enviou uma proposta para você. O documento está
        anexo a este e-mail.`,
      },
      content: [
        card([kv("Proposta", tituloProposta)], { mt: 0 }),
        ...(mensagem ? [paragraph(multiline(mensagem), { mt: 24 })] : []),
        divider(),
        small(html`Dúvidas? Responda este e-mail: ele vai direto para ${strong(empresaNome)}.`, { mt: 0 }),
      ],
    }),
  };
}
