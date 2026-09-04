/**
 * E-mails que o escritório manda ao cliente final, via Pilar. Classe "escritorio":
 * cabeçalho com nome e logo da empresa, rodapé "Enviado por X via Pilar".
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
import type { EmailTemplate, EmpresaHeader } from "./types.ts";

function header(empresa: EmpresaHeader) {
  return { tipo: "escritorio" as const, nome: empresa.nome, logoUrl: empresa.logoUrl };
}

export function templateMensagemManual(params: {
  assunto: string;
  mensagem: string;
  empresa: EmpresaHeader;
}): EmailTemplate {
  const { assunto, mensagem, empresa } = params;
  return {
    subject: assunto,
    html: shell({
      preview: mensagem.slice(0, 140),
      header: header(empresa),
      hero: { titulo: assunto },
      content: [
        paragraph(multiline(mensagem), { mt: 0 }),
        divider(),
        small(html`Mensagem de ${strong(empresa.nome)}. Responda este e-mail para falar com a equipe.`, { mt: 0 }),
      ],
    }),
  };
}

export function templateCobrancaDireta(params: {
  clienteNome: string;
  empresa: EmpresaHeader;
  descricao: string;
  valorFormatado: string;
  dataVencimento: string;
  vencida: boolean;
  pixChave?: string;
  pixInstrucoes?: string;
}): EmailTemplate {
  const { clienteNome, empresa, descricao, valorFormatado, dataVencimento, vencida, pixChave, pixInstrucoes } = params;

  const pix = pixChave
    ? [spacer(26), label("Chave Pix"), codeBox(pixChave), ...(pixInstrucoes ? [small(pixInstrucoes, { mt: 8 })] : [])]
    : [];

  return {
    subject: vencida ? `Fatura em atraso: ${descricao}` : `Lembrete de pagamento: ${descricao}`,
    html: shell({
      preview: vencida ? `Fatura em atraso, ${valorFormatado}` : `Vence em ${dataVencimento}, ${valorFormatado}`,
      header: header(empresa),
      footerNote: `Você recebeu esta cobrança de ${empresa.nome} via ${BRAND.nome}.`,
      hero: {
        titulo: vencida ? html`Fatura ${emphasis(em("em atraso"), "negative")}` : html`${em("Lembrete")} de pagamento`,
        lead: vencida
          ? html`Olá, ${strong(clienteNome)}. A fatura abaixo venceu e continua em aberto.`
          : html`Olá, ${strong(clienteNome)}. Segue a cobrança referente ao serviço abaixo.`,
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
        small(html`Enviado por ${strong(empresa.nome)}. Em caso de dúvida, responda este e-mail.`, { mt: 0 }),
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
  empresa?: EmpresaHeader;
}): EmailTemplate {
  const { nomeCliente, email, senha, loginUrl, isReset = false, empresa } = params;

  return {
    subject: isReset ? "Sua senha do portal foi redefinida" : "Seu acesso ao portal do cliente",
    html: shell({
      preview: isReset ? "Nova senha do portal do cliente" : "Credenciais de acesso ao portal",
      header: empresa ? header(empresa) : { tipo: "plataforma" },
      footerNote: empresa
        ? `Acesso criado por ${empresa.nome} via ${BRAND.nome}.`
        : `Você recebeu este e-mail porque um escritório criou seu acesso ao portal.`,
      hero: {
        titulo: isReset ? html`Sua senha foi ${em("redefinida")}` : html`Seu acesso ao ${em("portal do cliente")}`,
        lead: isReset
          ? html`Olá, ${strong(nomeCliente)}. A senha do seu acesso foi trocada. Use as credenciais abaixo.`
          : html`Olá, ${strong(nomeCliente)}. Pelo portal você acompanha o andamento do projeto, entregas e aprovações.`,
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
  empresa: EmpresaHeader;
  mensagem?: string;
}): EmailTemplate {
  const { nomeCliente, tituloProposta, empresa, mensagem } = params;
  return {
    subject: tituloProposta,
    html: shell({
      preview: `${tituloProposta}, enviada por ${empresa.nome}`,
      header: header(empresa),
      footerNote: `Você recebeu esta proposta de ${empresa.nome} via ${BRAND.nome}.`,
      hero: {
        titulo: html`Sua ${em("proposta")} chegou`,
        lead: html`Olá, ${strong(nomeCliente)}. ${strong(empresa.nome)} enviou uma proposta para você. O documento está
        anexo a este e-mail.`,
      },
      content: [
        card([kv("Proposta", tituloProposta)], { mt: 0 }),
        ...(mensagem ? [paragraph(multiline(mensagem), { mt: 24 })] : []),
        divider(),
        small(html`Enviado por ${strong(empresa.nome)}. Dúvidas? Responda este e-mail.`, { mt: 0 }),
      ],
    }),
  };
}
