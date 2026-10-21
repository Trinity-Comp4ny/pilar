-- SPEC 128 (ADR 0061): o Pilar devolve à plataforma de marketing (repo post-automation) o
-- funil de cada link publicado, pela UTM gravada no cadastro.
--
-- A plataforma de marketing é produto próprio: campanhas, posts, vídeos e analytics vivem
-- lá. O Pilar não recebe métrica de rede social (o ops-ingest da ADR 0060 sai do plano);
-- só exporta, por dia de cadastro e por UTM, quantos cadastros, ativados e pagantes cada
-- link trouxe. `utm_content` é o id da distribuição na plataforma (ADR 0001 de lá).
--
-- Sem dado pessoal: nem nome, nem e-mail, nem empresa. Só contagem por UTM.
-- Interna: só o service role (Edge Function ops-export-funil, autenticada por token).

CREATE FUNCTION public._ops_funil_por_utm(p_desde date, p_ate date)
RETURNS TABLE (
  dia           date,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  cadastros     integer,
  ativados      integer,
  pagantes      integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH emp AS (
    SELECT e.id,
           (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           u.raw_user_meta_data -> 'origem' AS origem
    FROM public.empresas e
    LEFT JOIN auth.users u ON u.id = e.owner_id
    WHERE e.deleted_at IS NULL
      AND (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_desde AND p_ate
      -- A empresa da própria Pilar (a do ultra admin) não é cadastro de marketing.
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles pu WHERE pu.empresa_id = e.id AND pu.role = 'ultra_admin'
      )
  ),
  marcada AS (
    SELECT emp.*,
           EXISTS (
             SELECT 1 FROM public.projetos pr
             WHERE pr.empresa_id = emp.id AND pr.deleted_at IS NULL AND COALESCE(pr.exemplo, false) = false
           ) AS ativada,
           EXISTS (
             SELECT 1 FROM public.pilar_subscriptions s
             WHERE s.empresa_id = emp.id AND s.status = 'active' AND s.asaas_subscription_id IS NOT NULL
           ) AS pagante
    FROM emp
  )
  SELECT
    m.dia,
    COALESCE(NULLIF(m.origem ->> 'utm_source', ''), ''),
    COALESCE(NULLIF(m.origem ->> 'utm_medium', ''), ''),
    COALESCE(NULLIF(m.origem ->> 'utm_campaign', ''), ''),
    COALESCE(NULLIF(m.origem ->> 'utm_content', ''), ''),
    count(*)::integer,
    count(*) FILTER (WHERE m.ativada)::integer,
    count(*) FILTER (WHERE m.pagante)::integer
  FROM marcada m
  GROUP BY 1, 2, 3, 4, 5
  ORDER BY 1, 2, 3, 4, 5;
$$;

REVOKE ALL ON FUNCTION public._ops_funil_por_utm(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ops_funil_por_utm(date, date) TO service_role;

COMMENT ON FUNCTION public._ops_funil_por_utm(date, date) IS
  'SPEC 128: cadastros, ativados e pagantes por dia de cadastro (Brasília) e UTM, sem dado pessoal. Só a Edge Function ops-export-funil chama.';

-- Marketing deixa de ser agente do Ultra: vive na plataforma de marketing (ADR 0061).
UPDATE public.ops_agentes
   SET missao = 'Vive na plataforma de marketing (produto próprio): campanhas, posts, vídeos e analytics. O Pilar devolve o funil por UTM.',
       ativo = false,
       updated_at = now()
 WHERE id = 'marketing';
