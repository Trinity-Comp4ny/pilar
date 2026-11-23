import type { Bloco } from "./markdown";

/**
 * CTA contextual no meio do artigo (relatório de SEO de 19/11/2026): quem chega
 * por "taxa de administração" ou "quanto cobrar projeto elétrico" ainda não está
 * procurando software, então o convite fala do assunto do artigo e leva ao recurso
 * que resolve aquele problema. A demonstração fica numa linha discreta embaixo.
 *
 * Só promete o que a Pilar de fato faz hoje (ver `modules.ts` e `comparativos.ts`)
 * e não inventa número de resultado. Artigo sem entrada aqui só mostra o CTA do
 * módulo no fim, como antes.
 */

export interface CtaArtigo {
  titulo: string;
  texto: string;
  acao: { rotulo: string; para: string };
}

const CALCULADORA = "/ferramentas/calculadora-de-honorarios";

export const CTA_ARTIGOS: Record<string, CtaArtigo> = {
  "taxa-de-administracao-de-obra": {
    titulo: "Veja a conta da obra dentro da Pilar",
    texto:
      "Aporte do cliente, despesa e comprovante da obra no mesmo lugar, sem planilha paralela para conferir a base da taxa.",
    acao: { rotulo: "Conhecer o módulo Obra", para: "/obra" },
  },
  "quanto-cobrar-projeto-eletrico": {
    titulo: "Chegue ao valor com a calculadora de honorários",
    texto:
      "Monte o preço pelo seu custo e pela margem que você quer. Depois, a proposta por disciplina sai em DOCX, no seu template, direto do escopo.",
    acao: { rotulo: "Usar a calculadora de honorários", para: CALCULADORA },
  },
  "como-precificar-projeto-arquitetura-engenharia": {
    titulo: "Teste o seu preço na calculadora de honorários",
    texto:
      "Coloque horas, equipe e margem e veja o valor do projeto antes de mandar a proposta. A calculadora é gratuita e não pede cadastro.",
    acao: { rotulo: "Usar a calculadora de honorários", para: CALCULADORA },
  },
  "planilha-controle-de-projetos": {
    titulo: "Planilha ou sistema: onde está o limite?",
    texto:
      "A planilha guarda o número, mas depende de alguém atualizar. Veja lado a lado o que muda em prazo, proposta, financeiro e obra.",
    acao: { rotulo: "Ver o comparativo com planilha", para: "/vs/planilha" },
  },
  "software-gestao-escritorio-engenharia": {
    titulo: "Veja como a Pilar atende escritório de engenharia",
    texto:
      "Proposta, projeto, obra e financeiro conectados, com a IA preparando e a sua equipe aprovando. Feito para escritório de projeto, não para construtora.",
    acao: { rotulo: "Conhecer a Pilar para engenharia", para: "/engenharia" },
  },
  "aditivo-de-projeto": {
    titulo: "Escopo e aditivo no mesmo projeto",
    texto:
      "Cada mudança pedida pelo cliente vira aditivo registrado no escopo, em vez de ficar perdida numa conversa de WhatsApp.",
    acao: { rotulo: "Conhecer o módulo Projetos", para: "/projetos" },
  },
  "escopo-de-projeto-engenharia": {
    titulo: "Escopo por disciplina, com aditivo quando muda",
    texto:
      "Monte o escopo de cada disciplina, acompanhe o prazo e registre o que o cliente pediu a mais, tudo no mesmo projeto.",
    acao: { rotulo: "Conhecer o módulo Projetos", para: "/projetos" },
  },
};

/**
 * Onde o CTA entra: logo antes da terceira seção (`##`). Antes disso o leitor
 * ainda não recebeu o que veio buscar; depois, já foi embora. Artigo com menos de
 * três seções devolve -1 e fica só com o CTA do fim.
 */
export function posicaoDoCta(blocos: Bloco[]): number {
  let secoes = 0;
  for (let i = 0; i < blocos.length; i++) {
    if (blocos[i].tipo !== "h2") continue;
    secoes++;
    if (secoes === 3) return i;
  }
  return -1;
}
