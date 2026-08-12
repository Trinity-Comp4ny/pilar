# ADR 0015 — Notificações por destinatário (uma linha por usuário)

**Data:** 2026-08-12
**Status:** Proposed
**Relacionado:** [ADR 0001 — multi-tenant por `empresa_id`](0001-arquitetura-multi-tenant.md), [ADR 0005 — permissões role + features](0005-permissoes-feature-flags.md), [spec 029 — Central de notificações](../../specs/029-central-de-notificacoes.md)

## Contexto

O sistema já tem meia central de notificações em produção: tabela `alertas`, o
sino `AlertsBell` no header, o hook `useAlertas` (polling de 5min) e o gerador
`gerar_alertas_ambient()` (SQL, sem LLM) rodando em pg_cron às 06:00 UTC.

O modelo atual de `alertas` é **por empresa**: as colunas de leitura
(`lido`/`lido_por`/`lido_em`) são únicas por linha, então quando um usuário marca
como lido, o alerta some para a empresa inteira. Não há coluna de destinatário.

Isso quebra o que o produto precisa agora:

- **"Tarefa atribuída a você"** e **"a disciplina que você é responsável está
  estourando o prazo"** exigem um destinatário-pessoa e estado de leitura por
  usuário. Hoje é impossível expressar isso.
- Roteamento por papel: um `colaborador` não deve receber alerta financeiro
  (margem baixa, recebimento), mas hoje todo mundo vê tudo.

Opções consideradas para o estado de leitura por usuário:

- **A — Estender `alertas` com `destinatario_id`**: reusa a tabela, mas mistura
  dois conceitos (o evento e a entrega ao destinatário) e obriga a reescrever o
  read-state global que outras telas (dashboard) já consomem. Migração arriscada
  numa tabela viva.
- **B — Evento em `alertas` + junção `alerta_destinatario(alerta_id, user_id,
lido_em)`**: normalizado, uma linha de evento e N de entrega. Consultar "minhas
  não lidas" vira sempre um join; RLS em duas tabelas; mais peças para pouco ganho
  no volume esperado (escritórios pequenos, dezenas de eventos/dia).
- **C — Nova tabela `notificacoes`, uma linha por (evento, destinatário)**:
  desnormaliza o texto do evento em cada linha, mas cada linha já é a entrega a um
  usuário, com `lido_em` próprio. Consulta e RLS triviais (`destinatario_id =
auth.uid()`). É o padrão de "notifications table" da indústria.

## Decisão

**Criar `public.notificacoes`, uma linha por (evento, destinatário), com estado
de leitura por linha.** O destinatário é sempre um usuário logável
(`profiles.id`, que é `auth.uid()`), nunca uma `pessoa` sem conta. `alertas` fica
dormente (dados históricos preservados; não deletar), e o sino/hook passam a ler
`notificacoes`.

```sql
create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  destinatario_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null,          -- tarefa_atribuida, projeto_atrasado, parcela_vence, ...
  categoria text not null,     -- tarefa | projeto | disciplina | financeiro | obra | sistema
  severidade text not null default 'medium'
    check (severidade in ('low','medium','high','critical')),
  titulo text not null,
  mensagem text,
  referencia_tipo text,        -- tarefa | projeto | disciplina | despesa | receita | marco | obra_frente
  referencia_id uuid,
  link text,                   -- rota interna para abrir o item (ex.: /projetos/:id)
  lido_em timestamptz,         -- null = não lida; POR LINHA, logo por usuário
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- RLS: só vejo e mexo nas minhas
alter table public.notificacoes enable row level security;
create policy notificacoes_select on public.notificacoes for select
  using (destinatario_id = auth.uid() and empresa_id = public.get_user_empresa_id());
create policy notificacoes_update on public.notificacoes for update
  using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid());
-- INSERT/DELETE: não expostos ao authenticated comum.
-- Inserção só via funções SECURITY DEFINER (trigger de evento + gerador ambient);
-- admin pode inserir aviso manual do tipo 'sistema'.
create policy notificacoes_insert_admin on public.notificacoes for insert
  with check (public.has_role('admin') and empresa_id = public.get_user_empresa_id());
```

Duas peças de apoio:

- **Roteamento** numa função `SECURITY DEFINER` `public.notificar(...)` que recebe
  um evento e resolve os destinatários por responsabilidade + papel (ADR 0005),
  respeitando as preferências do usuário antes de inserir. Dedup por
  `(destinatario_id, tipo, referencia_id)` enquanto `lido_em is null` — rodar o
  gerador várias vezes não empilha, mesmo padrão de `gerar_alertas_ambient()`.
- **Preferências** em `public.notificacao_preferencias (user_id, empresa_id,
categoria, in_app bool default true, email bool default false)`, `unique(user_id,
categoria)`. Ausência de linha = tudo ligado in-app. A coluna `email` já nasce
  aqui, embora e-mail seja fase posterior, para não migrar de novo.

## Consequências

**Positivas:**

- Estado de leitura por usuário sai de graça (`lido_em` por linha).
- RLS trivial e segura: `destinatario_id = auth.uid()` — ninguém lê nem forja a
  notificação de outro; inserção só por função com dono definido.
- Roteamento por papel/responsabilidade fica num único ponto (`notificar`), reusado
  pelo trigger de evento e pelo gerador ambient.
- O sino vira genuinamente pessoal e destrava os avisos "a você".

**Negativas:**

- Desnormalização: o texto do evento é copiado em N linhas (uma por destinatário).
  Aceitável no volume do ICP; um evento para toda a empresa gera poucas linhas.
- Convivência temporária com `alertas` (dormente) até a fase que porta o gerador.
  Custo: dois modelos no repositório por algumas fases; mitigado deixando `alertas`
  claramente marcada como legado e o cron apontando só para o novo gerador.
- Notificação só alcança quem tem conta (`pessoas.profile_id not null`). Pessoa
  cadastrada sem login não recebe — correto para uma central in-app, mas é um limite
  a documentar.

## Decisões relacionadas

- ADR 0005: o roteamento por papel usa `has_role()` e `can_view_financeiro()`.
- ADR 0001: `notificacoes` segue o padrão multi-tenant (`empresa_id` + RLS).
- spec 028: a feature que consome este modelo.
