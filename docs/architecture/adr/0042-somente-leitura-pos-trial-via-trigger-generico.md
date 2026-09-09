# ADR 0042: Somente leitura pós-trial via trigger genérico sobre `information_schema`

**Data:** 2026-09-09  
**Status:** Proposed

## Contexto

SPEC 098 (requisito 22): quando o trial vence sem forma de pagamento tokenizada, a empresa
entra em 90 dias de somente leitura — abre, navega, exporta, mas não cria nem edita nada —
em vez de perder o acesso por completo. Hoje `PrivateRoute.tsx` só conhece dois estados:
assinatura OK (`Layout` inteiro liberado) ou suspensa (`SubscriptionSuspendedScreen`,
`canceled`/`expired`, zero acesso a qualquer rota). Não existe hoje nenhum terceiro estado, e
o enforcement de "não pode escrever" não pode viver só no client: overlay client-side nunca é
a única barreira (mesmo princípio já adotado no ADR 0041 para capacidade).

O problema de escala: `SELECT count(*) FROM information_schema.columns WHERE
column_name='empresa_id'` no banco atual devolve **81 tabelas base** (financeiro, projetos,
obras, RDO, propostas, leads, pessoas, tarefas, etc.). Os únicos precedentes de bloqueio
condicional no banco são os triggers `BEFORE INSERT` de `enforce_capacidade_projetos`/
`enforce_capacidade_obras`/`enforce_email_confirmado` (SPEC 098 Fase 0/1) — cobrem 2 tabelas
cada. O soft delete (SPEC 060, `supabase/migrations/20260859000000_soft_delete_via_rpc.sql`)
já resolveu um problema parecido de escala: uma RPC genérica (`rpc_soft_delete(p_tabela,
p_id)`) com allowlist fechada num `CASE p_tabela WHEN 'clientes' THEN ... END`, hoje com ~20
entradas, mantida à mão a cada tabela nova.

- **Opção A, replicar o padrão de trigger por tabela** (como capacidade). Prós: mesmo
  padrão já revisado e testado. Contras: 81 `CREATE TRIGGER` + 81 chamadas de uma função
  igual, e cada tabela nova no produto (o que acontece com frequência — o schema já tem
  ~180 migrations) exige lembrar de adicionar o trigger. Esquecer um = furo silencioso.
- **Opção B, allowlist manual como o soft delete** (`CASE p_tabela WHEN ...`). Prós:
  padrão já existente, explícito, fácil de auditar uma tabela por vez. Contras: mesmo
  risco de esquecimento que a Opção A, e essa lista cresceria pra 81 entradas — a
  motivação do soft delete era restringir a um subconjunto pequeno e deliberado
  (~20 tabelas "excluíveis pelo usuário"), não bloquear tudo.
- **Opção C, trigger único aplicado dinamicamente via `DO $$ ... $$` sobre
  `information_schema.columns`**, com **allowlist de exceção** (pequena, ao contrário das
  opções A/B) para tabelas que devem continuar graváveis mesmo em leitura. Nasce seguro por
  padrão: tabela nova com `empresa_id` já cai sob o bloqueio sem precisar lembrar de nada;
  só sai do escopo quem for explicitamente adicionado à exceção.

## Decisão

Adotar a Opção C.

```sql
-- Função única, reaplicada a cada tabela via CREATE TRIGGER dinâmico.
CREATE OR REPLACE FUNCTION public.enforce_empresa_nao_leitura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := COALESCE(NEW.empresa_id, OLD.empresa_id);
  v_leitura    boolean;
BEGIN
  -- service_role/postgres passam direto (cron, ultra-admin, migration,
  -- reativação) — mesmo padrão de enforce_capacidade_projetos.
  IF auth.role() <> 'authenticated' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT (leitura_desde IS NOT NULL) INTO v_leitura
  FROM public.empresas WHERE id = v_empresa_id;

  IF v_leitura THEN
    RAISE EXCEPTION 'empresa_em_leitura' USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Allowlist de EXCEÇÃO (não entram no bloqueio): tabelas de sistema/auditoria
-- que precisam continuar gravando mesmo com a empresa em leitura, ou que já
-- têm proteção própria mais específica.
-- notificacoes, notificacao_preferencias, admin_audit_logs, audit_logs,
-- audit_logs_archive, data_deletion_requests, data_export_requests,
-- consentimentos_cobranca (append-only, já bloqueado por RLS),
-- terms_acceptances, convites, email_envios, ai_token_ledger/ai_usage_logs
-- (billing de uso, precisa fechar o período mesmo em leitura),
-- pilar_subscriptions (senão a própria reativação trava).
DO $$
DECLARE
  v_tabela text;
BEGIN
  FOR v_tabela IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.column_name = 'empresa_id'
      AND c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN (
        'notificacoes', 'notificacao_preferencias', 'admin_audit_logs',
        'audit_logs', 'audit_logs_archive', 'data_deletion_requests',
        'data_export_requests', 'consentimentos_cobranca', 'terms_acceptances',
        'convites', 'email_envios', 'ai_token_ledger', 'ai_usage_logs',
        'ai_usage', 'pilar_subscriptions', 'empresas'
      )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_enforce_empresa_nao_leitura ON public.%I', v_tabela
    );
    EXECUTE format(
      'CREATE TRIGGER trg_enforce_empresa_nao_leitura
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.enforce_empresa_nao_leitura()',
      v_tabela
    );
  END LOOP;
END $$;
```

