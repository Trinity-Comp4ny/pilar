# SPEC: Motor de tokens — alerta de anomalia de gasto diário (ultra-admin)

**Data:** 2026-09-01
**Status:** Aprovada
**Autor:** Matheus (CEO) + Claude
**Módulo:** ia / billing (transversal)

> Complementa a [SPEC 076](076-motor-de-tokens-extrato-alerta-painel-admin.md): aquela cobre
> saldo baixo (aviso pro cliente); esta cobre gasto anômalo num único dia (aviso pro operador
> da plataforma). Achado numa auditoria de segurança do motor de tokens (01/09): o rate limit
> de 30 chamadas/min por empresa segura rajada, mas não sinaliza volume sustentado alto ao
> longo do dia — hoje só existe o corte quando o saldo zera (`gate_tokens`, spec 075).

## Problema

Uma empresa gastando muito mais tokens que o normal num dia (conta comprometida, loop de
agente, uso legítimo mas fora do padrão) só aparece pro CEO quando o saldo já zerou. Não há
sinal antecipado no painel ultra-admin.

## Objetivo

Painel ultra-admin > Tokens > "Por empresa" ganha uma coluna "Hoje" que destaca, com badge de
aviso, quando o consumo do dia corrente de uma empresa passa muito acima da média recente dela
mesma. Puramente informativo: não bloqueia nada, não notifica o cliente.

**Fora de escopo:** notificação proativa (e-mail/central de notificações) pro ultra-admin;
qualquer ação automática (throttle, bloqueio) além do que `gate_tokens` já faz.

## Requisitos

1. Nova view `v_uso_tokens_anomalia_diaria`: por empresa, tokens consumidos hoje
   (`source='usage'`), média diária dos últimos dias anteriores (janela de 7 dias corridos) e
   uma flag `anomalia` booleana.
2. Critério de anomalia: pelo menos 3 dos 7 dias anteriores tiveram uso (evita ruído em
   empresa nova/pouco ativa, onde qualquer uso pareceria "infinitas vezes a média") **e**
   consumo de hoje maior que `GREATEST(média_anterior × 10, 20000)` — o piso absoluto evita
   marcar saltos triviais (ex.: 100 → 1200 tokens) como anomalia.
3. `TokensPanel.tsx` (ultra-admin): coluna "Hoje" na tabela "Por empresa" mostra o total do
   dia; quando `anomalia = true`, usa `<Badge variant="warning">` com ícone de alerta e
   `title` com o número da média pra contexto ao passar o mouse.
4. View herda RLS do `ai_token_ledger` (`security_invoker = true`, mesmo padrão das outras 3
   views de breakdown) — sem policy nova, bypass de `is_ultra_admin()` já existe desde a
   spec 076.

Não-funcionais:

- **Nenhum custo (`custo_estimado`) na view** — só contagem de tokens, mesmo cuidado de
  não vazar COGS além do necessário (aqui nem se aplica ao cliente, é só ultra-admin, mas
  mantém o hábito).

## Critérios de aceite

- [ ] Empresa com 3+ dias de uso na última semana e gasto de hoje > 10x a média (e acima do
      piso de 20000 tokens) aparece com `anomalia = true` na view.
- [ ] Empresa nova/pouco ativa (menos de 3 dias de histórico) nunca marca anomalia, mesmo com
      salto grande no valor absoluto.
- [ ] Empresa com gasto de hoje dentro da faixa normal (≤10x a média) não marca anomalia.
- [ ] Ultra-admin vê a coluna "Hoje" com badge de aviso nas linhas anômalas; nenhuma mudança
      de comportamento pra usuário comum (view não é consumida fora do ultra-admin).

## Dados e contratos

- Migration: view `v_uso_tokens_anomalia_diaria` (`security_invoker=true`), `REVOKE ALL ...
  FROM anon`. Sem tabela nova, sem RPC nova.
- Front: `TokensPanel.tsx` busca a view junto das demais (`Promise.all`), junta por
  `empresa_id` no mesmo mapeamento que já existe pra plano/receita.

## Plano de implementação

1. Migration com a view; pgTAP cobrindo os 3 cenários dos critérios de aceite.
2. `TokensPanel.tsx`: query + coluna nova.
3. Verificação: pgTAP local, typecheck, deploy staging, olhar a aba Tokens com dado real.

## Decisões e riscos

- Threshold (10x + piso 20000) é chute inicial, mesmo espírito do "ajustar com dado real" já
  registrado na spec 076 pro alerta de saldo baixo. Não é ciência, é primeiro corte.
- Puramente visual por enquanto — se virar ruído ou passar despercebido, avaliar notificação
  ativa pro ultra-admin depois (fora de escopo aqui, spec própria se justificar).
