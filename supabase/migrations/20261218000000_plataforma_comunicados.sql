-- Comunicados da plataforma (SPEC 157): o ultra admin avisa os escritórios dentro do app, em
-- faixa (topo do conteúdo) ou modal (abre uma vez), para todos ou para um público: um plano, um
-- escritório, só administradores. Antes ia por WhatsApp, um a um.
--
-- O usuário lê pela RPC comunicados_para_mim (só os ativos, do seu público, que ele não
-- dispensou) e dispensa por dispensar_comunicado. As tabelas abrem só para o ultra admin.

CREATE TABLE IF NOT EXISTS public.plataforma_comunicados (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 120),
  mensagem      text NOT NULL CHECK (length(trim(mensagem)) BETWEEN 1 AND 600),
  formato       text NOT NULL DEFAULT 'faixa' CHECK (formato IN ('faixa', 'modal')),
  link_url      text CHECK (link_url IS NULL OR link_url ~ '^(/|https://)'),
  link_rotulo   text CHECK (link_rotulo IS NULL OR length(link_rotulo) <= 40),
  -- Público: nulo = todos. Os filtros somam (plano E escritório E papel).
  plano_slug    text,
  empresa_id    uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  so_admins     boolean NOT NULL DEFAULT false,
  inicio        timestamptz NOT NULL DEFAULT now(),
  fim           timestamptz,
  encerrado_em  timestamptz,
  created_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plataforma_comunicados_fim CHECK (fim IS NULL OR fim > inicio)
);

COMMENT ON TABLE public.plataforma_comunicados IS
  'Comunicados do ultra admin para os escritórios, em faixa ou modal (SPEC 157).';

CREATE INDEX IF NOT EXISTS idx_plataforma_comunicados_inicio ON public.plataforma_comunicados (inicio DESC);
CREATE INDEX IF NOT EXISTS idx_plataforma_comunicados_empresa_id ON public.plataforma_comunicados (empresa_id);
CREATE INDEX IF NOT EXISTS idx_plataforma_comunicados_created_by ON public.plataforma_comunicados (created_by);

CREATE TABLE IF NOT EXISTS public.plataforma_comunicados_dispensas (
  comunicado_id uuid NOT NULL REFERENCES public.plataforma_comunicados(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dispensado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comunicado_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_plataforma_comunicados_dispensas_user ON public.plataforma_comunicados_dispensas (user_id);

ALTER TABLE public.plataforma_comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plataforma_comunicados_dispensas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plataforma_comunicados FROM anon;
REVOKE ALL ON public.plataforma_comunicados_dispensas FROM anon, authenticated;

DROP POLICY IF EXISTS "Comunicados ultra admin" ON public.plataforma_comunicados;
CREATE POLICY "Comunicados ultra admin" ON public.plataforma_comunicados
  FOR ALL TO authenticated
  USING ((SELECT public.is_ultra_admin()))
  WITH CHECK ((SELECT public.is_ultra_admin()));

-- Dispensas: sem acesso direto (nenhuma policy, grants revogados). Só pelas RPCs.

CREATE OR REPLACE FUNCTION public.comunicados_para_mim()
RETURNS TABLE (
  id uuid, titulo text, mensagem text, formato text, link_url text, link_rotulo text, inicio timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_empresa uuid;
  v_role    text;
  v_plano   text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT p.empresa_id, p.role INTO v_empresa, v_role FROM public.profiles p WHERE p.id = v_uid;
  SELECT sp.slug INTO v_plano
  FROM public.pilar_subscriptions s
  JOIN public.pilar_subscription_plans sp ON sp.id = s.plan_id
  WHERE s.empresa_id = v_empresa
  LIMIT 1;

  RETURN QUERY
  SELECT c.id, c.titulo, c.mensagem, c.formato, c.link_url, c.link_rotulo, c.inicio
  FROM public.plataforma_comunicados c
  WHERE c.encerrado_em IS NULL
    AND c.inicio <= now()
    AND (c.fim IS NULL OR c.fim > now())
    AND (c.empresa_id IS NULL OR c.empresa_id = v_empresa)
    AND (c.plano_slug IS NULL OR c.plano_slug = v_plano)
    AND (NOT c.so_admins OR v_role IN ('admin', 'ultra_admin'))
    AND NOT EXISTS (
      SELECT 1 FROM public.plataforma_comunicados_dispensas d
      WHERE d.comunicado_id = c.id AND d.user_id = v_uid
    )
  ORDER BY c.inicio DESC
  LIMIT 5;
END;
$$;

COMMENT ON FUNCTION public.comunicados_para_mim() IS
  'Comunicados ativos do público do usuário logado que ele não dispensou (SPEC 157).';
REVOKE ALL ON FUNCTION public.comunicados_para_mim() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comunicados_para_mim() TO authenticated;

CREATE OR REPLACE FUNCTION public.dispensar_comunicado(p_comunicado_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.plataforma_comunicados_dispensas (comunicado_id, user_id)
  SELECT c.id, auth.uid() FROM public.plataforma_comunicados c WHERE c.id = p_comunicado_id
  ON CONFLICT DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.dispensar_comunicado(uuid) IS
  'O usuário logado dispensa um comunicado; ele não volta (SPEC 157).';
REVOKE ALL ON FUNCTION public.dispensar_comunicado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispensar_comunicado(uuid) TO authenticated;
