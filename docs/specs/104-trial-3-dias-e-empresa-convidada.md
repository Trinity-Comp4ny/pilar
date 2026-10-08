# SPEC 104: Trial de 3 dias, pagar depois do teste e empresa convidada

**Data:** 2026-10-08
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** cobrança | ultra-admin | onboarding

## Problema

O primeiro cadastro orgânico em produção (23/09, empresa "Autonomo") passou 15 dias em trial
sem ninguém saber, e o trial venceu em 07/10 sem expirar: o cron de expiração roda todo dia em
produção mas pula o disparo em silêncio porque os secrets do Vault (`app_supabase_url`,
`app_cron_secret`) nunca foram criados lá. Os mesmos secrets faltando calam o e-mail de
notificação, o guardião de margem e a retenção pós-trial. Além disso:

- 14 dias de teste é tempo demais para quem testa e some no mesmo dia (o caso real usou 5
  minutos, no celular, e não voltou).
- Quem deixa o trial vencer não consegue pagar: "Ativar plano" só funciona durante o trial
  (gap registrado na SPEC 098 Fase 3).
- "Empresa convidada" (parceira que não paga) existe só de forma implícita (assinatura ativa
  sem Asaas, ou nenhuma assinatura). A própria empresa vê "Sem assinatura ativa, ver planos" ou
  um preço de plano que ela não paga. O ultra-admin não consegue tornar convidada uma empresa
  que entrou pelo self-serve, nem cancelar o convite de quem não tem linha de assinatura.
- Ninguém é avisado quando alguém se cadastra (requisito 9 da SPEC 098, nunca implementado).

## Objetivo

Trial de 3 dias que expira de verdade, conversão em pagante a qualquer momento (no teste ou
depois dele) e empresa convidada como estado explícito, visível e reversível pelo ultra-admin.

**Fora de escopo:** tela para editar a duração do trial (fica em `platform_settings.trial_dias`,
editável por SQL); ativação comercial do Asaas de produção (conta, CNPJ, NFS-e: decisão de
negócio, ver `docs/operations/AUDITORIA_ATIVACAO_ASAAS_2026-09-01.md`); empresa `canceled`
voltando a assinar.

## Requisitos

1. Cadastro self-serve novo nasce com `trial_ends_at = now() + platform_settings.trial_dias`
   (padrão 3). Trials já em andamento mantêm a data que têm.
2. O cron de expiração roda de hora em hora, então o trial vence com no máximo 1h de atraso.
3. Avisos por e-mail: D-1 (falta menos de 1 dia) sempre; D-7 só quando o prazo é longo o
   bastante (conversão de convidada). O aviso D-3 sai: num trial de 3 dias ele dispararia no
   dia do cadastro. Cada janela cobre exatamente 1 dia (`N-1 < restante <= N`).
4. Ao expirar sem cartão, os admins da empresa recebem um e-mail "seu teste acabou" com link
   para assinar.
5. Admin de empresa com trial vencido (somente leitura) consegue assinar: informa o cartão, a
   primeira cobrança é feita na hora e, aprovada, a assinatura vira `active` e o modo leitura
   sai (`leitura_desde = null`). Recusada, nada muda e o erro diz o que fazer.
6. Empresa convidada = assinatura `active` sem `asaas_subscription_id`, ou sem assinatura.
   A empresa vê o selo "Empresa convidada" em Configurações > Pagamento, sem preço, sem
   "próxima cobrança" e sem "cancelar assinatura".
7. Ultra-admin vê o selo de cobrança (Convidada, Em teste, Pagante, Vencida) na lista e no
   detalhe da empresa.
8. Ultra-admin marca como convidada qualquer empresa que não paga (em teste ou vencida):
   assinatura vira `active`, prazo e avisos zerados, modo leitura sai. Empresa pagante é
   recusada (cancelar a assinatura Asaas antes).
9. Ultra-admin cancela o convite: a empresa entra num prazo para assinar (padrão 7 dias,
   editável) com o mesmo banner, avisos e expiração do trial. Funciona também para convidada
   sem linha de assinatura (cria a linha no plano de entrada).
10. Todo cadastro self-serve novo notifica os ultra-admins no sino (categoria `sistema`,
    severidade `high`).
