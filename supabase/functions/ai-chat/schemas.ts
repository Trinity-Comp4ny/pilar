import { z } from "../_shared/schemas.ts";

export const FEATURE_KEY = "ai_chat";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
export const RequestSchema = z.object({
  message: z.string().trim().min(1, "mensagem vazia").max(2000),
  sessionId: z.string().uuid().optional(),
  // Projeto em foco (spec 007): escopa a conversa a um projeto real do escritório.
  projetoId: z.string().uuid().optional(),
});

export const AGENTES = ["financeiro", "projetos", "comercial", "obras", "equipe", "geral"] as const;
export type Agente = (typeof AGENTES)[number];

export const ENTIDADES_CRIAVEIS = [
  "lead",
  "projeto",
  "receita",
  "despesa",
  "cartao",
  "folha",
  "cliente",
  "fornecedor",
  "categoria",
  "conta",
  "centro_custo",
  "pessoa",
  "proposta",
  "marco",
  "disciplina",
  "aditivo",
] as const;

export const OPERACOES = [
  "converter_lead",
  "converter_proposta",
  "marcar_recebido",
  "marcar_pago",
  "quitar_parcela",
  "pagar_fatura",
  "convidar_portal",
] as const;

export const IntentSchema = z.object({
  agente: z.enum(AGENTES),
  modo: z.enum(["consulta", "acao", "operacao"]),
  entidade: z.enum(ENTIDADES_CRIAVEIS).nullish(),
  operacao: z.enum(OPERACOES).nullish(),
  motivo: z.string().max(300),
});

export const RespostaSchema = z.object({
  resposta: z.string().min(1),
});

// Extração de lead (modo ação). O agente devolve os campos que conseguiu inferir;
// se não houver nome, sinaliza para perguntarmos ao usuário em vez de criar rascunho.
// nullish() em todos os campos: o Gemini devolve `null` (não `undefined`) para o que não preencheu.
export const LeadExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  lead: z.object({
    nome: z.string().max(200).nullish(),
    sobrenome: z.string().max(200).nullish(),
    email: z.string().max(200).nullish(),
    contato: z.string().max(100).nullish(),
    origem: z.string().max(200).nullish(),
    valor_estimado: z.number().nonnegative().nullish(),
    empresa_lead: z.string().max(200).nullish(),
    cnpj: z.string().max(40).nullish(),
    notas: z.string().max(1000).nullish(),
  }),
});

// Extração de projeto (modo ação). cliente_nome é uma DICA textual — o card resolve para cliente_id.
export const ProjetoExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  projeto: z.object({
    nome: z.string().max(200).nullish(),
    codigo_projeto: z.string().max(60).nullish(),
    cliente_nome: z.string().max(200).nullish(),
    localizacao: z.string().max(300).nullish(),
    valor_contrato: z.number().nonnegative().nullish(),
    prioridade: z.enum(["Alta", "Media", "Baixa"]).nullish(),
    area_m2: z.number().nonnegative().nullish(),
    data_inicio: z.string().max(20).nullish(),
    data_previsao: z.string().max(20).nullish(),
    data_final: z.string().max(20).nullish(),
    parcelas: z.string().max(10).nullish(),
    observacao: z.string().max(1000).nullish(),
  }),
});

// Financeiro (fase 1 — à vista). *_nome são dicas textuais; o card resolve para *_id.
export const ReceitaExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  receita: z.object({
    descricao: z.string().max(300).nullish(),
    valor: z.number().nonnegative().nullish(),
    status: z.enum(["Pendente", "Recebido"]).nullish(),
    data_vencimento: z.string().max(20).nullish(),
    data_recebimento: z.string().max(20).nullish(),
    forma_pagamento: z.string().max(60).nullish(),
    categoria_nome: z.string().max(120).nullish(),
    projeto_nome: z.string().max(200).nullish(),
    cliente_nome: z.string().max(200).nullish(),
    observacao: z.string().max(1000).nullish(),
    parcelas: z.number().int().min(1).max(360).nullish(),
  }),
});

