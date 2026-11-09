-- SPEC 135 fase A: diário de obra em registros. Quem está na obra grava um registro
-- curto (áudio, foto, texto) e fecha o app; a IA organiza em segundo plano. O RDO do
-- dia (obra_rdo) continua existindo e é fechado pelo gestor na fase B.
--
-- Escrita do campo: só pela edge `campo-registro-criar` (service_role), porque a conta
-- de campo não tem auth.uid. Leitura do campo: RPC com token (mesma allowlist de anon de
-- campo_listar_rdos). O áudio fica em bucket privado (ADR 0062).

-- 1. Aceite do aviso de áudio guardado (ADR 0062) ---------------------------------
ALTER TABLE public.campo_accounts ADD COLUMN IF NOT EXISTS aceite_audio_em timestamptz;

-- 2. Bucket privado do áudio -------------------------------------------------------
-- Path: {empresa_id}/{obra_id}/{client_id}.{ext}. O escritório lê por URL assinada; o
-- upload do campo é da edge (service_role, que ignora estas policies).
INSERT INTO storage.buckets (id, name, public)
VALUES ('obra-registro-audio', 'obra-registro-audio', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "registro_audio_storage_select" ON storage.objects;
CREATE POLICY "registro_audio_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'obra-registro-audio' AND (storage.foldername(name))[1] = public.get_user_empresa_id_text());

DROP POLICY IF EXISTS "registro_audio_storage_delete" ON storage.objects;
CREATE POLICY "registro_audio_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'obra-registro-audio' AND (storage.foldername(name))[1] = public.get_user_empresa_id_text());

-- 3. Registros ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.obra_registro (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id             uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id                uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  -- Nulo até o gestor fechar o dia (fase B).
  rdo_id                 uuid REFERENCES public.obra_rdo(id) ON DELETE SET NULL,
  -- Idempotência: a fila offline reenvia o mesmo registro sem duplicar.
  client_id              uuid NOT NULL,
  autor_user_id          uuid,
  autor_campo_account_id uuid REFERENCES public.campo_accounts(id) ON DELETE SET NULL,
  autor_nome             text NOT NULL,
  data_registro          date NOT NULL,
  tipo                   text NOT NULL CHECK (tipo IN ('audio', 'foto', 'texto', 'misto')),
  texto_bruto            text,
  texto_organizado       text,
  extraido               jsonb NOT NULL DEFAULT '{}'::jsonb,
  audio_path             text,
  audio_duracao_s        integer CHECK (audio_duracao_s IS NULL OR audio_duracao_s BETWEEN 0 AND 600),
  fotos                  text[] NOT NULL DEFAULT '{}',
  status                 text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'organizando', 'pronto', 'falhou')),
  -- Tipo fechado do erro de IA, nunca o texto cru do provedor (SPEC 110).
  erro                   text,
  -- Nasce interno: só o gestor libera para o cliente (SPEC 135, requisito 17).
  visivel_cliente        boolean NOT NULL DEFAULT false,
  criado_em              timestamptz NOT NULL DEFAULT now(),
  atualizado_em          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, client_id),
  CHECK (audio_path IS NOT NULL OR tipo <> 'audio'),
  CHECK (texto_bruto IS NULL OR length(texto_bruto) <= 20000),
  CHECK (texto_organizado IS NULL OR length(texto_organizado) <= 20000),
  CHECK (cardinality(fotos) <= 12),
  CHECK (jsonb_typeof(extraido) = 'object' AND pg_column_size(extraido) <= 16384)
);

