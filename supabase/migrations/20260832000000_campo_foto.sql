-- Pilar Campo fase 3 (spec 042): foto do serviço. O campo tira foto e sobe via
-- edge campo-upload-foto (service_role, pois a conta de campo não tem auth.uid);
-- o escritório (autenticado) lê por URL assinada. Bucket privado, path começa
-- pelo empresa_id (multitenant no Storage, padrão do portal-entregas, 022).

-- 1. Bucket privado ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('obra-campo', 'obra-campo', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: o escritório (autenticado) enxerga/gerencia só as fotos da sua
-- empresa (1º segmento do path = empresa_id). O upload do campo é feito pela
-- edge com service_role, que ignora estas policies.
DROP POLICY IF EXISTS "campo_foto_storage_select" ON storage.objects;
CREATE POLICY "campo_foto_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'obra-campo' AND (storage.foldername(name))[1] = public.get_user_empresa_id_text());

DROP POLICY IF EXISTS "campo_foto_storage_insert" ON storage.objects;
CREATE POLICY "campo_foto_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'obra-campo' AND (storage.foldername(name))[1] = public.get_user_empresa_id_text());

DROP POLICY IF EXISTS "campo_foto_storage_delete" ON storage.objects;
CREATE POLICY "campo_foto_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'obra-campo' AND (storage.foldername(name))[1] = public.get_user_empresa_id_text());

-- 2. Metadados da foto (liga a foto ao dia do diário) --------------------------
CREATE TABLE IF NOT EXISTS public.obra_rdo_foto (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id          uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  rdo_id           uuid NOT NULL REFERENCES public.obra_rdo(id) ON DELETE CASCADE,
  path             text NOT NULL,
  campo_account_id uuid REFERENCES public.campo_accounts(id) ON DELETE SET NULL,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_rdo_foto_rdo ON public.obra_rdo_foto (rdo_id);
CREATE INDEX IF NOT EXISTS idx_obra_rdo_foto_obra ON public.obra_rdo_foto (obra_id);

ALTER TABLE public.obra_rdo_foto ENABLE ROW LEVEL SECURITY;

-- Escritório: só a própria empresa. Campo grava pela edge (service_role).
CREATE POLICY obra_rdo_foto_select ON public.obra_rdo_foto
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_rdo_foto_insert ON public.obra_rdo_foto
  FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY obra_rdo_foto_delete ON public.obra_rdo_foto
  FOR DELETE USING (empresa_id = public.get_user_empresa_id());

-- 3. Helper da edge (service_role): registra a foto após o upload -------------
CREATE OR REPLACE FUNCTION public._campo_registrar_foto(
  p_token text, p_rdo_id uuid, p_path text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc public.campo_accounts;
  v_rdo public.obra_rdo;
  v_id  uuid;
BEGIN
  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true AND token_expira_em > now()
  LIMIT 1;
  IF v_acc.id IS NULL OR v_acc.must_change_senha THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;

  -- O RDO tem que ser da obra do token (não anexar foto a obra de outro).
  SELECT * INTO v_rdo FROM public.obra_rdo WHERE id = p_rdo_id AND obra_id = v_acc.obra_id LIMIT 1;
  IF v_rdo.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Registro do dia inválido');
  END IF;

  INSERT INTO public.obra_rdo_foto (empresa_id, obra_id, rdo_id, path, campo_account_id)
  VALUES (v_acc.empresa_id, v_acc.obra_id, p_rdo_id, p_path, v_acc.id)
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'foto_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public._campo_registrar_foto(text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public._campo_registrar_foto(text, uuid, text) TO service_role;

-- 4. campo_listar_rdos passa a devolver a contagem de fotos por dia ------------
CREATE OR REPLACE FUNCTION public.campo_listar_rdos(p_token text, p_limite int DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_acc  public.campo_accounts;
  v_rows json;
BEGIN
  SELECT * INTO v_acc
  FROM public.campo_accounts
  WHERE token_sessao = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND ativo = true AND token_expira_em > now()
  LIMIT 1;
  IF v_acc.id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Sessão inválida');
  END IF;

  SELECT coalesce(json_agg(r ORDER BY r.data DESC), '[]'::json) INTO v_rows
  FROM (
    SELECT rd.id, rd.data, rd.clima, rd.condicao_trabalho, rd.efetivo,
           rd.atividades, rd.ocorrencias, rd.pendencias,
           (SELECT count(*) FROM public.obra_rdo_foto f WHERE f.rdo_id = rd.id) AS fotos
    FROM public.obra_rdo rd
    WHERE rd.obra_id = v_acc.obra_id
    ORDER BY rd.data DESC
    LIMIT greatest(1, least(p_limite, 90))
  ) r;

  RETURN json_build_object('ok', true, 'rdos', v_rows);
END;
$$;
