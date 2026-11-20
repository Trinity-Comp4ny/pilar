# Ativação, retenção e custo por empresa

| Indicador | Fonte | Definição |
|---|---|---|
| Ativação | PostHog | Tempo entre `empresa_onboarding_concluido` e o primeiro `projeto_criado` ou `proposta_criada` por empresa |
| Retenção | Agente Produto e PostHog | Escritórios com atividade nos últimos 28 dias e nos 28 anteriores. Use coortes de ativação para distinguir retenção de crescimento da base |
| Conversão em pago | Assinaturas e `assinatura_ativada` | Conte a primeira assinatura paga por empresa no intervalo. Concilie o evento com o estado da assinatura |
| Uso de IA | `ai_usage_logs` | Tokens de entrada e saída por empresa, modelo e recurso. Converta usando a tarifa vigente do provedor |
| Agentes internos | `ops_execucoes.custo_usd` | Some o custo por agente e status no período. Concilie sobreposições com os totais dos provedores antes de consolidar |
| Custo e margem | Faturas de infraestrutura, IA e receita líquida confirmada | Divida custos em BRL pelas empresas ativas. Para margem por plano, atribua custos diretamente quando possível e documente o rateio dos demais |

Nos eventos do PostHog, deduplique por empresa quando o contexto estiver
disponível. A criação de proposta emite o evento após a gravação, sem título,
identificadores da proposta ou valores. O PostHog respeita o consentimento.
Anote a cobertura do consentimento e a data de início do evento ao comparar
coortes.