CREATE INDEX IF NOT EXISTS idx_obra_registro_obra_dia ON public.obra_registro (obra_id, data_registro DESC, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_obra_registro_empresa ON public.obra_registro (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_registro_rdo ON public.obra_registro (rdo_id) WHERE rdo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_obra_registro_conta ON public.obra_registro (autor_campo_account_id) WHERE autor_campo_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_obra_registro_pendentes ON public.obra_registro (atualizado_em) WHERE status IN ('enviado', 'organizando');

ALTER TABLE public.obra_registro ENABLE ROW LEVEL SECURITY;

-- Escritório: só a própria empresa (mesmo critério do obra_rdo). O campo grava pela edge.
CREATE POLICY obra_registro_select ON public.obra_registro
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_registro_insert ON public.obra_registro
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_registro_update ON public.obra_registro
  FOR UPDATE USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_registro_delete ON public.obra_registro
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- 4. Sessão de campo (helper interno) -----------------------------------------------
CREATE OR REPLACE FUNCTION public._campo_verify_session_row(p_token text)
RETURNS public.campo_accounts
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc public.campo_accounts;
BEGIN
  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true AND token_expira_em > now()
  LIMIT 1;
  RETURN v_acc;
END;
$$;

REVOKE ALL ON FUNCTION public._campo_verify_session_row(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._campo_verify_session_row(text) TO service_role;

-- 5. Aceite do áudio guardado (o campo chama direto) -------------------------------
CREATE OR REPLACE FUNCTION public.campo_aceitar_audio(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc public.campo_accounts;
BEGIN
  v_acc := public._campo_verify_session_row(p_token);
  IF v_acc.id IS NULL OR v_acc.must_change_senha THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;
  UPDATE public.campo_accounts
     SET aceite_audio_em = COALESCE(aceite_audio_em, now())
   WHERE id = v_acc.id;
  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.campo_aceitar_audio(text) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_aceitar_audio(text) TO anon, authenticated, service_role;

-- 6. Criar registro (edge, service_role) --------------------------------------------
CREATE OR REPLACE FUNCTION public._campo_criar_registro(
  p_token text,
  p_client_id uuid,
  p_data date,
  p_texto text,
  p_audio_path text,
  p_audio_duracao_s integer,
  p_fotos text[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc    public.campo_accounts;
  v_texto  text := NULLIF(btrim(COALESCE(p_texto, '')), '');
  v_fotos  text[] := COALESCE(p_fotos, '{}');
  v_tipo   text;
  v_id     uuid;
BEGIN
  v_acc := public._campo_verify_session_row(p_token);
  IF v_acc.id IS NULL OR v_acc.must_change_senha THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;

  IF p_data < current_date - 30 OR p_data > current_date + 1 THEN
    RETURN json_build_object('ok', false, 'erro', 'Data inválida');
  END IF;
  IF v_texto IS NULL AND p_audio_path IS NULL AND cardinality(v_fotos) = 0 THEN
    RETURN json_build_object('ok', false, 'erro', 'Registro vazio');
  END IF;
  IF p_audio_path IS NOT NULL AND v_acc.aceite_audio_em IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'aceite_audio');
  END IF;

  v_tipo := CASE
    WHEN p_audio_path IS NOT NULL AND v_texto IS NULL AND cardinality(v_fotos) = 0 THEN 'audio'
    WHEN p_audio_path IS NULL AND v_texto IS NOT NULL AND cardinality(v_fotos) = 0 THEN 'texto'
    WHEN p_audio_path IS NULL AND v_texto IS NULL THEN 'foto'
    ELSE 'misto'
  END;

  INSERT INTO public.obra_registro (
    empresa_id, obra_id, client_id, autor_campo_account_id, autor_nome, data_registro,
    tipo, texto_bruto, audio_path, audio_duracao_s, fotos, status
  )
  VALUES (
    v_acc.empresa_id, v_acc.obra_id, p_client_id, v_acc.id, v_acc.nome, p_data,
    v_tipo, v_texto, p_audio_path, p_audio_duracao_s, v_fotos,
    -- Só foto não tem o que organizar.
    CASE WHEN p_audio_path IS NULL AND v_texto IS NULL THEN 'pronto' ELSE 'enviado' END
  )
  ON CONFLICT (obra_id, client_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.obra_registro
     WHERE obra_id = v_acc.obra_id AND client_id = p_client_id;
    RETURN json_build_object('ok', true, 'registro_id', v_id, 'existente', true);
  END IF;

  RETURN json_build_object('ok', true, 'registro_id', v_id, 'existente', false);
END;
$$;

REVOKE ALL ON FUNCTION public._campo_criar_registro(text, uuid, date, text, text, integer, text[]) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._campo_criar_registro(text, uuid, date, text, text, integer, text[]) TO service_role;

-- 7. Listar registros da obra (o campo chama direto, com o token) -------------------
CREATE OR REPLACE FUNCTION public.campo_listar_registros(p_token text, p_limite integer DEFAULT 60)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc  public.campo_accounts;
  v_rows json;
BEGIN
  v_acc := public._campo_verify_session_row(p_token);
  IF v_acc.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;

  SELECT COALESCE(json_agg(r ORDER BY r.data_registro DESC, r.criado_em DESC), '[]'::json) INTO v_rows
  FROM (
    SELECT g.id, g.client_id, g.data_registro, g.tipo, g.status, g.autor_nome, g.criado_em, g.erro,
           COALESCE(g.texto_organizado, g.texto_bruto) AS texto,
           g.extraido, g.audio_duracao_s,
           (g.audio_path IS NOT NULL) AS tem_audio,
           cardinality(g.fotos) AS fotos,
           (g.autor_campo_account_id = v_acc.id) AS meu
    FROM public.obra_registro g
    WHERE g.obra_id = v_acc.obra_id
    ORDER BY g.data_registro DESC, g.criado_em DESC
    LIMIT greatest(1, least(p_limite, 120))
  ) r;

  RETURN json_build_object('ok', true, 'registros', v_rows, 'aceitou_audio', v_acc.aceite_audio_em IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.campo_listar_registros(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_listar_registros(text, integer) TO anon, authenticated, service_role;

-- 7b. Resposta opcional à pergunta "Quantas pessoas trabalharam hoje?" ----------------
-- Só o autor (a própria conta de campo) responde, e só em registro já organizado.
CREATE OR REPLACE FUNCTION public.campo_responder_efetivo(p_token text, p_registro_id uuid, p_quantidade integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc public.campo_accounts;
  v_n   integer;
BEGIN
  v_acc := public._campo_verify_session_row(p_token);
  IF v_acc.id IS NULL OR v_acc.must_change_senha THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;
  IF p_quantidade IS NULL OR p_quantidade < 0 OR p_quantidade > 5000 THEN
    RETURN json_build_object('ok', false, 'erro', 'Quantidade inválida');
  END IF;

  UPDATE public.obra_registro
     SET extraido = jsonb_set(jsonb_set(extraido, '{efetivo_total}', to_jsonb(p_quantidade)), '{pergunta}', 'null'::jsonb),
         atualizado_em = now()
   WHERE id = p_registro_id
     AND obra_id = v_acc.obra_id
     AND autor_campo_account_id = v_acc.id
     AND status = 'pronto';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RETURN json_build_object('ok', false, 'erro', 'Registro não encontrado');
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.campo_responder_efetivo(text, uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.campo_responder_efetivo(text, uuid, integer) TO anon, authenticated, service_role;

-- 8. Organização em segundo plano (edge, service_role) ------------------------------
-- Pega o registro para organizar de forma atômica: dois disparos juntos não processam
-- duas vezes. Um "organizando" parado há mais de 5 minutos (função que caiu no meio) pode
-- ser retomado.
CREATE OR REPLACE FUNCTION public._registro_iniciar_organizacao(p_id uuid)
RETURNS public.obra_registro
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg public.obra_registro;
BEGIN
  UPDATE public.obra_registro
     SET status = 'organizando', erro = NULL, atualizado_em = now()
   WHERE id = p_id
     AND (status IN ('enviado', 'falhou')
          OR (status = 'organizando' AND atualizado_em < now() - interval '5 minutes'))
  RETURNING * INTO v_reg;
  RETURN v_reg;
END;
$$;

REVOKE ALL ON FUNCTION public._registro_iniciar_organizacao(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._registro_iniciar_organizacao(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._registro_gravar_organizacao(
  p_id uuid,
  p_status text,
  p_texto_bruto text,
  p_texto_organizado text,
  p_extraido jsonb,
  p_erro text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 'organizando' só guarda o texto já transcrito (se a extração cair, o reprocesso não
  -- paga o áudio de novo); o estado final é 'pronto' ou 'falhou'.
  IF p_status NOT IN ('organizando', 'pronto', 'falhou') THEN
    RAISE EXCEPTION 'status inválido: %', p_status;
  END IF;
  UPDATE public.obra_registro
     SET status = p_status,
         texto_bruto = COALESCE(p_texto_bruto, texto_bruto),
         texto_organizado = CASE WHEN p_status = 'pronto' THEN p_texto_organizado ELSE texto_organizado END,
         extraido = CASE WHEN p_status = 'pronto' THEN COALESCE(p_extraido, '{}'::jsonb) ELSE extraido END,
         erro = CASE WHEN p_status = 'falhou' THEN p_erro ELSE NULL END,
         atualizado_em = now()
   WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public._registro_gravar_organizacao(uuid, text, text, text, jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._registro_gravar_organizacao(uuid, text, text, text, jsonb, text) TO service_role;
