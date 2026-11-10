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

export type ComparativoSlug = "planilha" | "trello" | "whatsapp" | "notion" | "erp-construtora";

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
  /** Title (sem " | Pilar"), meta description e H1 com a palavra-chave (ver Modulo.seo). */
  seo: { titulo: string; descricao: string; h1: string };
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
    seo: {
      titulo: "Planilha ou sistema de gestão de projetos de engenharia?",
      descricao:
        "Planilha de Excel ou sistema de gestão de projetos de engenharia? Compare lado a lado prazo, proposta, financeiro e obra, e veja quando vale migrar.",
      h1: "Pilar vs planilha na gestão de projetos de engenharia",
    },
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
    seo: {
      titulo: "Trello na gestão de projetos de engenharia? Compare",
      descricao:
        "Trello, ClickUp ou Asana na gestão de projetos de engenharia? Compare com um sistema feito para escritório: proposta, disciplina, financeiro e obra.",
      h1: "Pilar vs Trello na gestão de projetos de engenharia",
    },
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
  {
    slug: "whatsapp",
    adversario: "WhatsApp",
    headline: "WhatsApp é onde o cliente pergunta.",
    headlineFim: "O Pilar é onde a resposta já está.",
    lede: "Grupo por projeto, áudio do canteiro, foto da obra e o cliente perguntando andamento: o WhatsApp é ótimo para conversar e péssimo para guardar o que foi decidido. O histórico some na rolagem.",
    seo: {
      titulo: "WhatsApp para gerenciar projeto e obra? Compare",
      descricao:
        "Gerenciar projeto e obra pelo WhatsApp funciona até o histórico sumir. Compare com um sistema de gestão: diário de obra, prazo, decisões e portal do cliente.",
      h1: "Pilar vs WhatsApp na gestão de projeto e obra",
    },
    linhas: [
      {
        criterio: "Diário de obra",
        pilar: "Registro do dia com foto, efetivo e impedimento, preenchido pelo celular, mesmo sem sinal.",
        alternativa: "Foto e áudio soltos no grupo, sem data de serviço nem frente.",
      },
      {
        criterio: "Andamento para o cliente",
        pilar: "Portal só de leitura: disciplinas, entregas, parcelas e prestação de contas.",
        alternativa: "Resposta escrita na hora, cada vez que ele pergunta.",
      },
      {
        criterio: "Prazo por disciplina",
        pilar: "Gantt da carteira, responsável em cada disciplina e motivo quando a data muda.",
        alternativa: false,
      },
      {
        criterio: "Histórico de decisões",
        pilar: "Fica no projeto, com quem registrou e quando.",
        alternativa: "Perdido entre mensagens, figurinhas e outros assuntos.",
      },
      {
        criterio: "Comprovante de despesa",
        pilar: "Anexado à despesa da conta da obra, que vira prestação de contas.",
        alternativa: "Foto do cupom no grupo, que alguém precisa achar depois.",
      },
      {
        criterio: "Acesso de quem sai da equipe",
        pilar: "O histórico fica no projeto, não no celular de alguém.",
        alternativa: "A conversa vai embora junto com o celular da pessoa.",
      },
    ],
    quandoMigrar: [
      'Quando a pergunta "em que pé está?" chega toda semana e a resposta exige rolar o grupo.',
      "Quando uma decisão de obra foi combinada por áudio e ninguém acha mais.",
      "Quando o encarregado manda foto, mas o diário de obra nunca é fechado.",
    ],
    faq: [
      {
        pergunta: "Vou parar de usar WhatsApp com o cliente?",
        resposta:
          "Não precisa. A conversa continua onde ele está acostumado; o que muda é que o andamento, as parcelas e a prestação de contas ficam num link que ele abre sozinho.",
      },
      {
        pergunta: "O encarregado vai aceitar mais um aplicativo?",
        resposta:
          "O Pilar Campo abre no navegador do celular, sem instalar nada, e o gestor entrega usuário e senha na mão, sem e-mail.",
      },
      {
        pergunta: "E as fotos que já estão no grupo?",
        resposta: "Ficam onde estão. Comece pelo registro de hoje; o histórico novo já nasce organizado.",
      },
    ],
  },
  {
    slug: "notion",
    adversario: "Notion",
    headline: "Notion é uma folha em branco.",
    headlineFim: "O Pilar já vem com o escritório montado.",
    lede: "Notion é ótimo para documentação e wiki. Para virar sistema de escritório de engenharia ou arquitetura, alguém precisa desenhar as bases, as relações e as fórmulas, e manter tudo isso de pé.",
    seo: {
      titulo: "Notion para escritório de engenharia e arquitetura?",
      descricao:
        "Notion como sistema de escritório de engenharia ou arquitetura? Compare com um software de gestão pronto: proposta, prazo por disciplina, financeiro e obra.",
      h1: "Pilar vs Notion para escritório de engenharia e arquitetura",
    },
    linhas: [
      {
        criterio: "Pronto para usar",
        pilar: "Funil, proposta, projetos, financeiro e obra já conectados.",
        alternativa: "Bases montadas do zero, por alguém da equipe.",
      },
      {
        criterio: "Proposta por disciplina",
        pilar: "Sai em DOCX no template do escritório e vira projeto quando aprovada.",
        alternativa: "Página copiada de um modelo, sem ligação com o financeiro.",
      },
      {
        criterio: "Financeiro do escritório",
        pilar: "Contas, cartões, extrato lido por IA e folha com comprovante.",
        alternativa: false,
      },
      {
        criterio: "Diário de obra no canteiro",
        pilar: "Pilar Campo no celular, funciona sem sinal.",
        alternativa: "Depende de sinal e de o encarregado ter conta no workspace.",
      },
      {
        criterio: "Portal do cliente",
        pilar: "Link só de leitura, sem conta e sem senha.",
        alternativa: "Página pública compartilhada, montada e atualizada à mão.",
      },
      {
        criterio: "Manutenção",
        pilar: "Por conta do Pilar.",
        alternativa: "Quem montou vira o suporte do sistema.",
      },
    ],
    quandoMigrar: [
      "Quando só uma pessoa sabe como as bases do Notion se ligam.",
      "Quando o financeiro continua numa planilha porque o Notion não fecha o mês.",
      "Quando o canteiro não usa porque não tem sinal ou não tem conta.",
    ],
    faq: [
      {
        pergunta: "Posso continuar usando Notion para documentação?",
        resposta:
          "Pode. Wiki, padrões e atas ficam bem no Notion. O Pilar cuida do que tem número, prazo e dinheiro: proposta, projeto, financeiro e obra.",
      },
      {
        pergunta: "Consigo adaptar o Pilar ao meu fluxo?",
        resposta:
          "O quadro usa as colunas do escritório e o fluxo padrão é configurado uma vez. O que não muda é a ligação entre proposta, projeto e financeiro, que é o que dá trabalho montar no Notion.",
      },
      {
        pergunta: "Quanto custa comparado ao Notion?",
        resposta:
          "O Pilar cobra por escritório, não por usuário, a partir de R$ 299 por mês. Os planos estão na página de preços.",
      },
    ],
  },
  {
    slug: "erp-construtora",
    adversario: "ERP de construtora",
    headline: "ERP de construtora gerencia canteiro.",
    headlineFim: "O Pilar gerencia o escritório que projeta.",
    lede: "ERPs de construtora são feitos para quem vende obra: suprimentos em escala, medição de empreiteiro, contabilidade de obra. Escritório de projeto vende proposta por disciplina e precisa de outra coisa.",
    seo: {
      titulo: "ERP de construtora para escritório de projeto? Compare",
      descricao:
        "ERP de construtora ou software de gestão para escritório de projeto de engenharia e arquitetura? Compare proposta, disciplina, prazo, obra e preço.",
      h1: "Pilar vs ERP de construtora para escritório de projeto",
    },
    linhas: [
      {
        criterio: "Unidade de trabalho",
        pilar: "Projeto com disciplinas, responsáveis e entregas.",
        alternativa: "Obra com orçamento, insumos e centros de custo.",
      },
      {
        criterio: "Proposta de projeto",
        pilar: "Por disciplina, no template do escritório, em DOCX.",
        alternativa: "Orçamento de obra por composição de custos.",
      },
      {
        criterio: "Obra por administração",
        pilar: "Conta da obra com aporte, despesa com comprovante e a taxa do escritório.",
        alternativa: "Pensado para a construtora que executa, não para quem administra pelo cliente.",
      },
      {
        criterio: "Implantação",
        pilar: "Entrada guiada, sem projeto de implantação longo.",
        alternativa: "Costuma envolver parametrização e implantação dedicadas.",
      },
      {
        criterio: "Preço",
        pilar: "Por escritório, sem cobrança por usuário.",
        alternativa: "É comum cobrar por usuário ou por módulo.",
      },
    ],
    quandoMigrar: [
      "Quando o escritório paga por módulos de suprimentos e contabilidade de obra que não usa.",
      "Quando a proposta de projeto continua sendo feita fora do sistema.",
      "Quando a equipe de projeto não usa o ERP porque ele não fala a língua de disciplina e entrega.",
    ],
    faq: [
      {
        pergunta: "O Pilar substitui o ERP de uma construtora?",
        resposta:
          "Não. Construtora e incorporadora com gestão de obra como núcleo do negócio estão fora do foco do Pilar. Ele é feito para escritórios de projeto de engenharia e arquitetura.",
      },
      {
        pergunta: "E se o escritório também administra obra?",
        resposta:
          "Para obra por administração, o Pilar tem diário do canteiro, cotação de material e a conta da obra com prestação de contas ao cliente.",
      },
      {
        pergunta: "O Pilar emite nota fiscal ou faz contabilidade?",
        resposta: "Não é um sistema contábil. Ele organiza o financeiro do escritório e gera os relatórios do mês.",
      },
    ],
  },
];

export const COMPARATIVOS_POR_SLUG: Record<ComparativoSlug, Comparativo> = COMPARATIVOS.reduce(
  (acc, c) => ({ ...acc, [c.slug]: c }),
  {} as Record<ComparativoSlug, Comparativo>
);
