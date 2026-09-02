/**
 * Fonte única dos módulos da landing: alimenta o mega-menu do header, a seção
 * de módulos da home e as páginas /gestao, /projetos, /obra, /portal e /campo.
 *
 * Portal e Campo entraram como entradas próprias porque são o que o cliente e
 * o canteiro veem, e cada um merece uma página para onde mandar quem se
 * interessou pelo cartão do bento.
 *
 * Só entra aqui funcionalidade que existe de fato no produto. Escopo, aditivo
 * e orçamento por fase ficaram de fora de propósito: as tabelas existem, a
 * tela não.
 */

export type ModuloSlug = "gestao" | "projetos" | "obra" | "portal" | "campo";

export type MockNome =
  | "kanban"
  | "financeiro"
  | "folha"
  | "quadro"
  | "gantt"
  | "parcelas"
  | "diario"
  | "cotacao"
  | "conta-obra"
  | "portal-projeto"
  | "portal-obra"
  | "campo-diario"
  | "campo-tarefas";

export interface Modulo {
  slug: ModuloSlug;
  numero: string;
  nome: string;
  /** Frase curta do card no mega-menu. */
  resumo: string;
  /** Headline da página do módulo (parte reta). */
  headline: string;
  /** Fim da headline, renderizado em itálico apagado, no padrão das seções da home. */
  headlineFim: string;
  lede: string;
  /** URL falsa mostrada na barra do frame de produto. */
  url: string;
  /** Classes de cor derivadas dos tokens (ver tokens.css). */
  cor: {
    fill: string;
    strong: string;
    text: string;
    border: string;
    /** Mesmo matiz do fill, em hsla, pro spotlight que segue o mouse (não dá pra usar classe Tailwind num gradient inline). */
    glow: string;
  };
  /**
   * Funcionalidades organizadas em grupos temáticos: a página do módulo
   * renderiza um bloco por grupo, com o print da tela ao lado.
   * `img` aponta pro print real em public/screens; enquanto o arquivo não
   * existe, a página cai no desenho vetorial do módulo.
   */
  grupos: {
    titulo: string;
    frase: string;
    img: string;
    /** Qual desenho vetorial mostrar enquanto o print real não existe (ver GroupMock). */
    mock: MockNome;
    features: { titulo: string; texto: string }[];
  }[];
  /** Para onde este módulo aponta, na seção "Conecta com". */
  conecta: { slug: ModuloSlug; texto: string }[];
  /** Objeções reais de quem chega na página, respondidas antes do CTA final. */
  faq: { pergunta: string; resposta: string }[];
  /**
   * Obra ainda não entra em nenhum plano (`includedInPlans: []`) e nasce
   * desligada, então o CTA não pode prometer autoatendimento.
   */
  ctaPrimario: { label: string; tipo: "cadastro" | "contato" };
}