Regras adicionais:

- **`empresas.leitura_desde timestamptz`** (nova coluna) é a fonte de verdade — não-nula =
  em leitura. Setada pelo `trial-expiry-cron` quando expira sem cartão tokenizado; limpa ao
  reativar (pagar) ou quando `preservar_dados = true` suspende o relógio (já existe,
  Fase 2A).
- O trigger dispara **antes** de qualquer RLS (é `BEFORE`), então não herda a armadilha já
  documentada na SPEC 060 (`UPDATE` que muda a coluna da policy de `SELECT` é revalidado
  contra a linha nova) — aqui a rejeição acontece antes da linha existir/mudar.
- Tabela nova migrada depois desta: se tiver `empresa_id`, entra automaticamente no
  próximo `supabase db reset`/deploy que rodar este `DO $$` de novo (a migration é
  idempotente, `DROP TRIGGER IF EXISTS` + recria). Times futuros só precisam **lembrar de
  rodar de novo o bloco quando quiserem re-sincronizar**, não de escrever trigger por
  tabela — mas caso esqueçam, o pior caso é uma tabela nova SEM o trigger até o próximo
  re-sync, nunca uma tabela bloqueada por engano.
- `PrivateRoute.tsx`: novo terceiro estado, distinto de `suspended`
  (`canceled`/`expired` continuam tudo-ou-nada). Quando `subStatus === 'expired' &&
  leitura_desde !== null`, renderiza `<Layout />` normalmente (navega, exporta) com um
  banner fixo "Somente leitura — ative o plano para voltar a editar"; formulários e botões
  de criar/editar/excluir desabilitados na UI (redundante com o servidor, mas evita o
  usuário bater no erro genérico do banco toda hora).

## Consequências

**Positivas:**

- Cobre as 81 tabelas hoje e qualquer tabela nova amanhã sem exigir lembrete manual —
  fail-safe por padrão, ao contrário do soft delete (fail-open: tabela esquecida na
  allowlist simplesmente não pode ser soft-deletada, não é um furo de segurança).
- Um único ponto de manutenção (`enforce_empresa_nao_leitura`), testável com pgTAP contra
  uma amostra representativa (financeiro, projetos, obras) sem precisar testar as 81.
- `leitura_desde` é o mesmo padrão já usado por `nivel_override`/`preservar_dados`: coluna
  em `empresas`, nunca estado derivado escondido em outro lugar.

**Negativas:**

- Migration de ~81 `CREATE TRIGGER` é grande e roda em bloco `DO $$`, mais difícil de ler
  num diff de PR do que triggers individuais — mitigado documentando a allowlist de
  exceção por extenso, com o motivo de cada uma.
- Overhead de uma função extra rodando em todo `INSERT`/`UPDATE`/`DELETE` dessas 81
  tabelas, mesmo para empresas nunca em leitura (a maioria) — é um `SELECT` por chave
  primária em `empresas`, mesmo custo que os triggers de capacidade já pagam hoje.
- Allowlist de exceção pode ficar desatualizada se uma tabela de sistema nova precisar
  entrar nela — mesmo risco que qualquer allowlist, mitigado por só ter ~15 entradas
  (fácil de revisar) contra as 81 da abordagem oposta.
- Reaplicar o `DO $$` inteiro a cada migration nova que mexer na lista de exceção
  reconstrói todos os triggers (`DROP` + `CREATE`) mesmo para tabelas que não mudaram —
  aceitável, é uma operação local de DDL, não reprocessa dado.

## Decisões relacionadas

- [ADR 0041](./0041-acesso-no-trial-por-nivel-de-confianca-derivado-de-fatos.md): mesmo
  princípio de enforcement server-side, nunca só client-side.
- [SPEC 060](../../specs/060-soft-delete-por-rpc.md): padrão de allowlist explícita que a
  Opção C evita replicar em escala, mas de onde vem o precedente `p_tabela text` genérico.
- [SPEC 098](../../specs/098-trial-em-niveis-de-confianca.md), requisito 22 e Fase 3.