11. O e-mail imediato de notificação ignora notificação com mais de 48h: religar o cron em
    produção não pode despejar semanas de alerta antigo na caixa de ninguém.

Não-funcionais:

- **Segurança:** marcar/cancelar convite só pela edge `ultra-admin-empresas` (exige
  `ultra_admin`, confirmação digitando o nome, `admin_audit_logs`). Assinar após o trial só
  admin da própria empresa (mesma checagem e rate limit anti-carding do "Ativar plano").
- **Idempotência:** a cobrança imediata usa a mesma rotina da conversão do cron; uma segunda
  chamada com a assinatura já `active` é recusada.

## Critérios de aceite

- [ ] Dado cadastro self-serve novo, então `trial_ends_at` fica entre `now()+3d` e `now()+3d+1min`.
- [ ] Dado `platform_settings.trial_dias = 5`, então o próximo cadastro ganha 5 dias.
- [ ] Dado cadastro self-serve novo, então cada ultra-admin recebe 1 notificação `novo_cadastro`.
- [ ] Dado trial que vence em 20h, quando o cron roda, então sai 1 aviso D-1 e nenhum D-3/D-7.
- [ ] Dado trial de 3 dias recém-criado, quando o cron roda, então nenhum aviso sai.
- [ ] Dado trial vencido sem cartão, quando o cron roda, então status `expired`, `leitura_desde`
      preenchido e e-mail "seu teste acabou" enviado.
- [ ] Dado empresa `expired` em leitura, quando o admin assina com cartão aprovado, então status
      `active`, `asaas_subscription_id` preenchido e `leitura_desde = null`.
- [ ] Dado empresa sem assinatura (convidada legada), então Pagamento mostra "Empresa convidada"
      e não mostra "Ver planos".
- [ ] Dado empresa em teste, quando o ultra-admin marca como convidada, então status `active`,
      `trial_ends_at = null` e o selo vira "Convidada".
- [ ] Dado empresa convidada sem linha de assinatura, quando o ultra-admin cancela o convite com
      7 dias, então a linha é criada `trialing` com `trial_ends_at = now()+7d`.
- [ ] Dado empresa pagante, quando o ultra-admin tenta marcar como convidada, então 409.
- [ ] Dado notificação high de 3 dias atrás nunca enviada, então `notificacoes_pendentes_email('imediato')` não a retorna.

## Dados e contratos

- `platform_settings.trial_dias integer NOT NULL DEFAULT 3 CHECK (trial_dias BETWEEN 1 AND 90)`.
- `handle_new_user()`: lê `trial_dias`; chama `notificar_ultra_admins(..., 'novo_cadastro', ...)`
  dentro de um bloco que nunca derruba o cadastro.
- `notificacoes_pendentes_email('imediato')`: janela `5 min <= idade <= 48 h`.
- `cron.job 'trial-expiry-daily'`: schedule `0 * * * *` (nome mantido: é o slug do monitor do Sentry).
- Edge `ultra-admin-empresas`:
  - GET lista: cada empresa ganha `cobranca: { status, convidada, is_paying }`.
  - GET detalhe: `cobranca.convidada`.
  - PUT `marcar_convidada: { confirm_name }`.
  - PUT `converter_pagante` (UI: "Cancelar convite"): cria a assinatura se faltar.
- Edge `ativar-plano`: aceita `status = 'expired'` (e `trialing` já vencido): cobra na hora via
  `_shared/converter-assinatura.ts` (mesma rotina do cron) e responde `{ cobrado_agora: true }`.
- Front: `useMySubscription` passa a ler `asaas_subscription_id`; helper `ehConvidada()` em
  `src/lib/cobranca.ts`.

## Decisões e riscos

- Convidada continua computada, sem coluna nova (mesma decisão da SPEC 078): o par
  `status`/`asaas_subscription_id` já é a verdade, e uma flag à parte poderia divergir dele.
- Produção depende de duas ações fora do código: criar os secrets do Vault + `CRON_SECRET` nas
  edge functions, e configurar `ASAAS_PLATFORM_API_KEY`/`ASAAS_PLATFORM_ENV=producao`. Sem o
  segundo, o trial expira mas ninguém consegue pagar (o erro aparece no "Ativar plano").
- Arrependimento de 7 dias (SPEC 098) continua valendo para a cobrança imediata.
