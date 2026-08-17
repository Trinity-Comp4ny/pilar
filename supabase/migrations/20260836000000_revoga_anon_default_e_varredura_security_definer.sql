-- Fecha a causa raiz sistêmica que o estudo de arquitetura de 2026-08-17 apontou:
-- Postgres concede EXECUTE a PUBLIC em toda função nova por padrão, e o
-- 000_base_schema.sql AINDA reforça isso com um `ALTER DEFAULT PRIVILEGES ... GRANT
-- ALL ON FUNCTIONS TO anon` explícito. Resultado: toda RPC SECURITY DEFINER nasce
-- executável por anon a menos que alguém lembre de revogar — é assim que os 3 RPCs do
-- 20260835000000 (e a classe do 20260810120000, e a de 20260725000000) nasceram
-- vulneráveis, cada vez descoberta por incidente separado em vez de by design.
--
-- Esta migration faz DUAS coisas:
--
-- 1. VARREDURA RETROATIVA: audita toda função SECURITY DEFINER do schema public hoje
--    executável por anon (levantamento em 2026-08-17: ~110 funções, não só as 3 do
--    estudo) e revoga anon de TODAS, exceto uma allowlist explícita. A allowlist foi
--    construída por evidência, não suposição — grep em src/ e supabase/functions/ pra
--    achar quem de fato chama cada uma, e checagem do client (anon vs service_role) de
--    cada Edge Function candidata:
--
--    a) Helpers usados dentro de USING/WITH CHECK de RLS (confirmado via grep nas
--       migrations): PRECISAM continuar anon-executáveis, senão toda query de anon
--       contra uma tabela com RLS passa a dar "permission denied for function" em vez
--       de simplesmente devolver zero linhas.
--    b) Entrypoints pré-autenticação chamados de fato pelo client anônimo (portal,
--       campo, cliente) ANTES de existir sessão Supabase — confirmado com grep direto
--       nas páginas/hooks que fazem `supabase.rpc(...)`. Cada um valida seu próprio
--       token/rate-limit no corpo.
--
--    Tudo que NÃO está na allowlist e é hoje anon-executável cai numa destas
--    categorias, confirmadas nesta varredura (não suposição):
--      - Chamada só a partir de Edge Function usando SUPABASE_SERVICE_ROLE_KEY, nunca
--        do client anônimo (ex.: portal_get_projeto_full, _campo_create_account,
--        _portal_reset_password, check_rate_limit, check_convite_rate_limit) — anon
--        nunca foi necessário, service_role já tem grant próprio e não depende disso.
--      - Sem NENHUM caller no repo (ex.: create_portal_token, rate_limit_cleanup,
--        overloads órfãos de get_cliente_projetos()/get_cliente_projeto_detail(uuid)
--        sem token, is_ultra_admin_scoped, pilar_set_ultra_admin_scope) — dead code do
--        ponto de vista de anon; revogar não muda comportamento nenhum hoje.
--      - RPCs de aplicação genuinamente autenticadas (financeiro, projetos, admin,
--        agentes) que só têm caller autenticado no repo, mas nunca tiveram o vetor
--        anon fechado — a mesma classe que motivou 20260725000000/20260810120000/
--        20260835000000, só que em escala (create_projeto_completo, update_user_access,
--        criar_*_agente, rpc_grupo_parcela_*, pagar_fatura, etc.).
--
--    Acha (achado ao vivo, à parte desta migration): `portal-entrega-download` chama
--    `verify_portal_token` com o client anônimo, mas essa função foi DROPADA em
--    `20260429600000_drop_legacy_token_portal.sql` — o branch de token legado desse
--    endpoint está quebrado hoje (chama função inexistente). Fora do escopo desta
--    migration (é bug de lógica, não de grant); registrado pra corrigir à parte.
--
-- 2. PRIVILÉGIO PADRÃO (best-effort, não é a trava real): tenta revogar o default de
--    PUBLIC/anon pra funções futuras criadas pela role `postgres`. Testado ao vivo
--    (2026-08-17) e o resultado foi negativo pro schema `public` especificamente: a
--    maioria das funções aqui está executável por `anon` via herança de PUBLIC (não
--    grant nomeado — `REVOKE ... FROM anon` sozinho é no-op nessas, por isso o loop
--    acima revoga de PUBLIC), e uma função nova criada localmente como `postgres`
--    continua nascendo com EXECUTE pra PUBLIC mesmo depois deste ALTER DEFAULT
--    PRIVILEGES — evidência de que existe TAMBÉM um default de `supabase_admin` (o
--    superuser real deste Postgres; `postgres` aqui não é superuser) pro schema
--    `public`, e `postgres` não tem permissão de alterá-lo (`permission denied to
--    change default privileges`). Mantido porque é inofensivo e pode se comportar
--    diferente num projeto hospedado, mas NÃO CONTAR com ele: a trava de verdade é o
--    pgTAP `anon_function_grants.sql`, que roda no CI a cada PR e falha se QUALQUER
--    função SECURITY DEFINER nova nascer anon-executável, seja por PUBLIC, por grant
--    nomeado, ou por qualquer outro mecanismo — não depende de entender por que o
--    Postgres decidiu conceder.
--
-- Nenhuma função authenticated/service_role é tocada: só o vetor anon/PUBLIC.

DO $$
DECLARE
  r RECORD;
  allowed CONSTANT text[] := ARRAY[
    -- Helpers de RLS (usados dentro de USING/WITH CHECK — precisam avaliar pra anon)
    'get_user_empresa_id()',
    'get_user_empresa_id_text()',
    'get_user_role()',
    'has_role(user_role[])',
    'is_company_admin()',
    'is_ultra_admin()',
    'my_empresa_id()',
    'can_view_financeiro()',
    'can_view_folha()',
    'user_has_feature(text, text)',
    'is_feature_flag_enabled(text)',
    'current_effective_role()',
    'current_impersonation()',
    'current_pessoa_id()',
    'is_impersonating()',
    -- Entrypoints pré-autenticação com caller anon real confirmado no repo
    'portal_login(text, text)',
    'portal_verify_session(text)',
    'portal_verify_session_readonly(text)',
    'portal_change_password(text, text, text)',
    'portal_listar_entregas(text, uuid)',
    'portal_aprovar_entrega(text, uuid)',
    'portal_solicitar_revisao_entrega(text, uuid, text)',
    'campo_login(text, text)',
    'campo_verify_session(text)',
    'campo_trocar_senha(text, text)',
    'campo_listar_tarefas(text)',
    'campo_criar_tarefa(text, text)',
    'campo_listar_rdos(text, integer)',
    'campo_salvar_rdo(text, date, text, text, integer, text, text, text)',
    'campo_registrar_tarefa_rdo(text, uuid, uuid, text, text)',
    'campo_registrar_medicao(text, uuid, text, numeric, text)',
    'get_cliente_projetos(text)',
    'get_cliente_projeto_detail(uuid, text)',
    'get_cliente_obras(text)',
    'get_cliente_obra_detail(text, uuid)',
    'guard_login_attempt(text)'
  ];
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname || '(' || oidvectortypes(p.proargtypes) || ')' AS sig,
           format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) AS call_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND pg_get_function_result(p.oid) <> 'trigger'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    IF NOT (r.sig = ANY (allowed)) THEN
      -- Revoga de PUBLIC (a causa real na maioria dos casos: acesso via herança, não
      -- grant nomeado a anon) e de anon explicitamente (cobre o caso raro de grant
      -- nomeado direto, ex. as classes fechadas parcialmente em migrations passadas).
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.call_sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.call_sig);
    END IF;
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
