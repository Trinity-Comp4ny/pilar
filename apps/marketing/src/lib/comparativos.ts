/**
 * Fonte única das páginas de comparação (Pilar vs X), no mesmo padrão de
 * `modules.ts`: alimenta o dropdown "Comparações" do header e as páginas
 * /vs/planilha, /vs/trello etc.
 *
 * Regra de conteúdo: só compara com o que a Pilar de fato faz hoje (ver
 * `modules.ts`) e não inventa número de resultado. Planilha e Trello são
 * ferramentas legítimas, só não foram feitas pra este trabalho específico:
 * o tom é factual, não zoeira de concorrente.
 */

export type ComparativoSlug =
  | "planilha"
  | "trello"
  | "whatsapp"
  | "notion"
  | "erp-construtora"
  | "omie-conta-azul"
  | "software-de-arquitetura"
  | "sistema-simples"
  | "plataforma-por-usuario";

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
    headlineFim: "A Pilar avisa antes de virar prejuízo.",
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
        pilar: "Uma área com os dados que o escritório compartilha.",
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
          "O extrato do banco entra direto, lido pela IA. Os projetos você recadastra: planilha acumula bagunça com o tempo, e começar limpo na Pilar é melhor do que herdar a bagunça organizada.",
      },
      {
        pergunta: "Planilha é de graça. Vale pagar por isso?",
        resposta:
          "A planilha não custa nada até o dia em que um projeto termina no vermelho e ninguém percebeu a tempo. É essa hora perdida (e esse projeto) que a Pilar evita.",
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
    headlineFim: "A Pilar organiza o escritório inteiro.",
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
        pilar: "Área do cliente com as informações compartilhadas pelo escritório.",
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
          "É exatamente esse o ponto: a Pilar junta proposta, projeto e financeiro no mesmo fluxo, então parar de alternar entre ferramentas é o ganho.",
      },
      {
        pergunta: "Trello é mais barato.",
        resposta:
          "Sozinho, sim. Some o preço do Trello com o que você paga hoje pra fechar proposta, financeiro e diário de obra em outros lugares, e a conta muda.",
      },
      {
        pergunta: "Meu time já está acostumado com quadro kanban.",
        resposta: "A Pilar também tem quadro, com coluna que o escritório define. A curva de aprendizado é baixa.",
      },
    ],
  },
  {
    slug: "whatsapp",
    adversario: "WhatsApp",
    headline: "WhatsApp é onde o cliente pergunta.",
    headlineFim: "A Pilar é onde a resposta já está.",
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
    headlineFim: "A Pilar já vem com o escritório montado.",
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
        pilar: "Acesso do cliente pelo navegador.",
        alternativa: "Página pública compartilhada, montada e atualizada à mão.",
      },
      {
        criterio: "Manutenção",
        pilar: "Por conta da Pilar.",
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
          "Pode. Wiki, padrões e atas ficam bem no Notion. A Pilar cuida do que tem número, prazo e dinheiro: proposta, projeto, financeiro e obra.",
      },
      {
        pergunta: "Consigo adaptar a Pilar ao meu fluxo?",
        resposta:
          "O quadro usa as colunas do escritório e o fluxo padrão é configurado uma vez. O que não muda é a ligação entre proposta, projeto e financeiro, que é o que dá trabalho montar no Notion.",
      },
      {
        pergunta: "Quanto custa comparado ao Notion?",
        resposta:
          "A Pilar cobra por escritório, não por usuário, a partir de R$ 299 por mês. Os planos estão na página de preços.",
      },
    ],
  },
  {
    slug: "erp-construtora",
    adversario: "ERP de construtora",
    headline: "ERP de construtora gerencia canteiro.",
    headlineFim: "A Pilar gerencia o escritório que projeta.",
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
        pergunta: "A Pilar substitui o ERP de uma construtora?",
        resposta:
          "Não. Construtora e incorporadora com gestão de obra como núcleo do negócio estão fora do foco da Pilar. Ele é feito para escritórios de projeto de engenharia e arquitetura.",
      },
      {
        pergunta: "E se o escritório também administra obra?",
        resposta:
          "Para obra por administração, a Pilar tem diário do canteiro, cotação de material e a conta da obra com prestação de contas ao cliente.",
      },
      {
        pergunta: "A Pilar emite nota fiscal ou faz contabilidade?",
        resposta: "Não é um sistema contábil. Ele organiza o financeiro do escritório e gera os relatórios do mês.",
      },
    ],
  },
  {
    slug: "omie-conta-azul",
    adversario: "Omie e Conta Azul",
    headline: "Omie e Conta Azul fecham o financeiro.",
    headlineFim: "A Pilar liga o financeiro ao projeto.",
    lede: "Omie, Conta Azul e Bling são bons sistemas financeiros para qualquer empresa de serviço: nota fiscal, boleto, conciliação e contabilidade. O escritório de engenharia tem outro problema: saber se cada projeto, com suas disciplinas, está dando lucro antes de ele acabar.",
    seo: {
      titulo: "Omie ou Conta Azul para escritório de engenharia? Compare",
      descricao:
        "Omie, Conta Azul ou um sistema feito para escritório de engenharia? Compare financeiro, margem por projeto, proposta por disciplina, obra e preço.",
      h1: "Pilar vs Omie e Conta Azul para escritório de engenharia",
    },
    linhas: [
      {
        criterio: "Unidade de trabalho",
        pilar: "Projeto com disciplinas, responsáveis, prazo e entregas.",
        alternativa: "Lançamento financeiro, com o projeto como centro de custo ou rótulo.",
      },
      {
        criterio: "Margem do projeto",
        pilar: "Orçado contra executado, recalculada a cada lançamento.",
        alternativa: "Relatório por centro de custo, montado a partir dos lançamentos.",
      },
      {
        criterio: "Proposta de projeto",
        pilar: "Por disciplina, no template do escritório, em DOCX.",
        alternativa: "Orçamento ou pedido de venda genérico, sem escopo por disciplina.",
      },
      {
        criterio: "Parcelas do cliente",
        pilar: "A parcela nasce junto com o projeto aprovado.",
        alternativa: "Cobrança criada no financeiro, separada do andamento do projeto.",
      },
      {
        criterio: "Diário e conta da obra",
        pilar: "Campo registra o dia e a conta da obra presta contas ao cliente.",
        alternativa: false,
      },
      {
        criterio: "Portal do cliente",
        pilar: "Link só de leitura com andamento, parcelas e prestação de contas.",
        alternativa: "Boleto e link de cobrança, sem visão do andamento do projeto.",
      },
      {
        criterio: "Nota fiscal e contabilidade",
        pilar: "Não emite nota nem faz contabilidade.",
        alternativa: "É o ponto forte: NFS-e, impostos e integração com o contador.",
      },
      {
        criterio: "Preço",
        pilar: "Por escritório, sem cobrança por usuário, a partir de R$ 299 por mês.",
        alternativa: "Plano por faixa de uso, com módulos e usuários variando o valor.",
      },
    ],
    quandoMigrar: [
      "Quando você só descobre a margem de um projeto olhando relatório de centro de custo no fim do mês.",
      "Quando a proposta e o andamento do projeto vivem em outro lugar e o financeiro é redigitado.",
      "Quando o cliente pergunta como anda o projeto e a única resposta do sistema é o boleto.",
    ],
    faq: [
      {
        pergunta: "A Pilar substitui o Omie ou o Conta Azul?",
        resposta:
          "Depende do que você usa hoje. A Pilar não emite nota fiscal nem faz contabilidade. Muitos escritórios mantêm o sistema contábil e usam a Pilar para proposta, projeto, obra e a margem de cada projeto.",
      },
      {
        pergunta: "Dá para usar os dois ao mesmo tempo?",
        resposta:
          "Dá. O Omie ou o Conta Azul seguem cuidando de nota e contador. A Pilar organiza o que é específico de escritório de projeto: disciplina, prazo, proposta e obra.",
      },
      {
        pergunta: "Qual o melhor sistema para escritório de engenharia pequeno?",
        resposta:
          "Se o seu problema é nota, imposto e conciliação, um sistema financeiro resolve. Se é saber o resultado de cada projeto e manter proposta, prazo e financeiro juntos, um sistema feito para escritório de projeto faz mais sentido.",
      },
    ],
  },
  {
    slug: "software-de-arquitetura",
    adversario: "Software só de arquitetura",
    headline: "Software feito só para arquitetura cobre o seu escritório.",
    headlineFim: "Até a primeira disciplina de engenharia entrar.",
    lede: "Há bons sistemas de gestão pensados para o escritório de arquitetura: briefing, proposta, etapas de projeto e financeiro. O escritório de engenharia multidisciplinar tem outra conta: estrutural, hidráulica e elétrica no mesmo contrato, cada uma com seu custo, prazo e aditivo.",
    seo: {
      titulo: "Software de gestão para arquitetura ou para engenharia multidisciplinar?",
      descricao:
        "Sistema pensado só para arquitetura ou feito para escritório de engenharia multidisciplinar? Compare disciplinas, aditivo, margem por projeto e obra.",
      h1: "Pilar vs software de gestão só para arquitetura",
    },
    linhas: [
      {
        criterio: "Disciplinas no mesmo contrato",
        pilar: "Cada disciplina com escopo, responsável, prazo e custo próprios dentro do projeto.",
        alternativa: "Costuma tratar o projeto como uma sequência de etapas, sem separar as disciplinas.",
      },
      {
        criterio: "Aditivo de escopo",
        pilar: "O aditivo é um registro do projeto, com valor e parcela, e entra na margem.",
        alternativa: "Costuma ficar como anotação ou documento anexado ao contrato.",
      },
      {
        criterio: "Margem do projeto",
        pilar: "Orçado contra executado, recalculada a cada lançamento, com aviso quando o custo passa do orçado.",
        alternativa: "Costuma mostrar o financeiro do projeto, sem aviso automático.",
      },
      {
        criterio: "Obra e prestação de contas",
        pilar: "Diário de obra, app de campo e conta da obra que presta contas ao cliente.",
        alternativa: "Varia muito: em geral há diário simples, sem conta da obra.",
      },
      {
        criterio: "Portal do cliente",
        pilar: "Link só de leitura com andamento, parcelas e prestação de contas.",
        alternativa: "Costuma existir, às vezes só em plano mais caro.",
      },
      {
        criterio: "Briefing por tipo de projeto",
        pilar: "Ainda não tem modelos de briefing prontos.",
        alternativa: "Costuma trazer modelos de briefing por tipo de projeto, e é um ponto forte.",
      },
      {
        criterio: "Preço",
        pilar: "Por escritório, sem cobrança por usuário.",
        alternativa: "Costuma ser por faixa de usuários, com recursos que mudam de plano.",
      },
    ],
    quandoMigrar: [
      "Quando o contrato tem mais de uma disciplina e você não sabe a margem de cada uma.",
      "Quando o aditivo é combinado por mensagem e só vira cobrança depois.",
      "Quando o escritório também acompanha a obra e precisa prestar contas ao cliente.",
    ],
    faq: [
      {
        pergunta: "A Pilar serve para escritório de arquitetura?",
        resposta:
          "Serve. A Pilar atende projeto técnico de arquitetura e de engenharia. A diferença está em tratar cada disciplina, aditivo e obra como parte do mesmo projeto.",
      },
      {
        pergunta: "Quando um sistema só de arquitetura é suficiente?",
        resposta:
          "Quando o escritório é pequeno, trabalha com uma disciplina e o que mais pesa é o briefing e a proposta. Se há várias disciplinas, aditivos e obra, vale olhar um sistema feito para isso.",
      },
      {
        pergunta: "Posso migrar os projetos que já estão em andamento?",
        resposta:
          "Pode. Você cadastra os projetos em andamento com o que já foi orçado e executado, e a margem passa a ser calculada a partir dali.",
      },
    ],
  },
  {
    slug: "sistema-simples",
    adversario: "Sistema simples e barato",
    headline: "O sistema simples organiza o escritório.",
    headlineFim: "A Pilar mostra quanto cada projeto rende.",
    lede: "Sistemas simples, de preço baixo, resolvem bem o começo: cliente, proposta, tarefa e cobrança no mesmo lugar. O limite aparece quando o escritório cresce e a pergunta deixa de ser o que fazer hoje, e passa a ser se o projeto está dando lucro.",
    seo: {
      titulo: "Sistema simples e barato ou sistema completo para escritório de projeto?",
      descricao:
        "Sistema de gestão simples de preço baixo ou um feito para escritório de projeto? Compare margem por projeto, aditivo, obra, alertas e preço.",
      h1: "Pilar vs sistema simples e barato de gestão de projetos",
    },
    linhas: [
      {
        criterio: "O que resolve primeiro",
        pilar: "Proposta, projeto, obra e financeiro ligados, com a margem de cada projeto.",
        alternativa: "Organização: cadastro, tarefa, cronograma e cobrança.",
      },
      {
        criterio: "Margem do projeto",
        pilar: "Orçado contra executado, recalculada a cada lançamento.",
        alternativa: "Costuma mostrar o que entrou e saiu, sem comparar com o orçado por disciplina.",
      },
      {
        criterio: "Aviso antes do prejuízo",
        pilar: "O projeto avisa quando o custo passa do orçado e quando há pendência parada.",
        alternativa: "Costuma não ter: quem olha o número é você.",
      },
      {
        criterio: "Aditivo de escopo",
        pilar: "Registro do projeto, com valor e parcela.",
        alternativa: "Costuma não ter: o combinado fica fora do sistema.",
      },
      {
        criterio: "Obra",
        pilar: "Diário, cronograma e conta da obra, com app de campo.",
        alternativa: "Costuma ter só um diário simples, quando tem.",
      },
      {
        criterio: "Assistente com IA",
        pilar: "Agente que consulta e prepara dados do escritório, e você aprova antes de gravar.",
        alternativa: "Costuma não ter, ou ter só um chat de ajuda.",
      },
      {
        criterio: "Preço",
        pilar: "Mais alto que o de entrada do mercado, sem cobrança por usuário e sem módulo à parte.",
        alternativa: "É o ponto forte: preço de entrada baixo e adesão rápida.",
      },
    ],
    quandoMigrar: [
      "Quando você tem os dados, mas descobre a margem do projeto só depois que ele acaba.",
      "Quando o escritório passa de poucos projetos para vários ao mesmo tempo.",
      "Quando o sistema organiza as tarefas e você continua usando planilha para o lucro.",
    ],
    faq: [
      {
        pergunta: "Vale pagar mais por um sistema completo?",
        resposta:
          "Depende do tamanho do problema. Se o escritório precisa de organização, um sistema simples resolve. Se uma margem errada custa mais do que a diferença de preço, o sistema que calcula isso paga a si mesmo.",
      },
      {
        pergunta: "A Pilar é difícil de usar?",
        resposta:
          "Você pode começar só com projetos e proposta e ligar financeiro e obra depois. Nada obriga a usar tudo no primeiro dia.",
      },
      {
        pergunta: "Posso testar antes?",
        resposta: "Pode. Veja a página de planos para as condições de teste e de cancelamento.",
      },
    ],
  },
  {
    slug: "plataforma-por-usuario",
    adversario: "Plataforma que cobra por usuário",
    headline: "Plataforma que cobra por usuário cresce com o seu custo.",
    headlineFim: "A Pilar cresce com o seu escritório.",
    lede: "Muitas plataformas de gestão cobram por faixa de usuários: quanto mais gente do escritório entra no sistema, mais o plano sobe. Isso desestimula o que dá resultado, que é colocar todo mundo para lançar, aprovar e consultar no mesmo lugar.",
    seo: {
      titulo: "Plataforma que cobra por usuário ou sistema sem limite de usuários?",
      descricao:
        "Plataforma de gestão com plano por faixa de usuários ou sistema sem limite para escritório de projeto? Compare preço, margem, alertas, IA e obra.",
      h1: "Pilar vs plataforma de gestão que cobra por usuário",
    },
    linhas: [
      {
        criterio: "Cobrança",
        pilar: "Por escritório, sem cobrança por usuário.",
        alternativa: "Por faixa de usuários: o plano sobe quando a equipe cresce.",
      },
      {
        criterio: "Quem entra no sistema",
        pilar: "Sócios, projetistas, financeiro e campo, sem pensar em licença.",
        alternativa: "Tende a limitar a quem lança e aprova, para caber na faixa.",
      },
      {
        criterio: "Margem do projeto",
        pilar: "Orçado contra executado, recalculada a cada lançamento, com aviso quando passa do orçado.",
        alternativa: "Costuma ter painel de rentabilidade, que depende de as horas estarem lançadas.",
      },
      {
        criterio: "Aditivo e escopo por disciplina",
        pilar: "Aditivo é registro do projeto, com valor e parcela, e cada disciplina tem seu escopo.",
        alternativa: "Costuma não ter: o escopo fica em documento ou no contrato.",
      },
      {
        criterio: "Captura de horas",
        pilar: "Ainda não captura horas sozinha a partir dos programas de projeto.",
        alternativa: "Algumas registram o tempo automaticamente, e é um ponto forte.",
      },
      {
        criterio: "Assistente com IA",
        pilar: "Agente que prepara e consulta, com aprovação antes de gravar, e conector para ChatGPT e Claude.",
        alternativa: "Costuma ter copiloto de perguntas e respostas sobre os dados.",
      },
      {
        criterio: "Obra",
        pilar: "Diário, cronograma, cotações e conta da obra, com app de campo.",
        alternativa: "Varia: muitas têm diário e compras, poucas têm conta da obra.",
      },
    ],
    quandoMigrar: [
      "Quando a equipe cresceu e o plano subiu de faixa só por causa de mais acessos.",
      "Quando parte do escritório fica de fora do sistema para não pagar mais uma licença.",
      "Quando o painel de rentabilidade depende de horas que ninguém lança direito.",
    ],
    faq: [
      {
        pergunta: "A Pilar cobra por usuário?",
        resposta: "Não. O plano é por escritório. Veja a página de planos para os valores atuais.",
      },
      {
        pergunta: "A Pilar registra as horas sozinha?",
        resposta:
          "Hoje não. Ela não lê o arquivo aberto nos programas de projeto. Algumas plataformas fazem isso, e é um bom motivo para escolhê-las se esse for o seu maior problema.",
      },
      {
        pergunta: "Como a margem é calculada sem as horas?",
        resposta:
          "Pelo orçado contra o que foi lançado de custo no projeto, a cada lançamento, com aviso quando o custo passa do orçado.",
      },
    ],
  },
];

export const COMPARATIVOS_POR_SLUG: Record<ComparativoSlug, Comparativo> = COMPARATIVOS.reduce(
  (acc, c) => ({ ...acc, [c.slug]: c }),
  {} as Record<ComparativoSlug, Comparativo>
);
