-- Google Agenda conectado à Pilar (SPEC 164).
--
-- Diferente do Drive (uma conta por escritório), a agenda é PESSOAL: cada usuário conecta
-- a própria conta Google em Configurações > Integrações. A Pilar pede o escopo
-- `calendar.events.readonly` (só lê eventos), copia as reuniões de uma janela de dias
-- para agenda_eventos_google e:
--   * mostra as reuniões na aba Agenda de Tarefas, como mais uma camada;
--   * avisa no sino ~30 minutos antes de cada reunião (categoria "agenda").
--
-- Tabelas:
--   * google_agenda_conexoes: conta conectada por usuário e o refresh token, CIFRADO na
--     Edge Function (AES-GCM, mesma chave do Drive). Só service_role lê.
--   * agenda_eventos_google: cópia das reuniões. Cada um lê só as próprias (RLS); só a
--     Edge Function escreve.
--   * google_drive_oauth_estados ganha `servico` ('drive' | 'agenda'): o mesmo state de
--     OAuth (só o hash, uso único, 10 minutos) serve às duas conexões.
--
-- Cron (5 em 5 min): gera os lembretes do que começa em até 30 min e chama a Edge
-- Function google-calendar para ressincronizar as conexões mais velhas.

-- 1. Conexão por usuário -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_agenda_conexoes (
  usuario_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  refresh_token_cifrado text NOT NULL,
  sincronizado_em timestamptz,
  -- 'reconectar' quando o Google recusa o refresh token (acesso revogado pela conta).
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_agenda_conexoes_empresa_idx ON public.google_agenda_conexoes (empresa_id);
CREATE INDEX IF NOT EXISTS google_agenda_conexoes_sync_idx
  ON public.google_agenda_conexoes (sincronizado_em NULLS FIRST);

ALTER TABLE public.google_agenda_conexoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_agenda_conexoes FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.google_agenda_conexoes IS
  'Google Agenda conectado por usuário (SPEC 164). Token cifrado; só service_role.';

-- 2. State do OAuth compartilhado --------------------------------------------
ALTER TABLE public.google_drive_oauth_estados
  ADD COLUMN IF NOT EXISTS servico text NOT NULL DEFAULT 'drive';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'google_drive_oauth_estados_servico_check'
  ) THEN
    ALTER TABLE public.google_drive_oauth_estados
      ADD CONSTRAINT google_drive_oauth_estados_servico_check CHECK (servico IN ('drive', 'agenda'));
  END IF;
END;
$$;

-- 3. Eventos copiados do Google ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.agenda_eventos_google (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_evento_id text NOT NULL,
  titulo text NOT NULL,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  dia_inteiro boolean NOT NULL DEFAULT false,
  local text,
  link_reuniao text,
  link_google text,
  -- Quando o aviso de "reunião em breve" saiu. Volta a null se o horário mudar.
  lembrete_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_eventos_google_unico UNIQUE (usuario_id, google_evento_id)
);

CREATE INDEX IF NOT EXISTS agenda_eventos_google_usuario_inicio_idx
  ON public.agenda_eventos_google (usuario_id, inicio);
CREATE INDEX IF NOT EXISTS agenda_eventos_google_empresa_idx ON public.agenda_eventos_google (empresa_id);
-- Varredura dos lembretes: só o que ainda não avisou.
CREATE INDEX IF NOT EXISTS agenda_eventos_google_lembrete_idx
  ON public.agenda_eventos_google (inicio) WHERE lembrete_em IS NULL AND NOT dia_inteiro;

ALTER TABLE public.agenda_eventos_google ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agenda_eventos_google FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agenda_eventos_google TO authenticated;

DROP POLICY IF EXISTS agenda_eventos_google_select_proprios ON public.agenda_eventos_google;
CREATE POLICY agenda_eventos_google_select_proprios ON public.agenda_eventos_google
  FOR SELECT TO authenticated
  USING (
    usuario_id = (SELECT auth.uid())
    AND empresa_id = (SELECT public.get_user_empresa_id())
  );

COMMENT ON TABLE public.agenda_eventos_google IS
  'Reuniões copiadas do Google Agenda do usuário (SPEC 164). Cada um lê as suas; escrita só pela Edge Function.';

