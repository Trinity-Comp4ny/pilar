/**
 * E-mails da Pilar para quem administra uma empresa: trial e LGPD. Classe plataforma.
 */

import { BRAND } from "../brand.ts";
import { html, multiline } from "../html.ts";
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
    subject: ultimoDia ? "Seu teste grátis termina amanhã" : `Seu teste grátis termina em ${daysLeft} dias`,
    html: shell({
      preview: ultimoDia ? "Último dia de teste grátis" : `Faltam ${daysLeft} dias de teste grátis`,
      footerNote: `Você recebeu este e-mail por administrar a empresa ${empresaNome} na ${BRAND.nome}.`,
      hero: {
        titulo: ultimoDia ? html`Seu teste termina ${em("amanhã")}` : html`Seu teste está ${em("acabando")}`,
        lead: html`O teste grátis da ${strong(empresaNome)} termina ${prazo}. Ative o plano agora para seguir sem
        interrupção: a primeira cobrança só acontece no fim do teste.`,
      },
      content: [
        callout(
          ultimoDia
            ? "Depois do vencimento a conta fica em modo leitura: seus dados continuam guardados, mas ninguém edita nada."
            : "Ao vencer, a conta entra em modo leitura. Os dados continuam guardados.",
          ultimoDia ? "negative" : "warning",
          { mt: 0 }
        ),
        button("Ativar plano", billingUrl),
        small("Dúvidas sobre planos ou nota fiscal? Responda este e-mail."),
      ],
    }),
  };
}

// SPEC 104: avisa no momento em que o teste vence sem cartão. É o e-mail que
// traz de volta quem testou e sumiu, então o botão leva direto pra assinar.
export function templateTrialExpirado(params: { empresaNome: string; billingUrl: string }): EmailTemplate {
  const { empresaNome, billingUrl } = params;

  return {
    subject: "Seu teste grátis do Pilar terminou",
    html: shell({
      preview: "Seus dados continuam guardados. Assine para voltar a editar.",
      footerNote: `Você recebeu este e-mail por administrar a empresa ${empresaNome} na ${BRAND.nome}.`,
      hero: {
        titulo: html`Seu teste ${em("terminou")}`,
        lead: html`O teste grátis da ${strong(empresaNome)} chegou ao fim e a conta entrou em modo leitura. Nada foi
        apagado: assine um plano e volte a editar na hora.`,
      },
      content: [
        callout("Sem um plano ativo, os dados ficam 90 dias em modo leitura e depois são excluídos.", "warning", {
          mt: 0,
        }),
        button("Assinar e voltar a editar", billingUrl),
        small("Quer conversar antes de assinar? Responda este e-mail."),
      ],
    }),
  };
}

export function templateRetencaoAviso(params: {
  empresaNome: string;
  diasRestantes: number;
  billingUrl: string;
}): EmailTemplate {
  const { empresaNome, diasRestantes, billingUrl } = params;
  const ultimoAviso = diasRestantes <= 5;

  return {
    subject: ultimoAviso
      ? `Em ${diasRestantes} dias os dados da ${empresaNome} serão excluídos`
      : `Sua conta está em modo leitura há alguns dias`,
    html: shell({
      preview: `Faltam ${diasRestantes} dias antes da exclusão dos dados`,
      footerNote: `Você recebeu este e-mail por administrar a empresa ${empresaNome} na ${BRAND.nome}.`,
      hero: {
        titulo: ultimoAviso
          ? html`Seus dados serão ${em("excluídos")} em breve`
          : html`Sua conta segue em ${em("modo leitura")}`,
        lead: html`A ${strong(empresaNome)} está em modo somente leitura desde o fim do período de teste. Em
        ${strong(`${diasRestantes} dias`)}, sem um plano ativo, os dados fiscais são anonimizados e o restante é
        excluído permanentemente.`,
      },
      content: [
        callout(
          "Ative um plano a qualquer momento para voltar a editar e cancelar a exclusão.",
          ultimoAviso ? "negative" : "warning",
          { mt: 0 }
        ),
        button("Ativar plano", billingUrl),
        small("Dúvidas? Responda este e-mail."),
      ],
    }),
  };
}

