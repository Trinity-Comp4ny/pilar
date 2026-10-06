-- pgTAP: notificação removida por baixo engajamento (migration 20260894000000)
--
-- Guarda de regressão: rpc_notificar_projeto_status continua removida (não volta por
-- acidente numa migration futura que redefina algo próximo).
--
-- disciplina_atribuida, removida na mesma migration, voltou de propósito na SPEC 102
-- (20261009000000): a leitura de 0% foi medida com o sino afogado em alerta financeiro
-- indevido (20261008000000). Coberta agora por notificacoes_de_pessoas.sql.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(1);

SELECT hasnt_function('public', 'rpc_notificar_projeto_status', ARRAY['uuid', 'text'],
  'rpc_notificar_projeto_status não existe mais');

SELECT * FROM finish();

ROLLBACK;