-- 4. Status da conexão para a tela ------------------------------------------
CREATE OR REPLACE FUNCTION public.get_google_agenda_status()
RETURNS TABLE(conectado boolean, google_email text, conectado_em timestamptz, sincronizado_em timestamptz, erro text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    c.usuario_id IS NOT NULL,
    c.google_email,
    c.created_at,
    c.sincronizado_em,
    c.erro
  FROM (SELECT auth.uid() AS uid) u
  LEFT JOIN public.google_agenda_conexoes c ON c.usuario_id = u.uid
  WHERE u.uid IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.get_google_agenda_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_google_agenda_status() TO authenticated;

-- 5. Categoria "agenda" nas notificações -------------------------------------
ALTER TABLE public.notificacoes DROP CONSTRAINT IF EXISTS notificacoes_categoria_check;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_categoria_check
  CHECK (categoria IN ('tarefa','projeto','disciplina','financeiro','obra','sistema','agenda'));

ALTER TABLE public.notificacao_preferencias DROP CONSTRAINT IF EXISTS notificacao_preferencias_categoria_check;
ALTER TABLE public.notificacao_preferencias ADD CONSTRAINT notificacao_preferencias_categoria_check
  CHECK (categoria IN ('tarefa','projeto','disciplina','financeiro','obra','sistema','agenda'));

-- 6. Lembretes: o que começa em até 30 minutos e ainda não avisou ------------
-- Rodando de 5 em 5 minutos, o aviso chega entre 25 e 30 minutos antes. Uma reunião que
-- entrou na agenda já em cima da hora (menos de 30 min) avisa na próxima rodada, se ainda
-- não começou.
CREATE OR REPLACE FUNCTION public.agenda_gerar_lembretes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ev record;
  v_total integer := 0;
  v_hora text;
  v_minutos integer;
BEGIN
  FOR v_ev IN
    SELECT e.*
    FROM public.agenda_eventos_google e
    JOIN public.google_agenda_conexoes c ON c.usuario_id = e.usuario_id
    WHERE e.lembrete_em IS NULL
      AND NOT e.dia_inteiro
      AND e.inicio > now()
      AND e.inicio <= now() + interval '30 minutes'
    ORDER BY e.inicio
    LIMIT 500
  LOOP
    v_hora := to_char(v_ev.inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
    v_minutos := GREATEST(1, ceil(extract(epoch FROM (v_ev.inicio - now())) / 60)::integer);

    PERFORM public.notificar(
      v_ev.empresa_id,
      ARRAY[v_ev.usuario_id],
      'reuniao_em_breve',
      'agenda',
      'high',
      left('Reunião às ' || v_hora || ': ' || v_ev.titulo, 200),
      'Começa em ' || v_minutos || ' min' ||
        CASE WHEN v_ev.link_reuniao IS NOT NULL THEN '. Toque para entrar.' ELSE '.' END,
      'agenda_evento',
      v_ev.id,
      COALESCE(v_ev.link_reuniao, '/gestao/tarefas?visao=agenda'),
      v_ev.fim
    );

    UPDATE public.agenda_eventos_google SET lembrete_em = now() WHERE id = v_ev.id;
    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.agenda_gerar_lembretes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_gerar_lembretes() TO service_role;

-- 7. Cron: lembretes + ressincronizar pela Edge Function ---------------------
CREATE OR REPLACE FUNCTION public.google_agenda_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  PERFORM public.agenda_gerar_lembretes();

  -- Ninguém conectado: não acorda a Edge Function à toa.
  IF NOT EXISTS (SELECT 1 FROM public.google_agenda_conexoes WHERE erro IS NULL) THEN
    RETURN;
  END IF;

  v_url := public._cron_secret('app_supabase_url');
  v_key := public._cron_secret('app_cron_secret');
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'google_agenda_cron: vault secrets app_supabase_url/app_cron_secret ausentes, sincronização pulada';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/google-calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('acao', 'cron'),
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.google_agenda_cron() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron indisponível (dev local): agendar google-agenda em staging/prod. Ver docs/operations/DEPLOY_CHECKLIST.md.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-agenda') THEN
    PERFORM cron.unschedule('google-agenda');
  END IF;
  PERFORM cron.schedule('google-agenda', '*/5 * * * *', 'SELECT public.google_agenda_cron();');
END;
$$;
