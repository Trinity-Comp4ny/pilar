/**
 * Ferramentas abertas da landing (`/ferramentas/*`): utilidade de verdade para o
 * sócio do escritório, sem pedir cadastro. Atraem busca ("calculadora de honorários",
 * "modelo de proposta de projeto") e link de outros sites, e terminam no CTA dos planos.
 */

export type FerramentaSlug = "calculadora-de-honorarios" | "modelo-de-proposta";

export interface Ferramenta {
  slug: FerramentaSlug;
  nome: string;
  resumo: string;
  /** Title sem o " | Pilar". */
  tituloSeo: string;
  descricao: string;
  h1: string;
}

export const FERRAMENTAS: Ferramenta[] = [
  {
    slug: "calculadora-de-honorarios",
    nome: "Calculadora de honorários",
    resumo: "Custo da hora técnica do escritório, preço da hora e o valor de um projeto pelas horas estimadas.",
    tituloSeo: "Calculadora de honorários: custo e preço da hora técnica",
    descricao:
      "Calculadora de honorários para projeto de engenharia e arquitetura: custo da hora técnica, preço da hora com margem e impostos e valor do projeto.",
    h1: "Calculadora de honorários de projeto: custo e preço da hora técnica",
  },
  {
    slug: "modelo-de-proposta",
    nome: "Modelo de proposta de projeto",
    resumo: "Estrutura de proposta por disciplina, com escopo, exclusões, prazo e parcelas, para copiar ou baixar.",
    tituloSeo: "Modelo de proposta de projeto de engenharia e arquitetura",
    descricao:
      "Modelo de proposta de projeto de engenharia e arquitetura por disciplina: escopo, exclusões, revisões, prazo e parcelas. Copie ou baixe e adapte.",
    h1: "Modelo de proposta de projeto de engenharia e arquitetura",
  },
];

export const FERRAMENTAS_POR_SLUG = Object.fromEntries(FERRAMENTAS.map((f) => [f.slug, f])) as Record<
  FerramentaSlug,
  Ferramenta
>;

// ------------------------------------------------------------------ calculadora

export interface EntradaHonorarios {
  /** Aluguel, software, contador, internet, deslocamento: o que o escritório paga todo mês. */
  custosFixos: number;
  /** Salários, encargos e benefícios da equipe técnica e administrativa. */
  folha: number;
  /** Retirada dos sócios. Sócio que não se paga esconde o custo real da hora. */
  proLabore: number;
  /** Pessoas que produzem projeto (sócios técnicos inclusos). */
  pessoasTecnicas: number;
  horasPorMes: number;
  /** Parte das horas que vira projeto faturável (o resto é reunião, venda, administrativo). Em %. */
  produtividade: number;
  /** Lucro desejado sobre o custo. Em %. */
  margem: number;
  /** Impostos sobre o faturamento. Em %. */
  impostos: number;
  /** Horas estimadas para o projeto que está sendo orçado. */
  horasProjeto: number;
}

export interface ResultadoHonorarios {
  custoMensal: number;
  horasProdutivas: number;
  custoHora: number;
  precoHora: number;
  precoProjeto: number;
}

/**
 * Preço da hora = custo da hora × (1 + margem) ÷ (1 − impostos).
 * O imposto incide sobre o preço, não sobre o custo: por isso divide, não multiplica.
 * Entrada inválida (zero hora produtiva, imposto de 100%) devolve zero em vez de Infinity.
 */
export function calcularHonorarios(e: EntradaHonorarios): ResultadoHonorarios {
  const custoMensal = Math.max(0, e.custosFixos) + Math.max(0, e.folha) + Math.max(0, e.proLabore);
  const horasProdutivas =
    Math.max(0, e.pessoasTecnicas) * Math.max(0, e.horasPorMes) * (Math.max(0, e.produtividade) / 100);
  const custoHora = horasProdutivas > 0 ? custoMensal / horasProdutivas : 0;
  const divisor = 1 - e.impostos / 100;
  const precoHora = divisor > 0 ? (custoHora * (1 + Math.max(0, e.margem) / 100)) / divisor : 0;
  return {
    custoMensal,
    horasProdutivas,
    custoHora,
    precoHora,
    precoProjeto: precoHora * Math.max(0, e.horasProjeto),
  };
}

