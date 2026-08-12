-- Central de notificações in-app · Fundação (spec 029, Fase 1; ADR 0015)
--
-- Fecha o furo do sino atual (tabela `alertas` é POR EMPRESA, com `lido` global):
-- notificações passam a ter DESTINATÁRIO por usuário e estado de leitura individual.
--   1. notificacoes            — uma linha por (evento, destinatário=profiles.id)
--   2. notificacao_preferencias— liga/desliga por categoria, por usuário
--   3. notificar(...)          — roteamento SECURITY DEFINER (dedup + preferência)
--   4. trigger em tarefa_responsaveis → evento pontual "tarefa atribuída a você"
--   5. Realtime: notificacoes na publication (sino atualiza sem refresh)
--
-- `alertas` NÃO é tocada aqui: fica dormente com o histórico; o gerador ambient
-- migra para este modelo na Fase 3 (ver spec 029).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. notificacoes — o destinatário é sempre um usuário logável (profiles.id).
--    O texto do evento é desnormalizado por linha (ADR 0015); `lido_em` é o
--    estado de leitura POR USUÁRIO. `link` é a rota interna para abrir o item.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo            text NOT NULL,   -- tarefa_atribuida, projeto_atrasado, parcela_vence, ...
  categoria       text NOT NULL    -- agrupador p/ ícone e preferência
                    CHECK (categoria IN ('tarefa','projeto','disciplina','financeiro','obra','sistema')),
  severidade      text NOT NULL DEFAULT 'medium'
                    CHECK (severidade IN ('low','medium','high','critical')),
  titulo          text NOT NULL,
  mensagem        text,
  referencia_tipo text,
  referencia_id   uuid,
  link            text,
  lido_em         timestamptz,     -- null = não lida
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz
);

-- Contador de não lidas e lista do sino: filtra por destinatário, ordena por data.
CREATE INDEX IF NOT EXISTS idx_notificacoes_dest_lido_data
  ON public.notificacoes (destinatario_id, lido_em, created_at DESC);
-- Dedup por (destinatário, tipo, referência): suporta o NOT EXISTS do gerador.
CREATE INDEX IF NOT EXISTS idx_notificacoes_dedup
  ON public.notificacoes (destinatario_id, tipo, referencia_id);

-- Realtime aplica o RLS na linha ATUALIZADA (marcar lida é UPDATE); precisa do
-- payload completo, não só a PK. Mesmo motivo de agent_runs (20260730000000).
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- 2. notificacao_preferencias — por (usuário, categoria). Ausência de linha =
--    tudo ligado in-app. Coluna email já nasce (canal é fase posterior).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificacao_preferencias (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria  text NOT NULL
               CHECK (categoria IN ('tarefa','projeto','disciplina','financeiro','obra','sistema')),
  in_app     boolean NOT NULL DEFAULT true,
  email      boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, categoria)
);

CREATE TRIGGER trg_notificacao_preferencias_updated_at
  BEFORE UPDATE ON public.notificacao_preferencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS
--    notificacoes: cada um só lê/marca AS SUAS. Nada de INSERT/DELETE pelo
--    cliente — inserção só pelas funções SECURITY DEFINER abaixo (rodam como
--    owner e passam ao largo do RLS). Assim ninguém forja notificação a outro.
--    preferencias: o usuário gerencia as próprias.
-- ---------------------------------------------------------------------------
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notificacoes_select ON public.notificacoes
  FOR SELECT USING (
    destinatario_id = auth.uid()
    AND empresa_id = public.get_user_empresa_id()
  );

CREATE POLICY notificacoes_update ON public.notificacoes
  FOR UPDATE USING (destinatario_id = auth.uid())
  WITH CHECK (destinatario_id = auth.uid());

GRANT SELECT, UPDATE ON public.notificacoes TO authenticated;

ALTER TABLE public.notificacao_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY notificacao_preferencias_select ON public.notificacao_preferencias
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notificacao_preferencias_insert ON public.notificacao_preferencias
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND empresa_id = public.get_user_empresa_id()
  );