export const MODULOS: Modulo[] = [
  {
    slug: "gestao",
    numero: "Módulo 01",
    nome: "Gestão",
    resumo: "Do lead ao dinheiro na conta.",
    headline: "Do primeiro contato",
    headlineFim: "ao dinheiro na conta.",
    lede: "Funil, proposta, contrato e financeiro no mesmo lugar. O lead que entra hoje vira a receita que você concilia no fim do mês, sem redigitar nada.",
    url: "app.pilarsoft.com.br/gestao/leads",
    cor: {
      fill: "bg-modulo-gestao",
      strong: "bg-modulo-gestao-strong",
      text: "text-modulo-gestao-strong",
      border: "border-modulo-gestao-strong",
      glow: "hsla(102, 73%, 60%, 0.28)",
    },
    grupos: [
      {
        titulo: "Do lead à proposta assinada",
        frase: "O comercial inteiro numa tela: quem entrou, em que etapa está e por que saiu.",
        img: "/screens/gestao-comercial.png",
        mock: "kanban",
        features: [
          {
            titulo: "Funil de leads em kanban",
            texto:
              "Seis colunas, arrastar entre elas, KPIs de conversão e motivo de perda obrigatório, então você aprende por que perdeu.",
          },
          {
            titulo: "Cliente preenchido pelo CNPJ",
            texto: "Digite o CNPJ e o cadastro vem pronto, sem copiar razão social e endereço na mão.",
          },
          {
            titulo: "Proposta por disciplina, no seu template",
            texto:
              "Monte o escopo por disciplina, gere o documento em DOCX com o modelo do escritório e envie por e-mail sem sair do sistema.",
          },
        ],
      },
      {
        titulo: "Aprovou, virou projeto e receita",
        frase: "O aceite do cliente dispara o resto: projeto criado, parcelas no financeiro, nada redigitado.",
        img: "/screens/gestao-financeiro.png",
        mock: "financeiro",
        features: [
          {
            titulo: "Aprovou, virou projeto",
            texto:
              "A proposta aceita vira projeto com as disciplinas, e você escolhe parcelas mensais ou marcos: as receitas nascem no financeiro no mesmo clique.",
          },
          {
            titulo: "Extrato e fatura lidos por IA",
            texto:
              "Solte o PDF do banco ou do cartão. O agente separa receita de despesa, identifica parcela 3 de 12 e sugere a categoria do seu plano de contas.",
          },
          {
            titulo: "Carteira: contas e cartões juntos",
            texto:
              "Saldo das contas e faturas de cartão na mesma tela, com pagamento de fatura, sem controle paralelo.",
          },
        ],
      },
      {
        titulo: "O mês fecha sem planilha",
        frase: "Folha, comprovante e relatório saem do mesmo lugar em que o dinheiro entrou.",
        img: "/screens/gestao-fechamento.png",
        mock: "folha",
        features: [
          {
            titulo: "Folha com comprovante em PDF",
            texto:
              "Feche a competência e cada pessoa recebe o comprovante individual, com chave PIX e os projetos que tocou no mês.",
          },
          {
            titulo: "Relatório que sai igual à tela",
            texto:
              "Cinco relatórios com prévia e export em CSV, Excel ou PDF, levando só as colunas que ficaram visíveis.",
          },
        ],
      },
    ],
    conecta: [
      {
        slug: "projetos",
        texto: "A proposta aprovada chega lá como projeto, com disciplinas e responsáveis definidos.",
      },
      { slug: "obra", texto: "Quem administra obra presta contas por lá: aporte, despesa com comprovante e sua taxa." },
    ],
    faq: [
      {
        pergunta: "Já uso planilha. A troca dói?",
        resposta:
          "Você não para tudo pra migrar: cadastre os projetos ativos e siga. O extrato do banco entra por PDF, lido pela IA, e você aprova antes de gravar qualquer coisa.",
      },
      {
        pergunta: "A proposta sai com a cara do meu escritório?",
        resposta: "Sai em DOCX no seu template, montada por disciplina, e vai por e-mail sem sair do sistema.",
      },
      {
        pergunta: "Quanto custa?",
        resposta:
          "O preço é por escritório, sem cobrança por usuário, e todo plano tem a plataforma inteira. O trial é de 14 dias, sem cartão.",
      },
    ],
    ctaPrimario: { label: "Testar grátis", tipo: "cadastro" },
  },
  {
    slug: "projetos",
    numero: "Módulo 02",
    nome: "Projetos",
    resumo: "Disciplina, prazo e responsável.",
    headline: "Disciplina, prazo e responsável",
    headlineFim: "sob controle.",
    lede: "Feito do jeito que escritório multidisciplinar trabalha: o projeto não é uma tarefa, é um conjunto de disciplinas com gente e data em cada uma.",
    url: "app.pilarsoft.com.br/projetos/cronograma",
    cor: {
      fill: "bg-modulo-projetos",
      strong: "bg-modulo-projetos-strong",
      text: "text-modulo-projetos-strong",
      border: "border-modulo-projetos-strong",
      glow: "hsla(210, 68%, 62%, 0.24)",
    },
    grupos: [
      {
        titulo: "O quadro do jeito do escritório",
        frase: "Colunas, fluxo e responsáveis definidos por quem trabalha, não pelo software.",
        img: "/screens/projetos-quadro.png",
        mock: "quadro",
        features: [
          {
            titulo: "Quadro com as suas colunas",
            texto:
              "O status vira coluna, e quem define quais existem é o escritório. Tem lista com filtro por disciplina para quem prefere tabela.",
          },
          {
            titulo: "Fluxo padrão do escritório",
            texto:
              "Cadastre a sequência de etapas e disciplinas uma vez, e todo projeto novo nasce com ela e com responsável definido.",
          },
          {
            titulo: "Vários responsáveis por disciplina",
            texto:
              "Disciplina raramente é de uma pessoa só. Dá para ter mais de um responsável, com etiqueta, link e comentário no mesmo lugar.",
          },
        ],
      },
      {
        titulo: "Prazo que se defende sozinho",
        frase: "A carteira inteira na linha do tempo, e cada mudança de data com nome e motivo.",
        img: "/screens/projetos-cronograma.png",
        mock: "gantt",
        features: [
          {
            titulo: "Gantt da carteira inteira",
            texto:
              "Todos os projetos na linha do tempo. Arraste a borda da barra e a data de início e a previsão gravam direto.",
          },
          {
            titulo: "Concluiu, o próximo já sabe",
            texto:
              "Ao fechar uma disciplina, o responsável da etapa seguinte é avisado. Ninguém precisa lembrar de cobrar.",
          },
          {
            titulo: "Atraso pede justificativa",
            texto:
              "Mudou a data, o sistema exige o motivo. O histórico do projeto não fica com buracos na hora da conversa difícil.",
          },
        ],
      },
      {
        titulo: "O contrato mora junto do projeto",
        frase: "Quanto entrou, quanto falta e onde cada contrato está no mapa.",
        img: "/screens/projetos-contrato.png",
        mock: "parcelas",
        features: [
          {
            titulo: "Parcelas do contrato à vista",
            texto:
              "Valor contratado, recebido, pendente e atrasado na aba do projeto, com um clique para marcar recebido.",
          },
          {
            titulo: "Mapa dos projetos",
            texto:
              "Todo contrato em andamento geolocalizado, com filtro por status, para quem atende mais de uma cidade.",
          },
        ],
      },
    ],
    conecta: [
      {
        slug: "gestao",
        texto: "O projeto nasceu de uma proposta aprovada lá, e as parcelas dele vivem no financeiro.",
      },
      { slug: "obra", texto: "Quando sai do papel, o cronograma de obra segue em dois níveis, alimentado pelo campo." },
    ],
    faq: [
      {
        pergunta: "Meu fluxo não é igual ao de ninguém. Serve?",
        resposta:
          "As colunas do quadro e a sequência de etapas são suas: cadastre uma vez e todo projeto novo nasce nelas, com responsável definido.",
      },
      {
        pergunta: "E quando o prazo muda?",
        resposta:
          "Mudou a data, o sistema pede o motivo. O histórico do projeto fica inteiro pra hora da conversa com o cliente.",
      },
      {
        pergunta: "Uma disciplina aqui tem mais de um responsável.",
        resposta: "Lá também: mais de um responsável por disciplina, com etiqueta, link e comentário no mesmo lugar.",
      },
    ],
    ctaPrimario: { label: "Testar grátis", tipo: "cadastro" },
  },
  {
    slug: "obra",
    numero: "Módulo 03",
    nome: "Obra",
    resumo: "O canteiro alimenta o escritório.",
    headline: "O canteiro alimenta",
    headlineFim: "o escritório.",
    lede: "Diário de obra que chega preenchido do celular, cotação de material comparada lado a lado e prestação de contas para quem administra obra por taxa.",
    url: "app.pilarsoft.com.br/obras/diario",
    cor: {
      fill: "bg-modulo-obra",
      strong: "bg-modulo-obra-strong",
      text: "text-modulo-obra-strong",
      border: "border-modulo-obra-strong",
      glow: "hsla(32, 78%, 58%, 0.26)",
    },
    grupos: [
      {
        titulo: "O dia chega pronto do canteiro",
        frase: "O encarregado registra no celular e o escritório recebe sem digitar nada de novo.",
        img: "/screens/obra-diario.png",
        mock: "diario",
        features: [
          {
            titulo: "Diário que chega do celular",
            texto:
              "Clima, efetivo, atividade, ocorrência e pendência registrados no canteiro, com foto e medição, já na tela do escritório.",
          },
          {
            titulo: "Funciona sem sinal",
            texto:
              "Sem rede, o dia inteiro fica guardado no aparelho e sobe sozinho quando o sinal volta, foto por foto, sem duplicar.",
          },
          {
            titulo: "Login sem e-mail",
            texto:
              "Quem trabalha em obra costuma não ter e-mail corporativo. O gestor gera usuário e senha e entrega na mão, com acesso limitado a uma obra.",
          },
        ],
      },
      {
        titulo: "Material comprado sem rasteira",
        frase: "O orçamento do fornecedor entra por foto e sai numa tabela comparável.",
        img: "/screens/obra-cotacao.png",
        mock: "cotacao",
        features: [
          {
            titulo: "Orçamento do fornecedor lido por IA",
            texto:
              "Fotografe o orçamento ou solte o PDF. O agente reconhece se é cesta ou comparação entre lojas e devolve os itens com preço e prazo.",
          },
          {
            titulo: "Cotação comparada lado a lado",
            texto:
              "Propostas de fornecedores na mesma tabela, cesta com vários itens, e a vencedora eleita com histórico.",
          },
          {
            titulo: "Estoque do canteiro",
            texto: "Entrada, saída e saldo valorizado, para enxergar o dinheiro do cliente parado em material.",
          },
        ],
      },
      {
        titulo: "Execução e dinheiro na mesma conta",
        frase: "Cada frente com seu avanço, cada real do cliente prestando contas.",
        img: "/screens/obra-conta.png",
        mock: "conta-obra",
        features: [
          {
            titulo: "Cronograma em dois níveis",
            texto: "Frentes de serviço com passos dentro, e o campo marca cada tarefa como avançou, concluiu ou parou.",
          },
          {
            titulo: "Conta da obra",
            texto:
              "Aporte do cliente, despesa com comprovante, saldo e a sua taxa de administração calculada a cada lançamento.",
          },
        ],
      },
    ],
    conecta: [
      { slug: "gestao", texto: "A despesa da obra é despesa do escritório, e cai no mesmo financeiro." },
      {
        slug: "projetos",
        texto: "A obra executa o que o projeto especificou, e o cliente vê os dois no mesmo portal.",
      },
    ],
    faq: [
      {
        pergunta: "Meu mestre de obras não tem e-mail.",
        resposta: "Não precisa: o gestor gera usuário e senha e entrega na mão, com acesso limitado àquela obra.",
      },
      {
        pergunta: "O canteiro não tem sinal.",
        resposta: "O registro fica no aparelho e sobe sozinho quando a rede volta, foto por foto, sem duplicar.",
      },
      {
        pergunta: "Administro obra por taxa. A prestação de contas sai daí?",
        resposta:
          "Sai da conta da obra: aporte do cliente, despesa com comprovante e a sua taxa calculada a cada lançamento.",
      },
    ],
    ctaPrimario: { label: "Falar com a gente", tipo: "contato" },
  },
  {
    slug: "portal",
    numero: "Portal do cliente",
    nome: "Portal do cliente",
    resumo: "Seu cliente acompanha sozinho.",
    headline: "Seu cliente acompanha sozinho.",
    headlineFim: "Seu WhatsApp descansa.",
    lede: "Um link só de leitura, sem conta e sem aplicativo. Quem contratou projeto vê disciplina e entrega; quem contratou obra vê aporte, despesa com comprovante e a sua taxa.",
    url: "app.pilarsoft.com.br/portal/santa-rita",
    cor: {
      fill: "bg-modulo-gestao",
      strong: "bg-modulo-gestao-strong",
      text: "text-modulo-gestao-strong",
      border: "border-modulo-gestao-strong",
      glow: "hsla(102, 73%, 60%, 0.28)",
    },
    grupos: [
      {
        titulo: "Um link resolve",
        frase: "Sem conta, sem app e sem senha: o cliente abre e vê, e não muda nada.",
        img: "/screens/portal-link.png",
        mock: "portal-projeto",
        features: [
          {
            titulo: "Um link, sem cadastro",
            texto: "O cliente abre e vê. Não cria conta, não instala nada, não pede senha para ninguém.",
          },
          {
            titulo: "Só leitura, sempre",
            texto:
              "Ele acompanha o andamento, mas não altera nada. O que ele vê é o que está no sistema, sem você exportar.",
          },
        ],
      },
      {
        titulo: "Cada contrato, sua visão",
        frase: "Projeto mostra andamento e parcela; obra mostra o dinheiro prestando contas.",
        img: "/screens/portal-visoes.png",
        mock: "portal-obra",
        features: [
          {
            titulo: "Duas visões, um portal",
            texto:
              "Projeto mostra disciplina, entrega e parcela. Obra mostra aporte, despesa com comprovante e saldo em conta.",
          },
          {
            titulo: "Menos cobrança no seu telefone",
            texto: "A pergunta de sexta à tarde some quando o cliente tem onde olhar no horário dele.",
          },
        ],
      },
    ],
    conecta: [
      { slug: "projetos", texto: "O andamento que ele vê vem do cronograma por disciplina." },
      { slug: "obra", texto: "A prestação de contas sai da conta da obra, sem planilha paralela." },
    ],
    faq: [
      {
        pergunta: "Meu cliente vai precisar de mais um login?",
        resposta: "Não. É um link só de leitura, sem conta, sem app e sem senha.",
      },
      {
        pergunta: "Ele pode mexer em alguma coisa?",
        resposta: "Não. O portal é sempre só leitura, e o que ele vê é o que está no sistema, sem você exportar nada.",
      },
      {
        pergunta: "O que ele vê se contratou obra?",
        resposta:
          "Aporte, despesa com comprovante e saldo em conta. Quem contratou projeto vê disciplina, entrega e parcela.",
      },
    ],
    ctaPrimario: { label: "Testar grátis", tipo: "cadastro" },
  },
  {
    slug: "campo",
    numero: "Pilar Campo",
    nome: "Pilar Campo",
    resumo: "O canteiro registra, sem sinal.",
    headline: "O canteiro registra.",
    headlineFim: "Sem sinal e sem e-mail.",
    lede: "O encarregado abre no navegador do celular, registra o dia e vai embora. Sem rede, tudo fica no aparelho e sobe sozinho quando o sinal volta.",
    url: "app.pilarsoft.com.br/campo/diario",
    cor: {
      fill: "bg-modulo-obra",
      strong: "bg-modulo-obra-strong",
      text: "text-modulo-obra-strong",
      border: "border-modulo-obra-strong",
      glow: "hsla(32, 78%, 58%, 0.26)",
    },
    grupos: [
      {
        titulo: "Feito pro canteiro de verdade",
        frase: "Sem rede e sem e-mail corporativo: as duas realidades da obra, resolvidas.",
        img: "/screens/campo-offline.png",
        mock: "campo-diario",
        features: [
          {
            titulo: "Funciona no subsolo",
            texto:
              "Sem rede, o dia inteiro fica guardado no aparelho e sobe sozinho quando o sinal volta, foto por foto, sem duplicar.",
          },
          {
            titulo: "Login que o gestor entrega na mão",
            texto:
              "Quem trabalha em obra costuma não ter e-mail corporativo. O gestor gera usuário e senha, com acesso limitado a uma obra.",
          },
        ],
      },
      {
        titulo: "Registrar o dia leva minutos",
        frase: "Uma tela só pro que importa, e o escritório recebe sem redigitar.",
        img: "/screens/campo-registro.png",
        mock: "campo-tarefas",
        features: [
          {
            titulo: "Foto, medição e tarefa na mesma tela",
            texto:
              "Clima, efetivo, atividade, foto do serviço, quantidade executada e a tarefa do cronograma marcada como concluída.",
          },
          {
            titulo: "Chega pronto no escritório",
            texto: "O que o encarregado registrou aparece no diário da obra sem ninguém digitar de novo.",
          },
        ],
      },
    ],
    conecta: [
      { slug: "obra", texto: "O registro do dia alimenta o diário e o cronograma da obra." },
      { slug: "portal", texto: "O que foi medido no canteiro vira andamento no portal do cliente." },
    ],
    faq: [
      {
        pergunta: "Precisa instalar aplicativo?",
        resposta: "Não: abre no navegador do celular. E continua funcionando sem sinal.",
      },
      {
        pergunta: "Quem registra precisa de e-mail?",
        resposta: "Não. O gestor gera usuário e senha e entrega na mão, com acesso limitado àquela obra.",
      },
      {
        pergunta: "O que acontece com o que foi registrado?",
        resposta: "Vira diário e avanço de cronograma na tela do escritório, sem ninguém redigitar.",
      },
    ],
    ctaPrimario: { label: "Falar com a gente", tipo: "contato" },
  },
];

export const MODULOS_POR_SLUG: Record<ModuloSlug, Modulo> = MODULOS.reduce(
  (acc, m) => ({ ...acc, [m.slug]: m }),
  {} as Record<ModuloSlug, Modulo>
);
