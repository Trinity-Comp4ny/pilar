-- pgTAP: projetos.exemplo legível por authenticated (20261226000000).
-- A coluna nasceu depois do GRANT por coluna da SPEC 073 e ficou de fora: o checklist de
-- primeiros passos (SPEC 149) filtra `exemplo = false` e voltava 403 para todo usuário.
-- As colunas de dinheiro continuam fora do alcance da tabela base.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(3);

SELECT ok(has_column_privilege('authenticated', 'public.projetos', 'exemplo', 'SELECT'),
  'authenticated lê projetos.exemplo (checklist de primeiros passos)');
SELECT ok(NOT has_column_privilege('authenticated', 'public.projetos', 'valor_contrato', 'SELECT'),
  'valor_contrato segue fora da tabela base (só via projetos_safe)');
SELECT ok(NOT has_column_privilege('authenticated', 'public.projetos', 'custo_indireto_pct', 'SELECT'),
  'custo_indireto_pct segue fora da tabela base (só via projetos_safe)');

SELECT * FROM finish();
ROLLBACK;
