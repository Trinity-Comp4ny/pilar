-- SPEC 171 / ADR 0066: set_modulos_ocultos e a coluna modulos_ocultos.
-- Rodar com `supabase test db`. Segue o padrão dos demais arquivos em supabase/tests.
BEGIN;
SELECT plan(5);

SELECT has_column('public', 'profiles', 'modulos_ocultos', 'profiles tem modulos_ocultos');
SELECT has_column('public', 'empresas', 'modulos_ocultos', 'empresas tem modulos_ocultos');

SELECT has_function('public', 'set_modulos_ocultos', ARRAY['text', 'uuid', 'text[]'], 'RPC existe');
SELECT function_privs_are('public', 'set_modulos_ocultos', ARRAY['text', 'uuid', 'text[]'], 'anon', ARRAY[]::text[], 'anon não executa');
SELECT function_privs_are('public', 'set_modulos_ocultos', ARRAY['text', 'uuid', 'text[]'], 'authenticated', ARRAY['EXECUTE'], 'authenticated executa');

SELECT * FROM finish();
ROLLBACK;
