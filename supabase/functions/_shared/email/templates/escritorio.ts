/**
 * E-mails que o escritório manda ao cliente final, via Pilar. Classe "escritorio":
 * header com nome/logo da empresa, rodapé "Enviado por X via Pilar".
 */

import { BRAND } from "../brand.ts";
import { html, multiline } from "../html.ts";
import {
  accent,
  button,
  callout,
  card,
  codeBox,
  divider,
  emphasis,
  kv,
  kvDivider,
  label,
  lead,
  paragraph,
  shell,
  small,
  spacer,
  strong,
  title,
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
      preview: mensagem.slice(0, 120),
      header: header(empresa),
      content: [
        title(assunto),
        paragraph(multiline(mensagem), { mt: 20 }),
        divider(),
        small(
          html`Mensagem enviada por ${strong(empresa.nome)}. Para responder, use o botão de resposta do seu e-mail.`,
          { mt: 0 }
        ),
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

  const tituloHtml = vencida
    ? html`Fatura ${emphasis("em atraso", "negative")}`
    : html`${accent("Lembrete")} de pagamento`;
  const intro = vencida
    ? html`Olá, ${strong(clienteNome)}. A fatura abaixo venceu e continua em aberto.`
    : html`Olá, ${strong(clienteNome)}. Segue a cobrança referente ao serviço abaixo.`;

  const pix = pixChave
    ? [spacer(28), label("Chave Pix"), codeBox(pixChave), ...(pixInstrucoes ? [small(pixInstrucoes, { mt: 8 })] : [])]
    : [];

  return {
    subject: vencida ? `Fatura em atraso: ${descricao}` : `Lembrete de pagamento: ${descricao}`,
    html: shell({
      preview: vencida ? `Fatura em atraso, ${valorFormatado}` : `Lembrete de pagamento, ${valorFormatado}`,
      header: header(empresa),
      footerNote: `Você recebeu esta cobrança de ${empresa.nome} via ${BRAND.nome}.`,
      content: [
        title(tituloHtml),
        lead(intro),
        card(
          [
            kv("Descrição", descricao),
            kvDivider(),
            kv("Valor", valorFormatado, { size: "xl" }),
            kvDivider(),
            kv("Vencimento", dataVencimento, { tone: vencida ? "negative" : undefined }),
          ],
          { accent: vencida ? "negative" : "brand" }
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
  const tituloHtml = isReset
    ? html`Sua senha foi ${accent("redefinida")}`
    : html`Seu acesso ao ${accent("portal do cliente")}`;
  const intro = isReset
    ? html`Olá, ${strong(nomeCliente)}. A senha do seu acesso ao portal foi redefinida. Use as credenciais abaixo.`
    : html`Olá, ${strong(nomeCliente)}. Seu acesso ao portal foi criado. Por ele você acompanha o andamento do projeto,
      entregas e aprovações.`;

  return {
    subject: isReset ? "Sua senha do portal do cliente foi redefinida" : "Seu acesso ao portal do cliente",
    html: shell({
      preview: isReset ? "Senha redefinida, portal do cliente" : "Acesso ao portal do cliente",
      header: empresa ? header(empresa) : { tipo: "plataforma" },
      footerNote: empresa
        ? `Acesso criado por ${empresa.nome} via ${BRAND.nome}.`
        : `Você recebeu este e-mail porque um escritório criou seu acesso ao portal do ${BRAND.nome}.`,
      content: [
        title(tituloHtml),
        lead(intro),
        card([kv("E-mail", email), kvDivider(), kv("Senha temporária", senha, { mono: true, size: "lg" })]),
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
      preview: `${tituloProposta}, proposta enviada por ${empresa.nome}`,
      header: header(empresa),
      footerNote: `Você recebeu esta proposta de ${empresa.nome} via ${BRAND.nome}.`,
      content: [
        title(html`Nova ${accent("proposta")}`),
        lead(
          html`Olá, ${strong(nomeCliente)}. ${strong(empresa.nome)} enviou uma proposta para você. O documento está
          anexo a este e-mail.`
        ),
        card([kv("Proposta", tituloProposta)]),
        ...(mensagem ? [paragraph(multiline(mensagem), { mt: 24 })] : []),
        divider(),
        small(html`Enviado por ${strong(empresa.nome)}. Dúvidas? Responda este e-mail.`, { mt: 0 }),
      ],
    }),
  };
}
