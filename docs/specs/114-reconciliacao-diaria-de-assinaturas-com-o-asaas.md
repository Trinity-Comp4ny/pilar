# SPEC: Reconciliação diária de assinaturas com o Asaas

**Data:** 2026-10-13  
**Status:** Em implementação  
**Autor:** Matheus Rezende  
**Módulo:** cobrança (assinatura do Pilar)

## Problema

O status da assinatura de cada empresa (`pilar_subscriptions.status`) só muda por
webhook do Asaas. Webhook perdido (fora do ar, timeout, evento novo não tratado) deixa
o banco diferente da cobrança real, e ninguém fica sabendo: empresa que pagou continua
"em atraso", empresa cancelada continua sendo cobrada, empresa inadimplente continua
"ativa".

## Objetivo

Toda divergência entre o banco e o Asaas aparece para o ultra admin em até um dia,
com o que está diferente e o que fazer.

**Fora de escopo:**

- Corrigir o banco sozinho. Mudar status de cobrança mexe no acesso do cliente; v1 só
  avisa e a correção é humana. Corrigir automaticamente os casos óbvios fica para depois,
  se o volume pedir.
- Cobrança das empresas aos clientes delas (`asaas_config`, Asaas de cada empresa).
- Pacote de tokens avulso (`pilar_token_pack_purchases`).

## Requisitos

1. Cron diário compara cada assinatura que tem `asaas_subscription_id` e não está
   `expired` com a assinatura e as últimas cobranças no Asaas da plataforma.
2. Divergências detectadas:
   - `cancelada_no_asaas`: banco ativa/em atraso, Asaas removida ou inativa.
   - `ativa_no_asaas`: banco cancelada, Asaas ainda ativa (continua cobrando).
   - `atraso_nao_registrado`: banco ativa, cobrança vencida em aberto no Asaas.
   - `pagamento_nao_registrado`: banco em atraso, última cobrança paga no Asaas.
   - `valor_divergente`: valor no Asaas diferente do preço do plano no ciclo do banco.
   - `ciclo_divergente`: ciclo no Asaas diferente do ciclo do banco.
3. Cada empresa com divergência gera um aviso ao ultra admin (sino e e-mail, SPEC 113)
   com a lista e o link para a aba Empresas. A mesma lista não é reenviada por 7 dias.
4. Falha ao consultar uma assinatura (Asaas fora, id inexistente) não interrompe as
   outras e vira alerta no Sentry.
5. Toda rodada fica registrada em `admin_audit_logs` (`billing`), com e sem divergência.

## Critérios de aceite

- [x] Cada um dos 6 casos do requisito 2 é detectado (`regras.test.ts`).
- [x] Assinatura em ordem não gera divergência.
- [x] Cobrança vencida há menos de 1 dia não conta como atraso (o webhook pode estar a caminho).
- [x] Aviso repetido dentro de 7 dias é suprimido (`regras.test.ts`).
- [ ] Rodada real em staging registra o resumo no `admin_audit_logs`.

## Dados e contratos

- Edge `reconciliar-assinaturas` (cron, `CRON_SECRET`), agendada por
  `reconciliar_assinaturas_disparar()` às 6h30, antes do `trial-expiry-daily`.
- Asaas: `GET /subscriptions/{id}` e `GET /subscriptions/{id}/payments?limit=5`.
- Aviso: `notificar_ultra_admins(empresa_id, 'reconciliacao_divergente', ...)`.

## Decisões e riscos

- Só avisa, não corrige (ver fora de escopo).
- Tolerância de 1 dia no atraso e de R$ 0,01 no valor, para não acusar o que o
  webhook ainda vai acertar ou diferença de arredondamento.
- Custo de API: 2 chamadas por assinatura por dia; com dezenas de clientes, irrelevante.
