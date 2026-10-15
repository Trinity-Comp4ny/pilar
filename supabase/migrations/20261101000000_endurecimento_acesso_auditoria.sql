-- Endurecimento de acesso (auditoria de segurança de 2026-10).
--
-- Fecha lacunas de privilégio e de policy encontradas na revisão de acesso. Cada bloco
-- tem teste em supabase/tests/endurecimento_acesso_2026_10.sql.
--
--   1. empresas: UPDATE por coluna. Colunas de plataforma (plano, trial, limites,
--      verificação de documento, retenção, exclusão) só mudam por service role ou RPC
--      de ultra_admin. Colunas novas nascem sem UPDATE para usuário: a tela que precisar
--      gravar uma coluna nova ganha o GRANT na migration que a cria.
--   2. portal_login e campo_login: a tentativa errada passa a contar no limite.
--   3. agent_runs / agent_actions: o chat com os agentes é individual. O rascunho (que
--      guarda a mensagem do usuário e o que o agente extraiu) é de quem criou, nem o admin
--      lê o dos outros. Rascunho do sistema (sem autor) fica com quem vê dinheiro.
--   4. profiles.email deixa de ser gravável pelo usuário e o vínculo pessoa/perfil
--      respeita a empresa.
--   5. ai_usage_logs: sem INSERT por usuário.
--   6. insert_audit_log: só triggers (SECURITY DEFINER) e service role.

-- =============================================================================
-- 1. empresas
-- =============================================================================
REVOKE UPDATE ON public.empresas FROM authenticated, anon;

GRANT UPDATE (
  nome, cnpj, status, email, contato, endereco, cidade, estado, cep,
  pix_chave, pix_instrucoes, logo_url, onboarding_completed,
  updated_at, updated_by
) ON public.empresas TO authenticated;

-- =============================================================================
-- 2. portal_login e campo_login
-- =============================================================================
-- portal_login: a falha de senha deixava de contar porque o RAISE desfazia o registro do
-- limite na mesma transação. Agora a credencial inválida devolve NULL (o front já trata
-- "sem dados" como credencial inválida) e o contador permanece. O estouro do limite
-- continua levantando erro: nele não há nada a registrar.
CREATE OR REPLACE FUNCTION public.portal_login(p_email text, p_senha text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_rec RECORD;
  v_email_norm TEXT;
  v_allowed BOOLEAN;
  v_ip TEXT;
  v_id UUID;
  v_cliente_id UUID;
  v_empresa_id UUID;
  v_nome TEXT;
  v_email TEXT;
  v_must_change BOOLEAN;
  v_token_plain TEXT;
  v_token_hash TEXT;
  v_achou_conta BOOLEAN := FALSE;
BEGIN
  v_email_norm := lower(trim(p_email));

  -- Teto por IP (camada extra, nao substitui o limite por email). x-forwarded-for
  -- pode vir "client, proxy1, proxy2": pega o primeiro salto. So aplica quando o IP
  -- e conhecido, para nao jogar todo mundo num balde 'unknown' compartilhado.
  v_ip := trim(split_part(
    COALESCE(
      current_setting('request.headers', true)::json->>'x-real-ip',
      current_setting('request.headers', true)::json->>'x-forwarded-for'
    ),
    ',', 1
  ));
  IF v_ip IS NOT NULL AND v_ip <> '' THEN
    IF NOT public.check_rate_limit('portal_login_ip', v_ip, 30, 900) THEN
      RAISE EXCEPTION 'Muitas tentativas. Aguarde 15 minutos e tente novamente.';
    END IF;
  END IF;

  v_allowed := public.check_rate_limit('portal_login', v_email_norm, 5, 900);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde 15 minutos e tente novamente.';
  END IF;

  -- Email e unico por empresa (nao global): pode haver mais de uma conta com o
  -- mesmo email em empresas diferentes. Entra na primeira conta ativa cuja senha
  -- confere. Falha silenciosa e generica evita enumeration de conta/empresa.
  FOR v_rec IN
    SELECT id, cliente_id, empresa_id, nome, email, senha_hash, ativo, must_change_password
    FROM cliente_portal_accounts
    WHERE email = v_email_norm
  LOOP
    v_achou_conta := TRUE;
    IF v_rec.ativo
       AND v_rec.senha_hash IS NOT NULL
       AND crypt(p_senha, v_rec.senha_hash) = v_rec.senha_hash THEN
      v_id := v_rec.id;
      v_cliente_id := v_rec.cliente_id;
      v_empresa_id := v_rec.empresa_id;
      v_nome := v_rec.nome;
      v_email := v_rec.email;
      v_must_change := v_rec.must_change_password;
      EXIT;
    END IF;
  END LOOP;

  IF v_id IS NULL THEN
    -- Sem conta para o e-mail: gasta o mesmo bcrypt de quem tem conta, para o tempo
    -- de resposta nao distinguir e-mail cadastrado de nao cadastrado.
    IF NOT v_achou_conta THEN
      PERFORM crypt(p_senha, gen_salt('bf'));
    END IF;
    RETURN NULL;
  END IF;

  v_token_plain := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token_plain, 'sha256'), 'hex');

  UPDATE cliente_portal_accounts
  SET token_sessao = v_token_hash,
      token_expira_em = NOW() + INTERVAL '7 days',
      ultimo_acesso = NOW()
  WHERE id = v_id;

  RETURN json_build_object(
    'token', v_token_plain,
    'id', v_id,
    'cliente_id', v_cliente_id,
    'empresa_id', v_empresa_id,
    'nome', v_nome,
    'email', v_email,
    'must_change_password', COALESCE(v_must_change, false)
  );
