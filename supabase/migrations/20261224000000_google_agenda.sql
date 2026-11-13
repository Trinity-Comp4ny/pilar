-- Google Agenda conectado à Pilar (SPEC 164).
--
-- Diferente do Drive (uma conta por escritório), a agenda é PESSOAL: cada usuário conecta
-- a própria conta Google em Configurações > Integrações. A Pilar pede o escopo
-- `calendar.events` (lê, cria, edita e exclui eventos) e `calendar.calendarlist.readonly`
-- (vê quais agendas a conta tem: pessoal, trabalho, compartilhadas). Copia as reuniões das
-- agendas que a pessoa escolheu, numa janela de dias, para agenda_eventos_google e:
--   * mostra as reuniões na aba Agenda de Tarefas, como mais uma camada, onde dá para
--     criar, editar e excluir sem abrir o Google Agenda;
--   * avisa no sino antes de cada reunião (categoria "agenda"). Padrão: 10 minutos antes,
--     configurável por pessoa; cada reunião pode ter o próprio aviso (o mesmo do Google).
--
-- Tabelas:
--   * google_agenda_conexoes: conta conectada por usuário e o refresh token, CIFRADO na
--     Edge Function (AES-GCM, mesma chave do Drive). Só service_role lê.
--   * google_agenda_calendarios: as agendas da conta e se cada uma aparece na Pilar.
--   * agenda_eventos_google: cópia das reuniões. Cada um lê só as próprias (RLS); só a
--     Edge Function escreve.
--   * google_drive_oauth_estados ganha `servico` ('drive' | 'agenda'): o mesmo state de
--     OAuth (só o hash, uso único, 10 minutos) serve às duas conexões.
--
-- Crons: `google-agenda-lembretes` (todo minuto, só SQL) gera os avisos que venceram;
-- `google-agenda` (5 em 5 min) chama a Edge Function google-calendar para ressincronizar
-- as conexões mais velhas.

