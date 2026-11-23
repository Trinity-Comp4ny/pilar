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
disponível. A criação de proposta emite o evento após a gravação, com a empresa do registro. Título,
identificador da proposta e valores ficam fora do evento. O evento de projeto só é emitido
quando a criação já passou pela etapa que pode revertê-la por falha nas disciplinas. O PostHog respeita o consentimento.
Anote a cobertura do consentimento e a data de início do evento ao comparar
coortes.

## Validar a primeira medição

1. No PostHog, monte um funil de onboarding para primeiro projeto ou proposta. Use
   `empresa_id` como propriedade constante entre as etapas. Para contar escritórios,
   deduplique os eventos por empresa e use o primeiro evento de valor posterior ao
   onboarding. Separe empresas sem atribuição e coortes que ainda não completaram a janela.
2. Use a interseção de empresas distintas com atividade de produto em duas janelas
   consecutivas de 28 dias. Divida pela base da janela anterior e registre o intervalo,
   a definição de atividade e a proporção de eventos com `empresa_id`.
3. Concilie, em privado, a contagem de novas assinaturas pagas com as cobranças
   confirmadas. Use [Custo por empresa](./CUSTO_POR_EMPRESA.md) para conciliar
   eventos de uso com as faturas do mesmo período. Registre separadamente consumo
   sem custo identificado e custos internos que possam aparecer nas duas fontes.

Publique apenas números agregados com período, ambiente e cobertura. Compare a primeira
medição com os eventos do escritório de teste no mesmo período antes de usá-la como referência.