/** "12.500,50" → 12500.5. Aceita também ponto decimal ("12500.5"). */
export function lerNumero(texto: string): number {
  const limpo = texto.trim().replace(/\s/g, "");
  if (!limpo) return 0;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

// ------------------------------------------------------------------ modelo de proposta

/**
 * Texto do modelo de proposta. Colchetes marcam o que o escritório preenche.
 * Não é documento jurídico: a página recomenda revisão do contrato por advogado.
 */
export const MODELO_PROPOSTA = `PROPOSTA DE PRESTAÇÃO DE SERVIÇOS DE PROJETO
[Nome do escritório] · [CNPJ] · [registro CREA/CAU do responsável técnico]
Proposta nº [000/AAAA] · Data: [dd/mm/aaaa] · Validade: [30] dias

1. CLIENTE
Nome/razão social: [ ]
CPF/CNPJ: [ ]
Contato: [nome, telefone, e-mail]

2. OBJETO
Elaboração dos projetos listados abaixo para [tipo de edificação], com [área] m², localizada em [endereço].
Documentos recebidos como base: [levantamento, sondagem, projeto de arquitetura revisão X, programa de necessidades].

3. ESCOPO POR DISCIPLINA
Para cada disciplina: o que será entregue, em que nível de detalhe e em que formato.

3.1 [Arquitetura]
- Etapas: [estudo preliminar, anteprojeto, projeto legal, executivo]
- Entregáveis: [plantas, cortes, fachadas, detalhamentos, memorial]
- Formato: [PDF + DWG/IFC]

3.2 [Estrutural]
- Entregáveis: [formas, armaduras, memorial de cálculo]
- Formato: [PDF + DWG/IFC]

3.3 [Instalações elétricas]
3.4 [Instalações hidrossanitárias]
3.5 [Climatização / HVAC]
(Repetir a estrutura para cada disciplina contratada.)

4. REVISÕES INCLUÍDAS
[2] rodadas de revisão por etapa, a partir dos comentários consolidados do cliente.
Alteração de premissa já aprovada (programa, área, sistema construtivo) é escopo novo e entra por aditivo.

5. O QUE NÃO ESTÁ INCLUÍDO
- Taxas, emolumentos e registros em órgãos públicos
- Levantamento topográfico, sondagem e laudos
- Disciplinas não listadas no item 3
- Acompanhamento de obra (pode ser contratado à parte)
- Cópias físicas e plotagens

6. PRAZO
Início: [data ou condição, ex.: assinatura e recebimento da base].
| Disciplina | Prazo da entrega | Depende de |
| [Arquitetura - anteprojeto] | [20 dias úteis] | [aprovação do estudo preliminar] |
| [Estrutural] | [25 dias úteis] | [arquitetura aprovada] |
O prazo é suspenso enquanto houver pendência de informação ou aprovação do cliente.

7. VALOR E FORMA DE PAGAMENTO
| Disciplina | Valor |
| [Arquitetura] | R$ [ ] |
| [Estrutural] | R$ [ ] |
| Total | R$ [ ] |

Parcelas vinculadas a entregas:
- [30]% na assinatura
- [40]% na entrega do [anteprojeto]
- [30]% na entrega do [executivo]
Forma: [PIX/boleto/transferência]. Atraso: [multa e juros conforme contrato].

8. RESPONSABILIDADE TÉCNICA
Emissão de ART/RRT por disciplina, pelo profissional responsável.

9. ACEITE
Esta proposta vira contrato após assinatura das partes. [Recomendado: revisão do contrato por advogado.]

_______________________________          _______________________________
[Escritório]                                          [Cliente]
`;
