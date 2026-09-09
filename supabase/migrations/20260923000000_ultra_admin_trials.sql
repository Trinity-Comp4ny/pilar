-- SPEC 098, requisito 25: aba "Trials" no ultra-admin. Lista empresas
-- trialing com nível, fatos, uso e alerta de razão social divergente;
-- override de nível com motivo (auditado, quem/quando/porquê).
--
-- Fora desta migration (fica pra Fase 3, que introduz o estado "em leitura"
-- pós-trial e o log de recusa de signup por domínio, hoje só um RAISE
-- EXCEPTION sem registro persistido — não dá pra logar dentro da mesma
-- transação que vai sofrer ROLLBACK sem um mecanismo de transação autônoma,
-- que não vale o custo só por isso agora).

BEGIN;

CREATE OR REPLACE FUNCTION public.ultra_admin_listar_trials()
RETURNS TABLE (
  empresa_id           uuid,
  empresa_nome         text,
  nivel                text,
  nivel_override       text,
  nivel_override_motivo text,
  documento_tipo       text,
  documento_verificacao text,
  razao_social         text,
  razao_social_divergente boolean,
  trial_ends_at        timestamptz,
  dias_restantes       integer,
  projetos_ativos      integer,
  obras_ativas         integer,
  usuarios             integer,
  max_projetos         integer,
  max_obras            integer,
  max_usuarios         integer,
  tokens_gastos        bigint,
  tokens_total         bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Só ultra_admin pode listar trials' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.nome,
    public.nivel_confianca(e.id),
    e.nivel_override,
    e.nivel_override_motivo,
    e.documento_tipo,
    e.documento_verificacao,
    e.razao_social,
    (e.razao_social IS NOT NULL AND upper(trim(e.nome)) <> upper(trim(e.razao_social))),
    s.trial_ends_at,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (s.trial_ends_at - now())) / 86400))::integer,
    (SELECT count(*)::integer FROM public.projetos p
       WHERE p.empresa_id = e.id AND p.deleted_at IS NULL AND p.exemplo = false
         AND p.status NOT IN ('Concluído', 'Cancelado')),
    (SELECT count(*)::integer FROM public.obras o
       WHERE o.empresa_id = e.id AND o.deleted_at IS NULL AND o.status <> 'concluida'),
    (SELECT count(*)::integer FROM public.profiles p WHERE p.empresa_id = e.id),
    l.max_projetos,
    l.max_obras,
    l.max_usuarios,
    GREATEST(0, COALESCE(l.tokens_total, 0) - COALESCE(sd.saldo_plano, 0)),
    l.tokens_total
  FROM public.empresas e
  JOIN public.pilar_subscriptions s ON s.empresa_id = e.id
  LEFT JOIN public.ai_token_saldo sd ON sd.empresa_id = e.id
  CROSS JOIN LATERAL public.limites_empresa(e.id) l
  WHERE s.status = 'trialing'
  ORDER BY s.trial_ends_at ASC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.ultra_admin_listar_trials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ultra_admin_listar_trials() TO authenticated;

COMMENT ON FUNCTION public.ultra_admin_listar_trials() IS
  'SPEC 098: lista empresas trialing pro ultra-admin (nível, documento, uso, dias restantes). Só ultra_admin executa.';

-- =============================================
-- Override de nível com motivo auditado (spec 098, requisito 25 e 18).
-- p_nivel NULL remove o override (volta a derivar de fato: documento/bronze).
-- =============================================

CREATE OR REPLACE FUNCTION public.ultra_admin_definir_nivel_override(
  p_empresa_id uuid,
  p_nivel text,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Só ultra_admin pode alterar o nível de uma empresa' USING ERRCODE = '42501';
  END IF;

  IF p_nivel IS NOT NULL AND p_nivel NOT IN ('bronze', 'prata', 'ouro') THEN
    RAISE EXCEPTION 'Nível inválido' USING ERRCODE = '22023';
  END IF;

  IF p_nivel IS NOT NULL AND (p_motivo IS NULL OR trim(p_motivo) = '') THEN
    RAISE EXCEPTION 'Informe o motivo do override' USING ERRCODE = '22023';
  END IF;

  UPDATE public.empresas
  SET nivel_override = p_nivel,
      nivel_override_motivo = p_motivo,
      nivel_override_por = auth.uid(),
      nivel_override_em = now()
  WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ultra_admin_definir_nivel_override(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ultra_admin_definir_nivel_override(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.ultra_admin_definir_nivel_override(uuid, text, text) IS
  'SPEC 098: ultra-admin sobe/desce/limpa o nível de confiança de uma empresa, com motivo auditado. Só ultra_admin executa.';

COMMIT;
