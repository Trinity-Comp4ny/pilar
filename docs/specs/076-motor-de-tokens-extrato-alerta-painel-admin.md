# SPEC: Motor de tokens — extrato, alerta de saldo baixo e painel ultra-admin

**Data:** 2026-09-01
**Status:** Aprovada
**Autor:** Matheus (CEO) + Claude
**Módulo:** ia / billing (transversal)

> Fecha o que resta da Fase 4 do [MOTOR_DE_TOKENS.md](../strategy/MOTOR_DE_TOKENS.md) sem
> depender do Asaas (Fase 3 adiada por falta de credencial sandbox em staging) e adianta a
> Fase 5 (painel de COGS). Decisão do CEO: tudo amadurece em staging, sem release pra main.

## Problema

O saldo de tokens existe no banco desde a Fase 1/2, mas ninguém enxerga: o cliente não
sabe quanto sobrou nem quem consumiu o quê na empresa, ninguém é avisado antes de zerar,
e o CEO não tem visão cross-tenant de custo real (COGS) vs receita pra calibrar preço.

## Objetivo

Empresa vê saldo e extrato de consumo em Configurações; gestores recebem alerta antes do
saldo zerar; ultra-admin vê uso, custo e margem estimada por empresa e por agente.

**Fora de escopo:** compra de pacote via Asaas (Fase 3, aguardando credencial sandbox);
qualquer promoção pra produção; exposição de custo (R$) ao cliente final — só tokens.

## Requisitos

1. Painel "Uso" das Configurações (`UsoPanel.tsx`) ganha um medidor de tokens (plano +
   comprado, mesmo padrão visual do `Medidor` de projetos/usuários) lendo `ai_token_saldo`.
2. A mesma tela lista um extrato recente de consumo (últimos 50 eventos): data, quem usou,
   qual agente, quantos tokens. **Nunca mostra custo em R$** ao cliente (só ultra-admin vê
   COGS) — evita expor margem.
3. `gerar_notificacoes_ambient()` ganha um bloco novo: quando `saldo_plano + saldo_comprado`
   de uma empresa cai abaixo de 10% da cota do ciclo, notifica a gestão (owner/admin),
   categoria `financeiro`, severidade `high`, sem link de navegação específico (aponta pras
   Configurações). Mesma regra de dedupe do resto do sistema (`notificar()`: não duplica
   enquanto a notificação anterior não for lida).
4. Ultra-admin ganha aba "Tokens": tabela por empresa (plano, tokens usados no mês, COGS,
   receita estimada = preço do plano, margem) e tabela por agente (tokens, COGS, cross-tenant).
   Usa `DataTable` (padrão da casa), não `<table>` cru — mesmo as outras abas do ultra-admin
   sendo legadas nesse ponto, a aba nova segue o padrão atual.
5. `ai_token_ledger` e `ai_token_saldo` ganham bypass de RLS pra `is_ultra_admin()`, mesmo
   padrão já usado em `profiles`/`admin_audit_logs`/`empresas`. As 3 views de breakdown
   (`v_uso_tokens_por_*`, `security_invoker=true`) herdam o bypass automaticamente.
6. Nova view `v_extrato_tokens`: ledger + nome do usuário (join `profiles`), pra alimentar
   o extrato do cliente e a leitura detalhada do ultra-admin com uma fonte só.

Não-funcionais:

- **Segurança:** custo (`custo_estimado`) nunca trafega pro client de empresa comum — a
  query do extrato do cliente seleciona só as colunas permitidas (tokens, agente, usuário,
  data), nunca `custo_estimado`. RLS é a rede de segurança, mas a seleção de colunas no
  front é a primeira barreira.
- **Multi-tenant:** toda leitura de empresa comum continua restrita a `get_user_empresa_id()`;
  só `is_ultra_admin()` atravessa.

## Critérios de aceite

- [ ] Dado um usuário comum abre Configurações > Uso, então vê os dois baldes de tokens
      (plano/comprado) e uma lista de eventos recentes só da própria empresa.
- [ ] Dado esse usuário inspeciona a resposta de rede do extrato, então não existe
      `custo_estimado` no payload.
- [ ] Dado uma empresa com saldo total abaixo de 10% da cota, quando o cron roda, então a
      gestão recebe notificação categoria financeiro; rodar de novo sem ler não duplica.
- [ ] Dado um `ultra_admin` acessa a aba Tokens, então vê linhas de TODAS as empresas
      (não só a própria), com COGS e margem estimada.
- [ ] Dado um usuário comum (não ultra_admin) tenta ler `v_uso_tokens_por_empresa` de outra
      empresa via query direta, então RLS devolve zero linhas.
- [ ] pgTAP cobre: bypass de `is_ultra_admin()` no ledger e no saldo; isolamento pra não-admin;
      notificação de saldo baixo gerada e idempotente.

## Dados e contratos

- Migration: policies `ledger_select`/`saldo_select` com `OR public.is_ultra_admin()`;
  bloco novo em `gerar_notificacoes_ambient()`; view `v_extrato_tokens`.
- Front: `useUsoEmpresa` estende com `tokensPlano`/`tokensComprado`; novo hook de extrato
  (`useExtratoTokens`) selecionando só colunas permitidas; aba nova em `ultra-admin/index.tsx`
  com dois `DataTable` lendo as views existentes + `v_extrato_tokens`.

## Plano de implementação

1. Migration: RLS bypass, bloco de notificação, view de extrato; pgTAP.
2. `UsoPanel.tsx`: medidor de tokens + tabela de extrato (DataTable, sem custo).
3. `ultra-admin/index.tsx`: aba "Tokens" com as duas tabelas (por empresa, por agente).
4. Verificação: pgTAP local, typecheck, vitest, deploy staging, teste manual (widget,
   notificação disparada manualmente via `SELECT gerar_notificacoes_ambient()`, aba admin).

## Decisões e riscos

- ADR 0035 continua a fonte de verdade; nada aqui cria tabela nova de billing.
- Risco: threshold de 10% pode ser ruído em empresa que mal usa IA (saldo baixo em
  valor absoluto irrelevante); aceito por ora, ajustar com dado real da Fase 0 se virar ruído.
- Receita "estimada" no painel admin é o preço de tabela do plano, não o valor realmente
  cobrado (Asaas pode ter desconto/atraso) — rotulado como estimativa, não fato de caixa.