-- 1. Conexão por usuário -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_agenda_conexoes (
  usuario_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  refresh_token_cifrado text NOT NULL,
  sincronizado_em timestamptz,
  -- 'reconectar' quando o Google recusa o refresh token (acesso revogado pela conta).
  erro text,
  -- Aviso padrão, em minutos antes da reunião; null = não avisar.
  lembrete_minutos integer DEFAULT 10
    CHECK (lembrete_minutos IS NULL OR lembrete_minutos BETWEEN 0 AND 1440),
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
  -- Agenda do Google de onde veio (id da agenda; a principal é o e-mail da conta).
  calendario_id text NOT NULL DEFAULT 'primary',
  google_evento_id text NOT NULL,
  titulo text NOT NULL,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  dia_inteiro boolean NOT NULL DEFAULT false,
  local text,
  descricao text,
  -- E-mails dos convidados (sem a própria pessoa).
  convidados text[] NOT NULL DEFAULT '{}',
  link_reuniao text,
  link_google text,
  -- A pessoa organiza a reunião (ou o organizador deixou convidado editar).
  pode_editar boolean NOT NULL DEFAULT true,
  -- Aviso desta reunião, em minutos antes (o lembrete pop-up do Google). null = usa o
  -- padrão da pessoa; -1 = esta reunião não avisa.
  lembrete_minutos integer CHECK (lembrete_minutos IS NULL OR lembrete_minutos BETWEEN -1 AND 40320),
  -- Quando o aviso de "reunião em breve" saiu. Volta a null se o horário mudar.
  lembrete_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  -- O mesmo evento pode estar em duas agendas da pessoa (convite numa agenda compartilhada).
  CONSTRAINT agenda_eventos_google_unico UNIQUE (usuario_id, calendario_id, google_evento_id)
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

-- 3b. Agendas da conta ---------------------------------------------------------
-- Lista que o Google devolve (calendarList). `visivel` é escolha da pessoa: nasce como a
-- agenda está marcada no Google (as que ela vê lá aparecem aqui). Só a Edge Function cria
-- e atualiza nome/cor; a pessoa só liga e desliga, pela função abaixo.
CREATE TABLE IF NOT EXISTS public.google_agenda_calendarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendario_id text NOT NULL,
  nome text NOT NULL,
  -- Cor da agenda no Google (#rrggbb), para a pessoa reconhecer na lista.
  cor text CHECK (cor IS NULL OR cor ~ '^#[0-9a-fA-F]{6}$'),
  principal boolean NOT NULL DEFAULT false,
  -- A pessoa pode criar e editar eventos nesta agenda (dona ou com permissão de edição).
  pode_editar boolean NOT NULL DEFAULT false,
  visivel boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_agenda_calendarios_unico UNIQUE (usuario_id, calendario_id)
);

CREATE INDEX IF NOT EXISTS google_agenda_calendarios_empresa_idx ON public.google_agenda_calendarios (empresa_id);

ALTER TABLE public.google_agenda_calendarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_agenda_calendarios FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.google_agenda_calendarios TO authenticated;

DROP POLICY IF EXISTS google_agenda_calendarios_select_proprios ON public.google_agenda_calendarios;
CREATE POLICY google_agenda_calendarios_select_proprios ON public.google_agenda_calendarios
  FOR SELECT TO authenticated
  USING (
    usuario_id = (SELECT auth.uid())
    AND empresa_id = (SELECT public.get_user_empresa_id())
  );

COMMENT ON TABLE public.google_agenda_calendarios IS
  'Agendas da conta Google de cada pessoa e se aparecem na Pilar (SPEC 164). Escrita pela Edge Function e por set_google_agenda_calendario_visivel.';

-- Liga/desliga uma agenda. Desligar tira da Pilar as reuniões dela (e os avisos); ligar
-- traz de volta na próxima sincronização (a tela sincroniza logo em seguida).
CREATE OR REPLACE FUNCTION public.set_google_agenda_calendario_visivel(p_id uuid, p_visivel boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cal record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING ERRCODE = '42501';
  END IF;
  UPDATE public.google_agenda_calendarios
     SET visivel = COALESCE(p_visivel, true), atualizado_em = now()
   WHERE id = p_id AND usuario_id = auth.uid()
  RETURNING usuario_id, calendario_id INTO v_cal;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'agenda não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF NOT COALESCE(p_visivel, true) THEN
    DELETE FROM public.agenda_eventos_google
     WHERE usuario_id = v_cal.usuario_id AND calendario_id = v_cal.calendario_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_google_agenda_calendario_visivel(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_google_agenda_calendario_visivel(uuid, boolean) TO authenticated;

-- 4. Status da conexão para a tela ------------------------------------------
CREATE OR REPLACE FUNCTION public.get_google_agenda_status()
RETURNS TABLE(
  conectado boolean,
  google_email text,
  conectado_em timestamptz,
  sincronizado_em timestamptz,
  erro text,
  lembrete_minutos integer
)
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
    c.erro,
    COALESCE(c.lembrete_minutos, -1)
  FROM (SELECT auth.uid() AS uid) u
  LEFT JOIN public.google_agenda_conexoes c ON c.usuario_id = u.uid
  WHERE u.uid IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.get_google_agenda_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_google_agenda_status() TO authenticated;

-- Aviso padrão da própria pessoa (minutos antes; negativo ou null = não avisar).
CREATE OR REPLACE FUNCTION public.set_google_agenda_lembrete(p_minutos integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_minutos > 1440 THEN
    RAISE EXCEPTION 'aviso fora do intervalo' USING ERRCODE = '22023';
  END IF;
  UPDATE public.google_agenda_conexoes
     SET lembrete_minutos = CASE WHEN p_minutos < 0 THEN NULL ELSE p_minutos END, updated_at = now()
   WHERE usuario_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Google Agenda não conectado' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_google_agenda_lembrete(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_google_agenda_lembrete(integer) TO authenticated;

-- 5. Categoria "agenda" nas notificações -------------------------------------
ALTER TABLE public.notificacoes DROP CONSTRAINT IF EXISTS notificacoes_categoria_check;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_categoria_check
  CHECK (categoria IN ('tarefa','projeto','disciplina','financeiro','obra','sistema','agenda'));

ALTER TABLE public.notificacao_preferencias DROP CONSTRAINT IF EXISTS notificacao_preferencias_categoria_check;
ALTER TABLE public.notificacao_preferencias ADD CONSTRAINT notificacao_preferencias_categoria_check
  CHECK (categoria IN ('tarefa','projeto','disciplina','financeiro','obra','sistema','agenda'));

-- 6. Lembretes: o aviso de cada reunião que já venceu e ainda não saiu ------
-- Vale o aviso da reunião (o pop-up do Google, se a pessoa definiu) ou o padrão dela
-- (10 minutos se nunca mexeu). Rodando todo minuto, sai no minuto certo. Reunião que
-- entrou na agenda já dentro da janela avisa na próxima rodada, se ainda não começou
-- (aviso "na hora" vale até 2 minutos depois do início).
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
    SELECT e.*, COALESCE(e.lembrete_minutos, c.lembrete_minutos) AS aviso
    FROM public.agenda_eventos_google e
    JOIN public.google_agenda_conexoes c ON c.usuario_id = e.usuario_id
    WHERE e.lembrete_em IS NULL
      AND NOT e.dia_inteiro
      AND e.inicio > now() - interval '2 minutes'
      -- Janela máxima de aviso (4 semanas): o índice parcial corta o resto.
      AND e.inicio <= now() + interval '28 days'
      AND COALESCE(e.lembrete_minutos, c.lembrete_minutos) >= 0
      AND now() >= e.inicio - make_interval(mins => COALESCE(e.lembrete_minutos, c.lembrete_minutos))
      AND (COALESCE(e.lembrete_minutos, c.lembrete_minutos) = 0 OR e.inicio > now())
    ORDER BY e.inicio
    LIMIT 500
  LOOP
    v_hora := to_char(v_ev.inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
    v_minutos := ceil(extract(epoch FROM (v_ev.inicio - now())) / 60)::integer;

    PERFORM public.notificar(
      v_ev.empresa_id,
      ARRAY[v_ev.usuario_id],
      'reuniao_em_breve',
      'agenda',
      'high',
      left('Reunião às ' || v_hora || ': ' || v_ev.titulo, 200),
      CASE
        WHEN v_minutos <= 0 THEN 'Começa agora'
        WHEN v_minutos < 60 THEN 'Começa em ' || v_minutos || ' min'
        ELSE 'Começa às ' || v_hora
      END ||
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

-- Cron dos avisos: só SQL, todo minuto.
CREATE OR REPLACE FUNCTION public.google_agenda_lembretes_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.agenda_gerar_lembretes();
END;
$$;

REVOKE ALL ON FUNCTION public.google_agenda_lembretes_cron() FROM PUBLIC, anon, authenticated;

-- 7. Cron: ressincronizar pela Edge Function ---------------------
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

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-agenda-lembretes') THEN
    PERFORM cron.unschedule('google-agenda-lembretes');
  END IF;
  PERFORM cron.schedule('google-agenda-lembretes', '* * * * *', 'SELECT public.google_agenda_lembretes_cron();');
END;
$$;