END;
$function$;

-- campo_login: ganha o mesmo limite (5 por e-mail e 30 por IP em 15 minutos). Devolve
-- JSON de erro em vez de levantar exceção, que é o contrato que a tela já usa.
CREATE OR REPLACE FUNCTION public.campo_login(p_email text, p_senha text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_acc        public.campo_accounts;
  v_token      text;
  v_email_norm text := lower(trim(p_email));
  v_ip         text;
BEGIN
  v_ip := trim(split_part(
    COALESCE(
      current_setting('request.headers', true)::json->>'x-real-ip',
      current_setting('request.headers', true)::json->>'x-forwarded-for'
    ),
    ',', 1
  ));
  IF v_ip IS NOT NULL AND v_ip <> '' THEN
    IF NOT public.check_rate_limit('campo_login_ip', v_ip, 30, 900) THEN
      RETURN json_build_object('ok', false, 'erro', 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
    END IF;
  END IF;

  IF NOT public.check_rate_limit('campo_login', v_email_norm, 5, 900) THEN
    RETURN json_build_object('ok', false, 'erro', 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
  END IF;

  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE email = v_email_norm AND ativo = true
  LIMIT 1;

  -- Email inexistente: roda um bcrypt dummy para o tempo de resposta não
  -- denunciar a existência do email (mitiga enumeração por timing). Mensagem
  -- genérica em ambos os casos.
  IF v_acc.id IS NULL OR v_acc.senha_hash IS NULL THEN
    PERFORM crypt(p_senha, gen_salt('bf'));
    RETURN json_build_object('ok', false, 'erro', 'Email ou senha inválidos');
  END IF;
  IF crypt(p_senha, v_acc.senha_hash) <> v_acc.senha_hash THEN
    RETURN json_build_object('ok', false, 'erro', 'Email ou senha inválidos');
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  UPDATE public.campo_accounts
  SET token_sessao    = encode(extensions.digest(v_token, 'sha256'), 'hex'),
      token_expira_em = now() + interval '30 days',
      ultimo_acesso   = now()
  WHERE id = v_acc.id;

  RETURN json_build_object(
    'ok', true,
    'token', v_token,
    'obra_id', v_acc.obra_id,
    'empresa_id', v_acc.empresa_id,
    'nome', v_acc.nome,
    'must_change_senha', v_acc.must_change_senha
  );
END;
$function$;

-- =============================================================================
-- 3. agent_runs e agent_actions
-- =============================================================================
-- O chat com os agentes é individual: `agent_runs.input` guarda a mensagem do usuário e
-- `result` o que o agente extraiu (valor, CPF, salário). Quem lê e altera é quem criou, e
-- nem o admin vê o rascunho de outra pessoa. A exceção é o rascunho gerado pelo sistema
-- (guardião de margem, sem autor): não é conversa de ninguém e quem confirma é quem vê
-- dinheiro (can_view_financeiro). O INSERT exige que o criador seja o próprio usuário.
DROP POLICY IF EXISTS agent_runs_select ON public.agent_runs;
DROP POLICY IF EXISTS agent_runs_update ON public.agent_runs;
DROP POLICY IF EXISTS agent_runs_service_insert ON public.agent_runs;

CREATE POLICY agent_runs_select ON public.agent_runs
  FOR SELECT
  USING (
    empresa_id = public.get_user_empresa_id()
    AND (
      created_by = (SELECT auth.uid())
      OR (created_by IS NULL AND public.can_view_financeiro())
    )
  );

CREATE POLICY agent_runs_update ON public.agent_runs
  FOR UPDATE
  USING (
    empresa_id = public.get_user_empresa_id()
    AND (
      created_by = (SELECT auth.uid())
      OR (created_by IS NULL AND public.can_view_financeiro())
    )
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND (
      created_by = (SELECT auth.uid())
      OR (created_by IS NULL AND public.can_view_financeiro())
    )
  );

CREATE POLICY agent_runs_insert ON public.agent_runs
  FOR INSERT
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND created_by = (SELECT auth.uid())
  );

-- agent_actions: escrever exige enxergar o run (a subconsulta passa pela RLS de agent_runs).
DROP POLICY IF EXISTS agent_actions_service_insert ON public.agent_actions;

CREATE POLICY agent_actions_insert ON public.agent_actions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_runs r
      WHERE r.id = agent_actions.run_id
        AND r.empresa_id = public.get_user_empresa_id()
    )
  );

