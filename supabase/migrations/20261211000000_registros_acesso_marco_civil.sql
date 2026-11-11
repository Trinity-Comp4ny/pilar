-- Registro de acesso a aplicação (Marco Civil da Internet, Lei 12.965/2014, art. 15).
--
-- Provedor de aplicação com fins econômicos guarda data, hora e IP de cada acesso por 6
-- meses. Até aqui o Pilar não guardava: audit_logs só anota ação de administrador e o log
-- de autenticação do Supabase não tem essa retenção. A Política de Privacidade (v2.0)
-- já promete o registro; esta migration faz o sistema cumprir.
--
-- Três portas de entrada, cada uma com o próprio gatilho (nenhuma função de login muda):
--   app    → auth.sessions: login por senha, Google ou link cria uma linha com IP e
--            navegador. A renovação do token também conta como uso, no máximo um registro
--            por sessão e IP a cada 24 horas.
--   portal → cliente_portal_accounts.token_sessao muda a cada login do portal do cliente.
--   campo  → campo_accounts.token_sessao muda a cada login do Pilar Campo.
--
-- Gatilho em tabela de login nunca pode derrubar o login: toda falha vira WARNING.
-- Retenção: 6 meses (mínimo da lei; guardar mais exigiria outra finalidade). Limpeza diária.
-- Leitura: só service role (exportação de dados do titular, investigação, ordem judicial).

CREATE TABLE IF NOT EXISTS public.registros_acesso (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  origem      text NOT NULL CHECK (origem IN ('app', 'portal', 'campo')),
  user_id     uuid,
  conta_id    uuid,
  sessao_id   uuid,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.registros_acesso IS
  'Registro de acesso (IP, data e hora) exigido pelo Marco Civil, art. 15. Retenção de 6 meses. Só service role lê.';

CREATE INDEX IF NOT EXISTS registros_acesso_created_at_idx ON public.registros_acesso (created_at);
CREATE INDEX IF NOT EXISTS registros_acesso_user_idx ON public.registros_acesso (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS registros_acesso_sessao_idx ON public.registros_acesso (sessao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS registros_acesso_empresa_idx ON public.registros_acesso (empresa_id);

ALTER TABLE public.registros_acesso ENABLE ROW LEVEL SECURITY;
-- Ninguém escreve pela API: só os gatilhos (SECURITY DEFINER). Leitura só do ultra admin,
-- para investigar incidente ou atender ordem judicial; usuário comum não vê nem o próprio
-- registro pela API (vê na exportação de dados do titular).
REVOKE ALL ON public.registros_acesso FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.registros_acesso TO authenticated;
GRANT SELECT, DELETE ON public.registros_acesso TO service_role;

DROP POLICY IF EXISTS "Registros de acesso: ultra admin lê" ON public.registros_acesso;
CREATE POLICY "Registros de acesso: ultra admin lê" ON public.registros_acesso
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_ultra_admin()));

-- IP do cliente nas RPCs chamadas pelo PostgREST: primeiro salto do x-forwarded-for,
-- mesma regra do limite por IP de portal_login e campo_login.
CREATE OR REPLACE FUNCTION public.ip_da_requisicao()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT nullif(trim(split_part(
    COALESCE(
      current_setting('request.headers', true)::json->>'x-real-ip',
      current_setting('request.headers', true)::json->>'x-forwarded-for'
    ),
    ',', 1
  )), '');
$$;

CREATE OR REPLACE FUNCTION public.user_agent_da_requisicao()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT left(current_setting('request.headers', true)::json->>'user-agent', 300);
$$;

REVOKE ALL ON FUNCTION public.ip_da_requisicao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_agent_da_requisicao() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- app: auth.sessions
-- =============================================================================
CREATE OR REPLACE FUNCTION public.registrar_acesso_sessao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_ip text;
BEGIN
  BEGIN
    v_ip := host(NEW.ip);

    -- Renovação de token: um registro por sessão e IP a cada 24 horas basta para provar
    -- o uso sem gravar uma linha por hora de trabalho.
    IF TG_OP = 'UPDATE' AND EXISTS (
      SELECT 1 FROM public.registros_acesso r
      WHERE r.sessao_id = NEW.id
        AND r.ip IS NOT DISTINCT FROM v_ip
        AND r.created_at > now() - interval '24 hours'
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.registros_acesso (empresa_id, origem, user_id, sessao_id, ip, user_agent)
    VALUES (
      (SELECT p.empresa_id FROM public.profiles p WHERE p.id = NEW.user_id),
      'app',
      NEW.user_id,
      NEW.id,
      v_ip,
      left(NEW.user_agent, 300)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'registrar_acesso_sessao falhou: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_acesso_sessao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS registrar_acesso_sessao_insert ON auth.sessions;
CREATE TRIGGER registrar_acesso_sessao_insert
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION public.registrar_acesso_sessao();

DROP TRIGGER IF EXISTS registrar_acesso_sessao_renovacao ON auth.sessions;
CREATE TRIGGER registrar_acesso_sessao_renovacao
  AFTER UPDATE OF refreshed_at ON auth.sessions
  FOR EACH ROW
  WHEN (NEW.refreshed_at IS DISTINCT FROM OLD.refreshed_at)
  EXECUTE FUNCTION public.registrar_acesso_sessao();

-- =============================================================================
-- portal e campo: token de sessão novo = login
-- =============================================================================
CREATE OR REPLACE FUNCTION public.registrar_acesso_conta_convidada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    INSERT INTO public.registros_acesso (empresa_id, origem, conta_id, ip, user_agent)
    VALUES (
      NEW.empresa_id,
      TG_ARGV[0],
      NEW.id,
      public.ip_da_requisicao(),
      public.user_agent_da_requisicao()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'registrar_acesso_conta_convidada falhou: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_acesso_conta_convidada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS registrar_acesso_portal ON public.cliente_portal_accounts;
CREATE TRIGGER registrar_acesso_portal
  AFTER UPDATE OF token_sessao ON public.cliente_portal_accounts
  FOR EACH ROW
  WHEN (NEW.token_sessao IS NOT NULL AND NEW.token_sessao IS DISTINCT FROM OLD.token_sessao)
  EXECUTE FUNCTION public.registrar_acesso_conta_convidada('portal');

DROP TRIGGER IF EXISTS registrar_acesso_campo ON public.campo_accounts;
CREATE TRIGGER registrar_acesso_campo
  AFTER UPDATE OF token_sessao ON public.campo_accounts
  FOR EACH ROW
  WHEN (NEW.token_sessao IS NOT NULL AND NEW.token_sessao IS DISTINCT FROM OLD.token_sessao)
  EXECUTE FUNCTION public.registrar_acesso_conta_convidada('campo');

-- =============================================================================
-- Retenção: 6 meses
-- =============================================================================
CREATE OR REPLACE FUNCTION public.limpar_registros_acesso()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_apagados integer;
BEGIN
  DELETE FROM public.registros_acesso WHERE created_at < now() - interval '6 months';
  GET DIAGNOSTICS v_apagados = ROW_COUNT;
  RETURN v_apagados;
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_registros_acesso() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.limpar_registros_acesso() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'limpar-registros-acesso-daily') THEN
      PERFORM cron.unschedule('limpar-registros-acesso-daily');
    END IF;
    PERFORM cron.schedule('limpar-registros-acesso-daily', '40 4 * * *', 'SELECT public.limpar_registros_acesso();');
  END IF;
END;
$$;