function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function templateAtivarPlanoRecibo(params: {
  empresaNome: string;
  planoNome: string;
  valor: number;
  billingUrl: string;
}): EmailTemplate {
  const { empresaNome, planoNome, valor, billingUrl } = params;

  return {
    subject: `Assinatura confirmada — ${planoNome}`,
    html: shell({
      preview: `Primeira cobrança de ${formatBRL(valor)} confirmada`,
      footerNote: `Você recebeu este e-mail por administrar a empresa ${empresaNome} na ${BRAND.nome}.`,
      hero: {
        titulo: html`Sua assinatura está ${em("ativa")}`,
        lead: html`A ${strong(empresaNome)} agora tem a assinatura ${strong(planoNome)}. A primeira cobrança já foi
        processada com o cartão que você cadastrou.`,
      },
      content: [
        card([kv("Plano", planoNome), kvDivider(), kv("Valor cobrado", formatBRL(valor))], {
          accent: "positive",
          mt: 0,
        }),
        button("Ver assinatura", billingUrl),
        small(
          "Pode cancelar quando quiser em Configurações. Cancelamento em até 7 dias desta cobrança gera estorno integral."
        ),
      ],
    }),
  };
}

/** Cópia dos próprios dados pronta (SPEC 115): link assinado, válido por alguns dias. */
export function templateLgpdExportacaoPronta(params: { nome: string; link: string; validoAte: string }): EmailTemplate {
  const { nome, link, validoAte } = params;
  return {
    subject: "Sua cópia de dados está pronta",
    html: shell({
      preview: `O link para baixar seus dados vale até ${validoAte}`,
      footerNote: `Você recebeu este e-mail porque pediu uma cópia dos seus dados no ${BRAND.nome} (LGPD, art. 18).`,
      hero: {
        titulo: html`Sua ${em("cópia de dados")} está pronta`,
        lead: html`Olá, ${strong(nome)}. Montamos o arquivo com os dados da sua conta: perfil, preferências,
        consentimentos, notificações, conversas com a IA e o histórico das suas ações.`,
      },
      content: [
        button("Baixar meus dados", link),
        paragraph(
          html`O link vale até ${strong(validoAte)}. Depois disso, peça uma nova cópia em Configurações → Privacidade.`
        ),
        small(
          html`Projetos, clientes e financeiro são dados da sua empresa e ficam com o administrador dela. Não pediu esta
          cópia? Responda este e-mail.`
        ),
      ],
    }),
  };
}

/** Pedido de exclusão atendido (LGPD art. 18, VI, SPEC 116). Vai para o e-mail original, antes de anonimizar. */
export function templateLgpdExclusaoConcluida(params: { nome: string }): EmailTemplate {
  const { nome } = params;
  return {
    subject: "Seus dados foram excluídos",
    html: shell({
      preview: `Atendemos seu pedido de exclusão no ${BRAND.nome}`,
      footerNote: `Você recebeu este e-mail porque pediu a exclusão dos seus dados no ${BRAND.nome} (LGPD, art. 18).`,
      hero: {
        titulo: html`Seus ${em("dados foram excluídos")}`,
        lead: html`Olá, ${strong(nome)}. Atendemos seu pedido: nome, e-mail, telefone e foto saíram da sua conta, junto
        com as conversas com a IA, as notificações e as preferências. O acesso foi encerrado.`,
      },
      content: [
        paragraph(
          html`Pelo prazo da lei, guardamos só o registro dos aceites (termos, cobrança e cookies) e a trilha de
          auditoria, sem nome nem e-mail.`
        ),
        small(
          html`Projetos, clientes e financeiro são dados da sua empresa e ficam com o administrador dela. Este é o
          último e-mail sobre esta conta.`
        ),
      ],
    }),
  };
}

/** Pedido de exclusão recusado, com o motivo (SPEC 116). */
export function templateLgpdExclusaoRecusada(params: { nome: string; motivo: string }): EmailTemplate {
  const { nome, motivo } = params;
  return {
    subject: "Seu pedido de exclusão precisa de um passo antes",
    html: shell({
      preview: "Não conseguimos excluir sua conta ainda",
      footerNote: `Você recebeu este e-mail porque pediu a exclusão dos seus dados no ${BRAND.nome} (LGPD, art. 18).`,
      hero: {
        titulo: html`Seu pedido de exclusão ${em("ainda não foi atendido")}`,
        lead: html`Olá, ${strong(nome)}. Analisamos seu pedido e ele não pôde ser atendido agora.`,
      },
      content: [
        callout(html`${strong("Motivo:")} ${motivo}`),
        paragraph(
          html`Resolva o ponto acima e peça de novo em Configurações → Privacidade. Dúvidas? Responda este e-mail.`
        ),
      ],
    }),
  };
}

