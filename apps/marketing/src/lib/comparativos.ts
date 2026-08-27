/**
 * Fonte única das páginas de comparação (Pilar vs X), no mesmo padrão de
 * `modules.ts`: alimenta o dropdown "Comparações" do header e as páginas
 * /vs/planilha, /vs/trello etc.
 *
 * Regra de conteúdo: só compara com o que o Pilar de fato faz hoje (ver
 * `modules.ts`) e não inventa número de resultado. Planilha e Trello são
 * ferramentas legítimas, só não foram feitas pra este trabalho específico:
 * o tom é factual, não zoeira de concorrente.
 */

export type ComparativoSlug = "planilha" | "trello";

export interface LinhaComparacao {
  criterio: string;
  pilar: string;
  /** false = a alternativa não faz isso; string = o que ela faz em vez disso. */
  alternativa: string | false;
}

export interface Comparativo {
  slug: ComparativoSlug;
  /** Nome curto da alternativa, usado em "Pilar vs {adversario}". */
  adversario: string;
  headline: string;
  headlineFim: string;
  lede: string;
  linhas: LinhaComparacao[];
  /** Sinais de que vale a pena migrar, ditos sem prometer autonomia mágica. */
  quandoMigrar: string[];
  faq: { pergunta: string; resposta: string }[];
}

export const COMPARATIVOS: Comparativo[] = [
  {
    slug: "planilha",
    adversario: "Planilha",
    headline: "Planilha guarda o número.",
    headlineFim: "O Pilar avisa antes de virar prejuízo.",
    lede: "Excel e Google Sheets não têm nada de errado: o problema é o que eles não fazem sozinhos. Toda linha depende de alguém lembrar de atualizar, e ninguém avisa quando o projeto entra no vermelho.",
    linhas: [
      {
        criterio: "Proposta por disciplina",
        pilar: "Sai em DOCX, no seu template, direto do escopo montado no sistema.",
        alternativa: "Cada proposta nasce de novo, copiando e ajustando a última.",
      },
      {
        criterio: "Margem do projeto",
        pilar: "Orçado contra executado, recalculada a cada lançamento.",
        alternativa: "Depende de alguém somar a fórmula certa na aba certa.",
      },
      {
        criterio: "Aviso de prejuízo",
        pilar: "O projeto avisa quando o custo passa do orçado.",
        alternativa: false,
      },
      {
        criterio: "Cobrança do cliente",
        pilar: "A parcela nasce junto com o projeto aprovado.",
        alternativa: "Controle solto, em outra aba ou em outro arquivo.",
      },
      {
        criterio: "Time todo vendo o mesmo dado",
        pilar: "Atualiza pra todo mundo no instante em que alguém mexe.",
        alternativa: "Cópia por e-mail, versão desatualizada rodando por aí.",
      },
      {
        criterio: "Cliente acompanhando",
        pilar: "Um link de leitura, sempre com o dado do sistema.",
        alternativa: "Print exportado e mandado por WhatsApp.",
      },
    ],
    quandoMigrar: [
      "Quando você só sabe se um projeto deu lucro depois que ele já acabou.",
      "Quando duas pessoas mexem na mesma planilha e uma sobrescreve a outra.",
      "Quando montar uma proposta nova significa copiar a última e rezar pra não esquecer de trocar um número.",
    ],
    faq: [
      {
        pergunta: "Minha planilha tem anos de histórico. Dá pra importar?",
        resposta:
          "O extrato do banco entra direto, lido pela IA. Os projetos você recadastra: planilha acumula bagunça com o tempo, e começar limpo no Pilar é melhor do que herdar a bagunça organizada.",
      },
      {
        pergunta: "Planilha é de graça. Vale pagar por isso?",
        resposta:
          "A planilha não custa nada até o dia em que um projeto termina no vermelho e ninguém percebeu a tempo. É essa hora perdida (e esse projeto) que o Pilar evita.",
      },
      {
        pergunta: "Preciso migrar tudo de uma vez?",
        resposta: "Não. Comece pelos projetos ativos. O que já fechou pode continuar arquivado onde está.",
      },
    ],
  },
  {
    slug: "trello",
    adversario: "Trello",
    headline: "Trello organiza tarefa.",
    headlineFim: "O Pilar organiza o escritório inteiro.",
    lede: "Trello (e ClickUp, e Asana) são bons quadros genéricos. O problema aparece quando o trabalho do escritório de engenharia é mais que mover cartão: é proposta, é financeiro, é obra, é o cliente perguntando andamento.",
    linhas: [
      {
        criterio: "Quadro por disciplina e prazo",
        pilar: "Nasce pronto: disciplina, responsável e prazo em cada projeto.",
        alternativa: "Quadro genérico, você monta a estrutura do zero.",
      },
      {
        criterio: "Proposta",
        pilar: "Gera o documento em DOCX, no seu template.",
        alternativa: false,
      },
      {
        criterio: "Financeiro do projeto",
        pilar: "Parcela, receita e despesa no mesmo lugar do projeto.",
        alternativa: "Não existe: precisa colar outra ferramenta.",
      },
      {
        criterio: "Diário e conta da obra",
        pilar: "Campo registra o dia, o escritório vê sem redigitar.",
        alternativa: false,
      },
      {
        criterio: "Cliente acompanhando",
        pilar: "Portal só leitura, sem dar acesso ao quadro inteiro.",
        alternativa: "Ou o cliente entra no board todo, ou você exporta manualmente.",
      },
    ],
    quandoMigrar: [
      "Quando o quadro de tarefas virou só uma das cinco abas abertas pra tocar um projeto.",
      "Quando o cliente pede acesso e a única opção é convidar ele pro board inteiro.",
      "Quando ninguém no time sabe se aquele card verde no Trello está dando lucro ou prejuízo.",
    ],
    faq: [
      {
        pergunta: "Uso Trello só pra tarefas, o resto é solto em outro lugar.",
        resposta:
          "É exatamente esse o ponto: o Pilar junta proposta, projeto e financeiro no mesmo fluxo, então parar de alternar entre ferramentas é o ganho.",
      },
      {
        pergunta: "Trello é mais barato.",
        resposta:
          "Sozinho, sim. Some o preço do Trello com o que você paga hoje pra fechar proposta, financeiro e diário de obra em outros lugares, e a conta muda.",
      },
      {
        pergunta: "Meu time já está acostumado com quadro kanban.",
        resposta: "O Pilar também tem quadro, com coluna que o escritório define. A curva de aprendizado é baixa.",
      },
    ],
  },
];

export const COMPARATIVOS_POR_SLUG: Record<ComparativoSlug, Comparativo> = COMPARATIVOS.reduce(
  (acc, c) => ({ ...acc, [c.slug]: c }),
  {} as Record<ComparativoSlug, Comparativo>
);
