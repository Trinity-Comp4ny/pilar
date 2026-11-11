-- Novidades do produto (SPEC 152): "O que mudou" no aviso de nova versão e "Você pediu, entregamos".
--
-- Três tabelas da plataforma (sem empresa_id: a release é a mesma para todos os escritórios):
--   1. product_releases       — uma por deploy em produção (sha do commit de main) ou criada à mão
--                               no Ultra admin. Rascunho até `publicada_em`.
--   2. product_release_itens  — o que mudou, em texto para o cliente, com impacto (fluxo/melhoria/
--                               correcao), módulo opcional e os feedbacks que originaram o item.
--   3. product_release_vistas — até quando cada usuário já viu as novidades (vale em qualquer
--                               dispositivo; a SPEC 038 guardava no localStorage).
--
-- Quem lê o quê:
--   - As tabelas só abrem para o ultra admin (revisar, editar, publicar). O rascunho é escrito pela
--     edge `release-rascunho` com service_role.
--   - O usuário lê pelas RPCs `novidades_publicadas` / `marcar_novidades_vistas`: só release
--     publicada, sem expor os ids de feedback, com o selo "você pediu" calculado para quem chama.
--   - `publicar_release` (ultra admin) grava a publicação e avisa no sino cada autor de feedback
--     ligado a um item. Publicar de novo não faz nada, então o aviso não duplica.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_releases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Commit de main que foi para produção. Nulo quando a release é criada à mão.
  sha           text UNIQUE CHECK (sha IS NULL OR sha ~ '^[0-9a-f]{7,40}$'),
  titulo        text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 120),
  versao        text CHECK (versao IS NULL OR length(versao) <= 20),
  criada_em     timestamptz NOT NULL DEFAULT now(),
  publicada_em  timestamptz,
  publicada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.product_releases IS
  'Releases do produto mostradas ao usuário em Novidades (SPEC 152). Rascunho até publicada_em.';

CREATE INDEX IF NOT EXISTS idx_product_releases_publicada_em
  ON public.product_releases (publicada_em DESC) WHERE publicada_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_releases_publicada_por
  ON public.product_releases (publicada_por);

CREATE TABLE IF NOT EXISTS public.product_release_itens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id   uuid NOT NULL REFERENCES public.product_releases(id) ON DELETE CASCADE,
  texto        text NOT NULL CHECK (length(trim(texto)) BETWEEN 1 AND 300),
  impacto      text NOT NULL CHECK (impacto IN ('fluxo', 'melhoria', 'correcao')),
  -- Chave do módulo (src/lib/modules.ts). Nulo = vale para todos.
  modulo       text CHECK (modulo IS NULL OR modulo ~ '^[a-z][a-z0-9_-]{0,39}$'),
  feedback_ids uuid[] NOT NULL DEFAULT '{}',
  commit_sha   text CHECK (commit_sha IS NULL OR commit_sha ~ '^[0-9a-f]{7,40}$'),
  ordem        integer NOT NULL DEFAULT 0,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_release_itens IS
  'Itens de uma release (SPEC 152): texto para o cliente, impacto e feedbacks que originaram o item.';

CREATE INDEX IF NOT EXISTS idx_product_release_itens_release
  ON public.product_release_itens (release_id, ordem);