REVOKE ALL ON public.agent_runs, public.agent_actions FROM anon;

-- =============================================================================
-- 4. profiles.email e vínculo pessoa/perfil
-- =============================================================================
-- A tela nunca grava profiles.email (a troca de e-mail passa pelo Auth).
REVOKE UPDATE (email) ON public.profiles FROM authenticated, anon;

-- O vínculo por e-mail agora fica dentro da empresa: o mesmo endereço em outra empresa
-- não liga pessoa a perfil.
CREATE OR REPLACE FUNCTION public.link_pessoa_profile_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.email IS NOT NULL THEN
        NEW.profile_id := (
          SELECT id FROM public.profiles
          WHERE email = NEW.email AND empresa_id = NEW.empresa_id
          LIMIT 1
        );
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_profile_pessoa_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE public.pessoas
    SET profile_id = NEW.id
    WHERE email = NEW.email AND empresa_id = NEW.empresa_id;
    RETURN NULL;
END;
$function$;

-- =============================================================================
-- 5. ai_usage_logs
-- =============================================================================
-- Quem grava é service role, que ignora RLS. A policy aberta e o grant anônimo saem.
DROP POLICY IF EXISTS service_insert ON public.ai_usage_logs;
REVOKE ALL ON public.ai_usage_logs FROM anon;

-- =============================================================================
-- 6. insert_audit_log
-- =============================================================================
-- Só triggers SECURITY DEFINER chamam; o autor do log nunca é escolhido pelo usuário.
REVOKE EXECUTE ON FUNCTION public.insert_audit_log(text, text, uuid, jsonb, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