/** Pedido de exportação dos próprios dados (LGPD art. 18, V): vai para o encarregado atender. */
export function templateLgpdExportacaoDados(params: {
  empresaNome: string;
  solicitanteEmail: string;
  solicitanteNome?: string;
  requestedAt: string;
  requestId: string;
}): EmailTemplate {
  const { empresaNome, solicitanteEmail, solicitanteNome, requestedAt, requestId } = params;
  const solicitante = solicitanteNome ? `${solicitanteNome} (${solicitanteEmail})` : solicitanteEmail;

  return {
    subject: `[LGPD] Solicitação de exportação de dados, ${empresaNome}`,
    html: shell({
      preview: `Um usuário da ${empresaNome} pediu uma cópia dos próprios dados`,
      footerNote: `Notificação automática da ${BRAND.nome} para o encarregado de dados (LGPD, art. 18, V).`,
      hero: {
        titulo: html`Pedido de ${em("exportação de dados")}`,
        lead: html`Um usuário da ${strong(empresaNome)} pediu uma cópia dos próprios dados pessoais, direito previsto no
        art. 18, V da LGPD.`,
      },
      content: [
        card(
          [
            kv("Solicitante", solicitante),
            kvDivider(),
            kv("Solicitado em", requestedAt),
            kvDivider(),
            kv("ID da solicitação", requestId, { mono: true }),
          ],
          { accent: "warning", mt: 0 }
        ),
        divider(),
        paragraph(
          html`O prazo é de ${strong("até 15 dias")} (art. 19). Envie a cópia para o e-mail do solicitante e marque o
          pedido como concluído em ${strong("data_export_requests")}.`,
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

/** SPEC 112: aviso pro ultra admin de que chegou feedback pelo modal do app. */
export function templateFeedbackRecebido(params: {
  tipo: "bug" | "sugestao";
  titulo: string | null;
  descricao: string;
  autor: string;
  empresaNome: string | null;
  rota: string | null;
  temPrint: boolean;
  enviadoEm: string;
  painelUrl: string;
}): EmailTemplate {
  const { tipo, titulo, descricao, autor, empresaNome, rota, temPrint, enviadoEm, painelUrl } = params;
  const ehBug = tipo === "bug";
  const origem = empresaNome ? ` (${empresaNome})` : "";
  // Assunto é header, não HTML: só tira quebra de linha e limita o tamanho.
  const assunto = (ehBug ? `Problema relatado por ${autor}${origem}` : `Sugestão de ${autor}${origem}: ${titulo ?? ""}`)
    .replace(/\s+/g, " ")
    .slice(0, 150);

  return {
    subject: assunto,
    html: shell({
      preview: descricao.slice(0, 120),
      footerNote: `Aviso automático da ${BRAND.nome} para quem faz a triagem de feedback.`,
      hero: {
        titulo: ehBug ? html`Novo ${em("problema")} relatado` : html`Nova ${em("sugestão")} recebida`,
        lead: html`${strong(autor)}${origem} enviou pelo botão Feedback do app.`,
      },
      content: [
        card([...(titulo ? [kv("Título", titulo), kvDivider()] : []), paragraph(multiline(descricao), { mt: 0 })], {
          accent: ehBug ? "warning" : "info",
          mt: 0,
        }),
        card(
          [
            kv("Enviado em", enviadoEm),
            ...(rota ? [kvDivider(), kv("Tela", rota, { mono: true })] : []),
            kvDivider(),
            kv("Print", temPrint ? "Anexado, abra pelo painel" : "Sem print"),
          ],
          { mt: 16 }
        ),
        button("Abrir feedback", painelUrl),
        small("Responda este e-mail para falar direto com quem enviou."),
      ],
    }),
  };
}

/**
 * SPEC 113: aviso de plataforma pro ultra admin (novo cadastro, ativar plano
 * bloqueado, qualquer notificar_ultra_admins). Mesmo título e texto do sino.
 */
export function templateAvisoPlataforma(params: {
  titulo: string;
  mensagem: string | null;
  empresaNome: string | null;
  enviadoEm: string;
  url: string;
  dicaResposta: string | null;
}): EmailTemplate {
  const { titulo, mensagem, empresaNome, enviadoEm, url, dicaResposta } = params;

  return {
    subject: titulo.replace(/\s+/g, " ").slice(0, 150),
    html: shell({
      preview: (mensagem ?? titulo).slice(0, 120),
      footerNote: `Aviso automático da ${BRAND.nome} para administradores da plataforma.`,
      hero: {
        titulo: html`${titulo}`,
        lead: empresaNome ? html`Empresa: ${strong(empresaNome)}` : html`Aviso da plataforma.`,
      },
      content: [
        ...(mensagem ? [card([paragraph(multiline(mensagem), { mt: 0 })], { accent: "info", mt: 0 })] : []),
        card([kv("Quando", enviadoEm)], { mt: mensagem ? 16 : 0 }),
        button("Abrir no painel", url),
        ...(dicaResposta ? [small(dicaResposta)] : []),
      ],
    }),
  };
}
