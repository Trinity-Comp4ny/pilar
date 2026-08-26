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

export interface Modulo {
  slug: ModuloSlug;
  numero: string;
  nome: string;
  /** Frase curta do card no mega-menu. */
  resumo: string;
  /** Headline da página do módulo. */
  headline: string;
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
  features: { titulo: string; texto: string }[];
  /** Para onde este módulo aponta, na seção "Conecta com". */
  conecta: { slug: ModuloSlug; texto: string }[];
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
    headline: "Do primeiro contato ao dinheiro na conta.",
    lede: "Funil, proposta, contrato e financeiro no mesmo lugar. O lead que entra hoje vira a receita que você concilia no fim do mês, sem redigitar nada.",
    url: "app.pilarsoft.com.br/gestao/leads",
    cor: {
      fill: "bg-modulo-gestao",
      strong: "bg-modulo-gestao-strong",
      text: "text-modulo-gestao-strong",
      border: "border-modulo-gestao-strong",
      glow: "hsla(102, 73%, 60%, 0.28)",
    },
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
        titulo: "Folha com comprovante em PDF",
        texto:
          "Feche a competência e cada pessoa recebe o comprovante individual, com chave PIX e os projetos que tocou no mês.",
      },
      {
        titulo: "Carteira: contas e cartões juntos",
        texto: "Saldo das contas e faturas de cartão na mesma tela, com pagamento de fatura, sem controle paralelo.",
      },
      {
        titulo: "Relatório que sai igual à tela",
        texto: "Cinco relatórios com prévia e export em CSV, Excel ou PDF, levando só as colunas que ficaram visíveis.",
      },
    ],
    conecta: [
      {
        slug: "projetos",
        texto: "A proposta aprovada chega lá como projeto, com disciplinas e responsáveis definidos.",
      },
      { slug: "obra", texto: "Quem administra obra presta contas por lá: aporte, despesa com comprovante e sua taxa." },
    ],
    ctaPrimario: { label: "Testar grátis", tipo: "cadastro" },
  },
  {
    slug: "projetos",
    numero: "Módulo 02",
    nome: "Projetos",
    resumo: "Disciplina, prazo e responsável.",
    headline: "Disciplina, prazo e responsável sob controle.",
    lede: "Feito do jeito que escritório multidisciplinar trabalha: o projeto não é uma tarefa, é um conjunto de disciplinas com gente e data em cada uma.",
    url: "app.pilarsoft.com.br/projetos/cronograma",
    cor: {
      fill: "bg-modulo-projetos",
      strong: "bg-modulo-projetos-strong",
      text: "text-modulo-projetos-strong",
      border: "border-modulo-projetos-strong",
      glow: "hsla(210, 68%, 62%, 0.24)",
    },
    features: [
      {
        titulo: "Quadro com as suas colunas",
        texto:
          "O status vira coluna, e quem define quais existem é o escritório. Tem lista com filtro por disciplina para quem prefere tabela.",
      },
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
        titulo: "Fluxo padrão do escritório",
        texto:
          "Cadastre a sequência de etapas e disciplinas uma vez, e todo projeto novo nasce com ela e com responsável definido.",
      },
      {
        titulo: "Atraso pede justificativa",
        texto:
          "Mudou a data, o sistema exige o motivo. O histórico do projeto não fica com buracos na hora da conversa difícil.",
      },
      {
        titulo: "Vários responsáveis por disciplina",
        texto:
          "Disciplina raramente é de uma pessoa só. Dá para ter mais de um responsável, com etiqueta, link e comentário no mesmo lugar.",
      },
      {
        titulo: "Parcelas do contrato à vista",
        texto: "Valor contratado, recebido, pendente e atrasado na aba do projeto, com um clique para marcar recebido.",
      },
      {
        titulo: "Mapa dos projetos",
        texto: "Todo contrato em andamento geolocalizado, com filtro por status, para quem atende mais de uma cidade.",
      },
    ],
    conecta: [
      {
        slug: "gestao",
        texto: "O projeto nasceu de uma proposta aprovada lá, e as parcelas dele vivem no financeiro.",
      },
      { slug: "obra", texto: "Quando sai do papel, o cronograma de obra segue em dois níveis, alimentado pelo campo." },
    ],
    ctaPrimario: { label: "Testar grátis", tipo: "cadastro" },
  },
  {
    slug: "obra",
    numero: "Módulo 03",
    nome: "Obra",
    resumo: "O canteiro alimenta o escritório.",
    headline: "O canteiro alimenta o escritório.",
    lede: "Diário de obra que chega preenchido do celular, cotação de material comparada lado a lado e prestação de contas para quem administra obra por taxa.",
    url: "app.pilarsoft.com.br/obras/diario",
    cor: {
      fill: "bg-modulo-obra",
      strong: "bg-modulo-obra-strong",
      text: "text-modulo-obra-strong",
      border: "border-modulo-obra-strong",
      glow: "hsla(32, 78%, 58%, 0.26)",
    },
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
      {
        titulo: "Cronograma em dois níveis",
        texto: "Frentes de serviço com passos dentro, e o campo marca cada tarefa como avançou, concluiu ou parou.",
      },
      {
        titulo: "Orçamento do fornecedor lido por IA",
        texto:
          "Fotografe o orçamento ou solte o PDF. O agente reconhece se é cesta ou comparação entre lojas e devolve os itens com preço e prazo.",
      },
      {
        titulo: "Cotação comparada lado a lado",
        texto: "Propostas de fornecedores na mesma tabela, cesta com vários itens, e a vencedora eleita com histórico.",
      },
      {
        titulo: "Conta da obra",
        texto:
          "Aporte do cliente, despesa com comprovante, saldo e a sua taxa de administração calculada a cada lançamento.",
      },
      {
        titulo: "Estoque do canteiro",
        texto: "Entrada, saída e saldo valorizado, para enxergar o dinheiro do cliente parado em material.",
      },
    ],
    conecta: [
      { slug: "gestao", texto: "A despesa da obra é despesa do escritório, e cai no mesmo financeiro." },
      {
        slug: "projetos",
        texto: "A obra executa o que o projeto especificou, e o cliente vê os dois no mesmo portal.",
      },
    ],
    ctaPrimario: { label: "Falar com a gente", tipo: "contato" },
  },
  {
    slug: "portal",
    numero: "Portal do cliente",
    nome: "Portal do cliente",
    resumo: "Seu cliente acompanha sozinho.",
    headline: "Seu cliente acompanha sozinho. Seu WhatsApp descansa.",
    lede: "Um link só de leitura, sem conta e sem aplicativo. Quem contratou projeto vê disciplina e entrega; quem contratou obra vê aporte, despesa com comprovante e a sua taxa.",
    url: "app.pilarsoft.com.br/portal/santa-rita",
    cor: {
      fill: "bg-modulo-gestao",
      strong: "bg-modulo-gestao-strong",
      text: "text-modulo-gestao-strong",
      border: "border-modulo-gestao-strong",
      glow: "hsla(102, 73%, 60%, 0.28)",
    },
    features: [
      {
        titulo: "Um link, sem cadastro",
        texto: "O cliente abre e vê. Não cria conta, não instala nada, não pede senha para ninguém.",
      },
      {
        titulo: "Só leitura, sempre",
        texto: "Ele acompanha o andamento, mas não altera nada. O que ele vê é o que está no sistema, sem você exportar.",
      },
      {
        titulo: "Duas visões, um portal",
        texto: "Projeto mostra disciplina, entrega e parcela. Obra mostra aporte, despesa com comprovante e saldo em conta.",
      },
      {
        titulo: "Menos cobrança no seu telefone",
        texto: "A pergunta de sexta à tarde some quando o cliente tem onde olhar no horário dele.",
      },
    ],
    conecta: [
      { slug: "projetos", texto: "O andamento que ele vê vem do cronograma por disciplina." },
      { slug: "obra", texto: "A prestação de contas sai da conta da obra, sem planilha paralela." },
    ],
    ctaPrimario: { label: "Testar grátis", tipo: "cadastro" },
  },
  {
    slug: "campo",
    numero: "Pilar Campo",
    nome: "Pilar Campo",
    resumo: "O canteiro registra, sem sinal.",
    headline: "O canteiro registra. Sem sinal e sem e-mail.",
    lede: "O encarregado abre no navegador do celular, registra o dia e vai embora. Sem rede, tudo fica no aparelho e sobe sozinho quando o sinal volta.",
    url: "app.pilarsoft.com.br/campo/diario",
    cor: {
      fill: "bg-modulo-obra",
      strong: "bg-modulo-obra-strong",
      text: "text-modulo-obra-strong",
      border: "border-modulo-obra-strong",
      glow: "hsla(32, 78%, 58%, 0.26)",
    },
    features: [
      {
        titulo: "Funciona no subsolo",
        texto: "Sem rede, o dia inteiro fica guardado no aparelho e sobe sozinho quando o sinal volta, foto por foto, sem duplicar.",
      },
      {
        titulo: "Login que o gestor entrega na mão",
        texto: "Quem trabalha em obra costuma não ter e-mail corporativo. O gestor gera usuário e senha, com acesso limitado a uma obra.",
      },
      {
        titulo: "Foto, medição e tarefa na mesma tela",
        texto: "Clima, efetivo, atividade, foto do serviço, quantidade executada e a tarefa do cronograma marcada como concluída.",
      },
      {
        titulo: "Chega pronto no escritório",
        texto: "O que o encarregado registrou aparece no diário da obra sem ninguém digitar de novo.",
      },
    ],
    conecta: [
      { slug: "obra", texto: "O registro do dia alimenta o diário e o cronograma da obra." },
      { slug: "portal", texto: "O que foi medido no canteiro vira andamento no portal do cliente." },
    ],
    ctaPrimario: { label: "Falar com a gente", tipo: "contato" },
  },
];

export const MODULOS_POR_SLUG: Record<ModuloSlug, Modulo> = MODULOS.reduce(
  (acc, m) => ({ ...acc, [m.slug]: m }),
  {} as Record<ModuloSlug, Modulo>
);
