# 173 — Briefing comercial e proposta para assinatura

**Status:** Draft

**Objetivo:** preservar o contexto do atendimento, registrar qual versão o cliente aceitou e
preparar o envio da versão final para assinatura.

## Briefing

O escritório começa o briefing no lead qualificado, antes de preparar a proposta. Para
cliente cadastrado direto, o escritório cria o briefing a partir de uma oportunidade ou
proposta daquele cliente. O registro acompanha o trabalho quando o lead vira cliente e
pode ser referenciado pelo projeto originado da proposta. Cada nova demanda do mesmo
cliente pode ter seu próprio briefing.

Na primeira entrega, a equipe preenche o briefing internamente. Campos iniciais:

| Campo | Para que serve |
| --- | --- |
| Objetivo e tipo de serviço | Entender qual problema o cliente quer resolver |
| Local e escopo preliminar | Preparar a proposta e registrar exclusões |
| Prazo desejado e restrições | Distinguir a expectativa do cliente da data contratada |
| Documentos necessários e próximos passos | Acompanhar o que falta antes de orçar ou executar |

Respostas coletadas em reunião ou pelo WhatsApp podem ser transcritas pela equipe.
Uma fase posterior pode apresentar campos selecionados em um formulário do cliente,
com revisão do escritório antes de atualizar o briefing. O cliente só vê os campos
incluídos naquele formulário.

## Proposta e assinatura

O link atual fica ligado à versão publicada do PDF. O aceite identifica essa versão.
Quando o escritório decidir obter assinatura, envia exatamente esse PDF, com
identificadores distintos para versão, tentativa e documento no provedor. O escritório
vê o estado do envio e pode baixar o documento assinado e a evidência do provedor.

Compare provedores com teste em sandbox. Critérios de seleção:

- Criar envelope a partir do PDF e recuperar o PDF assinado e o comprovante.
- Autenticar a origem dos webhooks e permitir conciliar status pela API.
- Informar limites, custo por documento, retenção e política de exportação.
- Validar o fluxo completo com um signatário e revisar com o escritório os tipos de
  documento e métodos de identificação exigidos.

## Critérios de aceite

1. A equipe inicia briefing pelo lead ou por uma nova demanda de cliente existente.
2. Converter lead ou proposta mantém o vínculo com o briefing e suas edições.
3. Um cliente com duas demandas visualiza apenas o briefing associado a cada fluxo.
4. A assinatura sempre referencia o PDF exato da versão aceita. Emitir versão nova
   exige uma nova decisão de envio.
5. Repetir envio ou receber duas vezes a mesma confirmação mantém uma trilha
   consistente. Uma confirmação tardia atualiza apenas o envelope correspondente.
6. O teste de sandbox comprova envio, assinatura e recuperação do documento.