CREATE POLICY notificacao_preferencias_update ON public.notificacao_preferencias
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notificacao_preferencias_delete ON public.notificacao_preferencias
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacao_preferencias TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. notificar(...) — ponto único de roteamento. Recebe já os destinatários
--    resolvidos (o CHAMADOR conhece a regra de responsabilidade/papel) e, para
--    cada um: respeita a preferência da categoria e não empilha não-lidas
--    (dedup por destinatário+tipo+referência). SECURITY DEFINER para inserir
--    apesar do RLS; REVOKE de PUBLIC para o cliente não chamar direto e forjar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notificar(
  p_empresa_id    uuid,
  p_destinatarios uuid[],
  p_tipo          text,
  p_categoria     text,
  p_severidade    text,
  p_titulo        text,
  p_mensagem      text DEFAULT NULL,
  p_ref_tipo      text DEFAULT NULL,
  p_ref_id        uuid DEFAULT NULL,
  p_link          text DEFAULT NULL,
  p_expires_at    timestamptz DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dest    uuid;
  v_count   integer := 0;
BEGIN
  IF p_destinatarios IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH v_dest IN ARRAY p_destinatarios LOOP
    CONTINUE WHEN v_dest IS NULL;

    -- Preferência do usuário: categoria desligada in-app → não gera.
    IF EXISTS (
      SELECT 1 FROM public.notificacao_preferencias
      WHERE user_id = v_dest AND categoria = p_categoria AND in_app = false
    ) THEN
      CONTINUE;
    END IF;

    -- Dedup: já existe uma não-lida para a mesma referência? Não empilha.
    IF EXISTS (
      SELECT 1 FROM public.notificacoes
      WHERE destinatario_id = v_dest
        AND tipo = p_tipo
        AND referencia_id IS NOT DISTINCT FROM p_ref_id
        AND lido_em IS NULL
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notificacoes (
      empresa_id, destinatario_id, tipo, categoria, severidade,
      titulo, mensagem, referencia_tipo, referencia_id, link, expires_at
    ) VALUES (
      p_empresa_id, v_dest, p_tipo, p_categoria, p_severidade,
      p_titulo, p_mensagem, p_ref_tipo, p_ref_id, p_link, p_expires_at
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notificar(uuid, uuid[], text, text, text, text, text, text, uuid, text, timestamptz) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 5. Evento pontual — "tarefa atribuída a você".
--    Dispara ao entrar uma linha na ponte tarefa_responsaveis. Só notifica a
--    pessoa que TEM conta (profile_id não nulo) e que NÃO é quem atribuiu
--    (auth.uid()). Guarda de unicidade PERMANENTE por (destinatário, tarefa):
--    o app hoje sincroniza responsáveis apagando+reinserindo a ponte, então um
--    AFTER INSERT reincide a cada edição — aqui só notifica na primeira vez que
--    a pessoa vira responsável daquela tarefa (mesmo que já tenha lido antes).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_notificar_tarefa_atribuida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile uuid;
  v_titulo  text;
BEGIN
  SELECT profile_id INTO v_profile
  FROM public.pessoas
  WHERE id = NEW.pessoa_id;

  -- Sem conta, ou é auto-atribuição: nada a notificar.
  IF v_profile IS NULL OR v_profile = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Unicidade permanente para este evento pontual (reedições não re-notificam).
  IF EXISTS (
    SELECT 1 FROM public.notificacoes
    WHERE destinatario_id = v_profile
      AND tipo = 'tarefa_atribuida'
      AND referencia_id = NEW.tarefa_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT titulo INTO v_titulo FROM public.tarefas WHERE id = NEW.tarefa_id;

  PERFORM public.notificar(
    NEW.empresa_id,
    ARRAY[v_profile],
    'tarefa_atribuida',
    'tarefa',
    'medium',
    'Tarefa atribuída a você',
    COALESCE(v_titulo, 'Uma tarefa foi atribuída a você.'),
    'tarefa',
    NEW.tarefa_id,
    '/meu-trabalho'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_tarefa_atribuida ON public.tarefa_responsaveis;
CREATE TRIGGER trg_notificar_tarefa_atribuida
  AFTER INSERT ON public.tarefa_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.tg_notificar_tarefa_atribuida();

-- ---------------------------------------------------------------------------
-- 6. Realtime — publica notificacoes. O RLS de SELECT continua sendo a barreira:
--    cada cliente só recebe eventos das linhas onde é o destinatário.
--    Idempotente (não falha ao reaplicar).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notificacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
  END IF;
END $$;

COMMIT;