CREATE TABLE IF NOT EXISTS public.product_release_vistas (
  user_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Releases publicadas até este instante já foram vistas.
  visto_ate timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_release_vistas IS
  'Até quando o usuário já viu as novidades do produto (SPEC 152).';

-- ---------------------------------------------------------------------------
-- 2. RLS: tabelas só para o ultra admin; o usuário passa pelas RPCs abaixo.
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_release_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_release_vistas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.product_releases FROM anon;
REVOKE ALL ON public.product_release_itens FROM anon;
REVOKE ALL ON public.product_release_vistas FROM anon, authenticated;

DROP POLICY IF EXISTS "Product releases ultra admin" ON public.product_releases;
CREATE POLICY "Product releases ultra admin" ON public.product_releases
  FOR ALL TO authenticated
  USING ((SELECT public.is_ultra_admin()))
  WITH CHECK ((SELECT public.is_ultra_admin()));

DROP POLICY IF EXISTS "Product release itens ultra admin" ON public.product_release_itens;
CREATE POLICY "Product release itens ultra admin" ON public.product_release_itens
  FOR ALL TO authenticated
  USING ((SELECT public.is_ultra_admin()))
  WITH CHECK ((SELECT public.is_ultra_admin()));

-- Publicação só pela RPC (grava quem publicou e dispara o aviso de "você pediu"): editar
-- publicada_em/publicada_por direto, mesmo como ultra admin, publicaria sem avisar ninguém.
-- A RPC liga a flag da transação; fora dela o trigger recusa.
CREATE OR REPLACE FUNCTION public._product_release_guarda_publicacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(current_setting('pilar.publicando_release', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND (NEW.publicada_em IS NOT NULL OR NEW.publicada_por IS NOT NULL) THEN
    RAISE EXCEPTION 'release nasce rascunho; publique por publicar_release' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.publicada_em IS DISTINCT FROM OLD.publicada_em
                           OR NEW.publicada_por IS DISTINCT FROM OLD.publicada_por) THEN
    RAISE EXCEPTION 'publicação só por publicar_release' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._product_release_guarda_publicacao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_product_release_guarda_publicacao ON public.product_releases;
CREATE TRIGGER trg_product_release_guarda_publicacao
  BEFORE INSERT OR UPDATE ON public.product_releases
  FOR EACH ROW EXECUTE FUNCTION public._product_release_guarda_publicacao();

-- Vistas: sem acesso direto (nenhuma policy, grants revogados). Escrita só pela RPC.

-- ---------------------------------------------------------------------------
-- 3. novidades_publicadas(): o que o usuário logado vê em Novidades.
--    Últimas 30 releases publicadas, itens em ordem, `nova` = publicada depois do que ele já viu
--    (ou, sem registro, depois de ele ter entrado no Pilar: conta nova não recebe o histórico como
--    novidade) e `voce_pediu` = algum feedback do item foi enviado por ele.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.novidades_publicadas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_corte timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(
    (SELECT v.visto_ate FROM public.product_release_vistas v WHERE v.user_id = v_uid),
    (SELECT p.created_at FROM public.profiles p WHERE p.id = v_uid),
    now()
  ) INTO v_corte;

  RETURN jsonb_build_object(
    'visto_ate', v_corte,
    'releases', coalesce((
      SELECT jsonb_agg(r.obj ORDER BY r.publicada_em DESC)
      FROM (
        SELECT
          pr.publicada_em,
          jsonb_build_object(
            'id', pr.id,
            'sha', pr.sha,
            'titulo', pr.titulo,
            'versao', pr.versao,
            'publicada_em', pr.publicada_em,
            'nova', pr.publicada_em > v_corte,
            'itens', coalesce((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', i.id,
                  'texto', i.texto,
                  'impacto', i.impacto,
                  'modulo', i.modulo,
                  'voce_pediu', EXISTS (
                    SELECT 1 FROM public.feature_suggestions fs
                    WHERE fs.id = ANY (i.feedback_ids) AND fs.created_by = v_uid
                  )
                )
                ORDER BY i.ordem, i.criado_em
              )
              FROM public.product_release_itens i
              WHERE i.release_id = pr.id
            ), '[]'::jsonb)
          ) AS obj
        FROM public.product_releases pr
        WHERE pr.publicada_em IS NOT NULL
        ORDER BY pr.publicada_em DESC
        LIMIT 30
      ) r
    ), '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.novidades_publicadas() IS
  'Releases publicadas para o usuário logado, com nova/voce_pediu calculados (SPEC 152).';

REVOKE ALL ON FUNCTION public.novidades_publicadas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.novidades_publicadas() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. marcar_novidades_vistas(): o usuário leu as novidades (abriu o modal ou a página).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marcar_novidades_vistas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.product_release_vistas (user_id, visto_ate)
  VALUES (v_uid, now())
  ON CONFLICT (user_id) DO UPDATE SET visto_ate = EXCLUDED.visto_ate;
END;
$$;

COMMENT ON FUNCTION public.marcar_novidades_vistas() IS
  'Marca as novidades publicadas até agora como vistas pelo usuário logado (SPEC 152).';

REVOKE ALL ON FUNCTION public.marcar_novidades_vistas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_novidades_vistas() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. publicar_release(): ultra admin publica e avisa quem pediu.
--    Devolve quantos avisos de "você pediu" saíram. Release já publicada devolve 0 e não muda.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publicar_release(p_release_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_publicou boolean;
  v_avisos   integer := 0;
  v_alvo     record;
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'apenas ultra admin publica release' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.product_release_itens WHERE release_id = p_release_id) THEN
    RAISE EXCEPTION 'release sem itens não pode ser publicada' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('pilar.publicando_release', 'on', true);
  UPDATE public.product_releases
  SET publicada_em = now(), publicada_por = auth.uid()
  WHERE id = p_release_id AND publicada_em IS NULL
  RETURNING true INTO v_publicou;

  PERFORM set_config('pilar.publicando_release', '', true);

  IF v_publicou IS NULL THEN
    RETURN 0;
  END IF;

  -- Um aviso por feedback ligado: o primeiro item que o cita dá o texto.
  FOR v_alvo IN
    SELECT DISTINCT ON (fs.id) fs.id, fs.empresa_id, fs.created_by, i.texto
    FROM public.product_release_itens i
    JOIN public.feature_suggestions fs ON fs.id = ANY (i.feedback_ids)
    WHERE i.release_id = p_release_id
      AND fs.empresa_id IS NOT NULL
    ORDER BY fs.id, i.ordem, i.criado_em
  LOOP
    v_avisos := v_avisos + public.notificar(
      v_alvo.empresa_id,
      ARRAY[v_alvo.created_by],
      'feedback_entregue',
      'sistema',
      'low',
      'O que você pediu chegou ao Pilar',
      v_alvo.texto,
      'feature_suggestion',
      v_alvo.id,
      '/novidades'
    );
  END LOOP;

  RETURN v_avisos;
END;
$$;

COMMENT ON FUNCTION public.publicar_release(uuid) IS
  'Publica a release (só ultra admin) e avisa no sino os autores dos feedbacks ligados (SPEC 152).';

REVOKE ALL ON FUNCTION public.publicar_release(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publicar_release(uuid) TO authenticated;

COMMIT;
