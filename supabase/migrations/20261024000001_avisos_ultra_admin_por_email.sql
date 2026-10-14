-- SPEC 113: todo aviso de plataforma que chega no sino de um ultra admin
-- (feedback, novo cadastro, ativar plano bloqueado, e qualquer
-- notificar_ultra_admins futuro) também sai por e-mail, na hora.
--
-- Por que não o notificacoes-email-cron: ele exige que o destinatário seja da
-- empresa da notificação (o ultra admin nunca é da empresa do cliente que se
-- cadastrou), `sistema` não vai por e-mail no padrão, espera 5 min sem leitura
-- e junta tudo num resumo com os alertas financeiros da própria empresa dele.
-- Aqui é um e-mail por aviso, pela edge aviso-ultra-admin-email via pg_net
-- (assíncrono: quem gerou o aviso não espera o e-mail).

-- ---------------------------------------------------------------------------
-- 1. Disparo do e-mail a cada notificação de sistema endereçada a ultra admin.
--    Sem os secrets do vault (dev local), fica só o sino. Falha aqui nunca
--    derruba o insert da notificação (nem o cadastro/feedback que a gerou).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_aviso_ultra_admin_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = NEW.destinatario_id AND p.role = 'ultra_admin'
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_url := public._cron_secret('app_supabase_url');
    v_key := public._cron_secret('app_cron_secret');
    IF coalesce(v_url, '') <> '' AND coalesce(v_key, '') <> '' THEN
      PERFORM net.http_post(
        url     := v_url || '/functions/v1/aviso-ultra-admin-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body    := jsonb_build_object('notificacao_id', NEW.id),
        timeout_milliseconds := 60000
      );
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'tg_aviso_ultra_admin_email: falha ao disparar e-mail (%)', sqlerrm;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_aviso_ultra_admin_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS aviso_ultra_admin_email ON public.notificacoes;
CREATE TRIGGER aviso_ultra_admin_email
  AFTER INSERT ON public.notificacoes
  FOR EACH ROW
  WHEN (NEW.categoria = 'sistema')
  EXECUTE FUNCTION public.tg_aviso_ultra_admin_email();

-- ---------------------------------------------------------------------------
-- 2. Link do aviso cai na aba certa do /ultra-admin, não no dashboard.
--    Quem chama com um link específico mantém o dele.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notificar_ultra_admins(
  p_empresa_id uuid,
  p_tipo       text,
  p_titulo     text,
  p_mensagem   text,
  p_link       text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_destinatarios uuid[];
  v_link          text;
BEGIN
  SELECT array_agg(p.id) INTO v_destinatarios
  FROM public.profiles p
  WHERE p.role = 'ultra_admin';

  v_link := CASE
    WHEN coalesce(p_link, '/ultra-admin') <> '/ultra-admin' THEN p_link
    WHEN p_tipo = 'novo_cadastro' THEN '/ultra-admin?tab=trials'
    ELSE '/ultra-admin?tab=empresas'
  END;

  -- notificacoes.empresa_id é NOT NULL: usamos a empresa relacionada ao
  -- evento (ex.: quem foi bloqueada por carding), não uma "empresa da
  -- plataforma" fixa: mantém a notificação rastreável até o caso real.
  RETURN public.notificar(
    p_empresa_id, v_destinatarios, p_tipo, 'sistema', 'high', p_titulo, p_mensagem,
    'empresas', p_empresa_id, v_link
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notificar_ultra_admins(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_ultra_admins(uuid, text, text, text, text) TO service_role;
