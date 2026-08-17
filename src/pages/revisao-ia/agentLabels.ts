// Rótulos humanos para runs/ações dos agentes (compartilhado entre a mesa de
// trabalho e o modal de raciocínio). Ver spec 007.

const TYPE_LABEL: Record<string, string> = {
  orcamento_honorarios: "Orçamento de honorários",
  criar_lead: "Novo lead",
  criar_cliente: "Novo cliente",
  criar_projeto: "Novo projeto",
  criar_receita: "Nova receita",
  criar_despesa: "Nova despesa",
  criar_cartao: "Novo cartão",
  criar_proposta: "Nova proposta",
  criar_aditivo: "Novo aditivo",
  criar_fornecedor: "Novo fornecedor",
  criar_marco: "Novo marco",
  fechar_folha: "Fechamento de folha",
  acao: "Ação",
  consulta: "Consulta",
  // IA Hub (spec 045) — copilots dormentes que gravam em agent_runs só como rastro.
  aditivo_copilot: "Aditivo (copiloto)",
  diagnostico_precificacao: "Diagnóstico de precificação",
  documentos: "Documento gerado",
  fechamento_mensal: "Fechamento mensal",
  pauta_reuniao: "Pauta de reunião",
  planejador_contratacao: "Planejamento de contratação",
  previsao_atraso: "Previsão de atraso",
  radar_cliente: "Radar de clientes",
  relatorio_executivo: "Relatório executivo",
  simulacao_impacto: "Simulação de impacto",
  perda_cliente: "Risco de perda de cliente",
  "cotacao-import": "Importação de cotação",
  "import-financeiro": "Importação financeira",
};

export function tipoLabel(agentType: string): string {
  return TYPE_LABEL[agentType] ?? agentType.replace(/_/g, " ");
}

const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  running: "Trabalhando",
  pending_review: "Aguardando você",
  approved: "Aprovado",
  executed: "Concluído",
  rejected: "Rejeitado",
  failed: "Falhou",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

// Traduz o tool_name cru de agent_actions numa frase de raciocínio legível.
export function toolLabel(tool: string): string {
  if (tool.startsWith("extrair_")) {
    return `Extraindo dados: ${tool.slice("extrair_".length).replace(/_/g, " ")}`;
  }
  if (tool.startsWith("consultar_")) {
    return `Consultando ${tool.slice("consultar_".length).replace(/_/g, " ")}`;
  }
  if (tool.startsWith("transicao_status:")) {
    const estado = tool.split(":")[1] ?? "";
    return statusLabel(estado);
  }
  const MAP: Record<string, string> = {
    classificar_intencao: "Entendendo o pedido",
    preparar_acao: "Preparando a ação",
    montar_rascunho: "Montando o rascunho",
    gerar_resposta: "Gerando a resposta",
    get_project_context: "Lendo o contexto do projeto",
    generate_orcamento: "Gerando o orçamento",
  };
  return MAP[tool] ?? tool.replace(/_/g, " ");
}
