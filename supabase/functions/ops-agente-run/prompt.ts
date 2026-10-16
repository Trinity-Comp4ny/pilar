/**
 * Prompt dos agentes Receita e Clientes (SPEC 126 fase 1). Fonte das regras:
 * docs/operacao/agentes/receita.md e clientes.md. Mudou o playbook, muda aqui.
 *
 * O modelo recebe só agregado e, por candidato, nome do escritório, primeiro nome do
 * contato e os fatos que justificam o contato (LGPD, SPEC 126). Nada de valor do tenant.
 */
import { z } from "../_shared/schemas.ts";
import { primeiroNome, type Candidato } from "./regras.ts";

export const respostaSchema = z.object({
  resumo: z.string().min(1).max(400),
  destaques: z.array(z.object({ texto: z.string().min(1).max(240), refs: z.array(z.string()).min(1).max(5) })).max(3),
  mensagens: z.array(z.object({ ref: z.string(), texto: z.string().min(1).max(700) })).max(40),
});

const MISSAO: Record<"receita" | "clientes", string> = {
  receita: "Receita: fazer cada teste promissor virar pagante e nenhum pagamento escapar.",
  clientes: "Clientes: manter cada escritório ativo, ouvido e com o problema resolvido.",
};

export function systemPrompt(agente: "receita" | "clientes", remetente: string): string {
  return [
    `Você é o agente de ${MISSAO[agente]} Trabalha para ${remetente}, fundador da Pilar, um software de gestão para escritórios de engenharia e arquitetura.`,
    "Você recebe indicadores e uma lista de candidatos a contato, já escolhidos por regra. Não invente candidato, número nem fato.",
    'Indicador com "_30d" é a soma dos últimos 30 dias, nunca "hoje"; "_30d_anteriores" é o mesmo período antes desse. Sem sufixo é o total de agora (MRR em reais, pagantes, em teste). Pagantes, em teste, cadastros e escritórios contam empresas clientes, não pessoas: diga "escritórios".',
    "Devolva JSON com:",
    '- "resumo": 1 ou 2 frases sobre o dia da área, citando os números recebidos.',
    '- "destaques": até 3 itens do que mais importa hoje, cada um com "refs" apontando para candidatos ("c1") ou indicadores ("mrr", "cadastros_30d"...).',
    '- "mensagens": para cada candidato com canal whatsapp, um rascunho em "texto" com o "ref" do candidato.',
    `Regras da mensagem: português do Brasil, tom direto e humano, de engenheiro para engenheiro. Comece com "Oi <primeiro nome>, aqui é ${remetente}, da Pilar." (sem nome do contato, só "Oi,"). No máximo 3 frases e uma pergunta. Use só os fatos do candidato.`,
    "Nunca: travessão, emoji, link, preço, desconto, porcentagem, promessa de condição comercial, pressão ou culpa. Sem jargão (sinergia, alavancar, otimizar).",
    agente === "clientes"
      ? "Você é o agente de relacionamento: nunca fale de pagamento, cobrança, atraso ou assinatura. Isso é do agente Receita."
      : "Ao falar de pagamento em aberto, ofereça ajuda (reenviar o link, outra forma de pagar), sem cobrar nem ameaçar.",
  ].join("\n");
}

export function userMessage(indicadores: Record<string, number>, candidatos: Candidato[]): string {
  return JSON.stringify({
    indicadores,
    candidatos: candidatos.map((c) => ({
      ref: c.ref,
      canal: c.tipo,
      escritorio: c.empresaNome,
      contato: primeiroNome(c.contatoNome),
      assunto: c.titulo,
      fatos: c.fatos,
    })),
  });
}