export const DespesaExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  despesa: z.object({
    descricao: z.string().max(300).nullish(),
    valor: z.number().nonnegative().nullish(),
    status: z.enum(["Pendente", "Pago"]).nullish(),
    data_vencimento: z.string().max(20).nullish(),
    data_pagamento: z.string().max(20).nullish(),
    forma_pagamento: z.string().max(60).nullish(),
    categoria_nome: z.string().max(120).nullish(),
    projeto_nome: z.string().max(200).nullish(),
    fornecedor_nome: z.string().max(200).nullish(),
    cartao_nome: z.string().max(120).nullish(),
    data_competencia: z.string().max(20).nullish(),
    observacao: z.string().max(1000).nullish(),
    parcelas: z.number().int().min(1).max(360).nullish(),
  }),
});

export const CartaoExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  cartao: z.object({
    nome: z.string().max(120).nullish(),
    limite: z.number().nonnegative().nullish(),
    dia_fechamento: z.number().int().nullish(),
    dia_vencimento: z.number().int().nullish(),
    tipo: z.enum(["credito", "debito"]).nullish(),
  }),
});

export const FolhaExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  folha: z.object({
    mes: z.number().int().min(1).max(12).nullish(),
    ano: z.number().int().min(2000).max(2100).nullish(),
  }),
});

// ── Onda 1: cadastros atômicos ──
export const S = () => z.string().max(300).nullish();
export const N = () => z.number().nonnegative().nullish();

export const ClienteExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  cliente: z.object({
    nome: S(),
    sobrenome: S(),
    cpf_cnpj: S(),
    email: S(),
    contato: S(),
    tipo_nf: z.enum(["servico", "produto", "misto"]).nullish(),
    origem: S(),
    endereco: S(),
  }),
});
export const FornecedorExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  fornecedor: z.object({ nome: S(), cnpj: S(), contato: S(), email: S(), telefone: S() }),
});
export const CategoriaExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  categoria: z.object({ nome: S(), tipo: z.enum(["Receita", "Despesa"]).nullish() }),
});
export const ContaExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  conta: z.object({ nome: S(), banco: S(), saldo_inicial: N(), chave_pix: S(), tipo_chave_pix: S() }),
});
export const CentroCustoExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  centro_custo: z.object({ nome: S(), codigo: S(), descricao: S() }),
});
export const PessoaExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  pessoa: z.object({
    primeiro_nome: S(),
    sobrenome: S(),
    email: S(),
    cargo: S(),
    cpf: S(),
    telefone: S(),
    tipo_contrato: S(),
    salario_fixo: N(),
    valor_m2: N(),
    cnpj: S(),
    razao_social: S(),
    pis_nit: S(),
  }),
});
export const PropostaExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  proposta: z.object({
    titulo: S(),
    cliente_nome: S(),
    lead_nome: S(),
    valor_proposto: N(),
    area_m2: N(),
    localizacao: S(),
    prazo_estimado_dias: z.number().int().nullish(),
    validade: S(),
    observacao: S(),
  }),
});
export const MarcoExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  marco: z.object({
    nome: S(),
    valor: N(),
    projeto_nome: S(),
    disciplina: S(),
    percentual: N(),
    data_prevista: S(),
  }),
});
export const DisciplinaExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  disciplina: z.object({
    nome: S(),
    projeto_nome: S(),
    prioridade: S(),
    horas_estimadas: N(),
    custo_hora: N(),
    data_inicio: S(),
    data_fim: S(),
  }),
});

export const AditivoExtractionSchema = z.object({
  tem_nome: z.boolean(),
  pergunta: z.string().max(300).nullish(),
  aditivo: z.object({
    projeto_nome: S(),
    descricao: S(),
    justificativa: S(),
    itens: z.array(z.object({ descricao: S(), disciplina: S(), horas: N(), custo: N() })).nullish(),
  }),
});

export const AGENTE_LABEL: Record<Agente, string> = {
  financeiro: "Agente Financeiro",
  projetos: "Agente de Projetos",
  comercial: "Agente Comercial",
  obras: "Agente de Obras",
  equipe: "Agente de Equipe",
  geral: "Agente",
};
