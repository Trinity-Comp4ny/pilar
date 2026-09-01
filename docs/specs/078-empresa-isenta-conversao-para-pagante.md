# SPEC: Empresa isenta → conversão para pagante (grace period)

**Data:** 2026-09-01
**Status:** Aprovada
**Autor:** Matheus (CEO) + Claude
**Módulo:** ultra-admin / billing

> Decorre da auditoria de ativação do Asaas
> ([docs/operations/AUDITORIA_ATIVACAO_ASAAS_2026-09-01.md](../operations/AUDITORIA_ATIVACAO_ASAAS_2026-09-01.md)):
> o CEO quer convidar empresas parceiras isentas e, mais tarde, convertê-las
> em pagantes sem cortar o acesso na hora.

## Problema

Toda empresa criada pelo ultra-admin hoje já nasce "isenta" de fato
(`pilar_subscriptions.status = 'active'`, sem `asaas_customer_id`/
`asaas_subscription_id`), mas isso é implícito — indistinguível de um
pagante de verdade nos dados e na tela. Não existe caminho pra, mais tarde,
pedir que essa empresa comece a pagar.

## Objetivo

Ultra-admin enxerga se uma empresa é isenta ou pagante, e tem um botão pra
iniciar a conversão: a empresa continua com acesso normal por N dias
(prazo escolhido na hora, padrão 14) com um aviso claro, e perde acesso ao
fim do prazo se não completar a assinatura — sem nenhuma automação nova.

**Fora de escopo:** o pagamento em si (depende do Asaas de plataforma estar
ligado, ver auditoria); estender/editar um prazo de conversão já em
andamento; a cobrança automática do cliente do cliente (Asaas por-empresa,
adiada por decisão do CEO em 01/09).

## Decisão de arquitetura (o porquê de não criar tabela/coluna nova)

"Empresa isenta em conversão, com prazo de graça, acesso mantido até vencer,
aviso em 7/3/1 dias, corta se não pagar" é **exatamente** a máquina de estados
que o trial de self-serve (`status='trialing'` + `trial_ends_at`) já
implementa, testada em produção desde a spec de self-serve signup: mesmo
`trial-expiry-cron` (avisos + expiração), mesmo `TrialBanner.tsx` (banner de
contagem regressiva + modal de bloqueio), mesmo gate em `PrivateRoute.tsx`.
**Decisão: reusar o mecanismo de trial integralmente, em vez de criar
`billing_mode`/`conversion_deadline`/cron novo.** "Isento" e "pagante" viram
leitura computada (`status='active' AND asaas_subscription_id IS NULL` =
isento; `asaas_subscription_id IS NOT NULL` = pagante), sem coluna nova.

## Requisitos

1. Tela de detalhe da empresa (ultra-admin) mostra o estado de cobrança:
   Isenta / Em conversão (expira em Xd) / Pagante / Vencido — computado, sem
   coluna nova.
2. Botão "Converter para pagante" aparece só quando a empresa está isenta
   (`status='active'`, sem `asaas_subscription_id`). Abre diálogo com: prazo
   em dias (padrão 14) e confirmação digitando o nome da empresa (mesmo
   padrão de suspender/arquivar, porque a ação pode cortar acesso de um
   parceiro real).
3. Confirmar seta `pilar_subscriptions.status = 'trialing'`,
   `trial_ends_at = now() + N dias`, zera os 3 `trial_warning_*_sent_at`
   (defensivo: garante que os avisos disparem do zero pra esse prazo, mesmo
   que a empresa já tenha passado por um trial no passado).
4. `trial-expiry-cron`, `TrialBanner`, `PrivateRoute` não mudam — a empresa
   convertida entra no mesmo fluxo de qualquer trial: aviso 7/3/1 dias,
   bloqueio total se `trial_ends_at` passar sem pagamento.
5. Painel de COGS/margem do ultra-admin (`TokensPanel.tsx`, spec 076) para
   de contar receita de empresa isenta: hoje conta `preco_mensal` de
   qualquer empresa com plano ativo, incluindo isentas — corrigir pra só
   contar receita de empresa com `asaas_subscription_id` preenchido.
6. Ação registrada em `admin_audit_logs` (mesmo padrão de suspender/arquivar).

Não-funcionais: guard de confirmação (nome exato) contra clique acidental;
só ultra_admin executa (já é o gate da function); RLS não muda (mesma tabela,
mesmas policies).

## Critérios de aceite

- [ ] Dado empresa isenta, quando o ultra-admin abre o detalhe, então vê o
      badge "Isenta" e o botão "Converter para pagante".
- [ ] Dado o diálogo aberto, quando confirma com o nome errado, então o botão
      de confirmar fica desabilitado (mesmo padrão de arquivar).
- [ ] Dado confirmação certa com prazo 14, quando salva, então
      `pilar_subscriptions.status='trialing'` e `trial_ends_at` ~14 dias no
      futuro, e os 3 `trial_warning_*_sent_at` ficam NULL.
- [ ] Dado uma empresa já pagante (`asaas_subscription_id` preenchido),
      então o botão "Converter para pagante" não aparece.
- [ ] Dado uma empresa em conversão (`status='trialing'`, veio desse fluxo),
      quando o usuário dela loga, então vê o `TrialBanner` normal (nenhuma
      mudança de código ali, é reuso puro).
- [ ] Dado o painel de Tokens do ultra-admin, quando uma empresa é isenta,
      então a receita estimada dela aparece como "—", não o preço de tabela.

## Dados e contratos

- `ultra-admin-empresas` GET detalhe: retorna também `status`,
  `trial_ends_at`, `asaas_subscription_id` da assinatura (sem migration).
- `ultra-admin-empresas` PUT: novo campo opcional
  `converter_pagante: { dias_prazo: number, confirm_name: string }`.
- Sem migration, sem `gen:types` (nenhuma tabela/coluna nova).

## Plano de implementação

1. Backend: estender GET (campos extra no select) e PUT (novo bloco
   `converter_pagante`) de `ultra-admin-empresas`.
2. Front: card "Cobrança" no detalhe + `ConverterParaPaganteDialog` (prazo +
   confirmação) + handler dedicado.
3. Fix: `TokensPanel.tsx` para de contar receita de empresa sem
   `asaas_subscription_id`.
4. Verificação: typecheck, lint, teste manual em staging (converter uma
   empresa de teste, conferir trial_ends_at e o banner).

## Decisões e riscos

- Risco aceito: converter uma empresa que já está em trial genuíno (recém
  criada via self-serve, ainda decidindo) reseta o prazo dela — não é o caso
  de uso (o botão só aparece pra empresa `status='active'` sem Asaas), mas
  vale revisitar se um dia o ultra-admin também converter empresas via essa
  mesma tela independente do status atual.
- Fora de escopo, registrado: estender um prazo de conversão já em curso
  precisa de ação nova (não é objetivo desta spec).
