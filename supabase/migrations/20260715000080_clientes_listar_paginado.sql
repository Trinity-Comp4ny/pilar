-- Paginação server-side da lista de Clientes.
--
-- Antes a lista carregava TODOS os clientes da empresa em memória e filtrava/
-- ordenava no navegador. Com muitas linhas isso fica caro e trava a UI. Esta RPC
-- move filtros, ordenação e paginação para o servidor e devolve o total do
-- conjunto filtrado (via count(*) OVER()) para alimentar a paginação.
--
-- Escopo por empresa: SECURITY INVOKER, então as policies RLS de clientes,
-- projetos e cliente_portal_accounts continuam valendo com o auth.uid() do
-- chamador. O filtro explícito empresa_id = my_empresa_id() é defesa em
-- profundidade e ajuda o planner a usar os índices por empresa.

BEGIN;

-- Índice para o filtro "com/sem projeto" (EXISTS por cliente_id, só ativos).
-- projetos já tinha índice por empresa_id, mas não por cliente_id.
CREATE INDEX IF NOT EXISTS "idx_projetos_cliente_ativo"
  ON "public"."projetos" ("cliente_id")
  WHERE "deleted_at" IS NULL;

-- Índice para ordenação por data de cadastro, escopada por empresa e só ativos.
CREATE INDEX IF NOT EXISTS "idx_clientes_empresa_created"
  ON "public"."clientes" ("empresa_id", "created_at")
  WHERE "deleted_at" IS NULL;

-- A busca por nome usa ILIKE '%termo%' e se apoia no índice trgm já existente
-- (idx_clientes_nome_trgm). Nada a criar aqui para isso.

DROP FUNCTION IF EXISTS public.listar_clientes_paginado(
  text, text, text, boolean, boolean, text, text, integer, integer
);

CREATE OR REPLACE FUNCTION public.listar_clientes_paginado(
  p_search        text    DEFAULT NULL,
  p_origem        text    DEFAULT NULL,
  p_tipo_pessoa   text    DEFAULT NULL,   -- 'PF' | 'PJ' | NULL (todos)
  p_tem_portal    boolean DEFAULT NULL,   -- true=com, false=sem, NULL=todos
  p_com_projeto   boolean DEFAULT NULL,   -- true=com, false=sem, NULL=todos
  p_sort_field    text    DEFAULT 'nome', -- 'nome' | 'cpf_cnpj' | 'created_at'
  p_sort_dir      text    DEFAULT 'asc',  -- 'asc' | 'desc'
  p_limit         integer DEFAULT 20,
  p_offset        integer DEFAULT 0
)
RETURNS TABLE (
  id               uuid,
  nome             text,
  sobrenome        text,
  tipo_pessoa      text,
  cpf_cnpj         text,
  endereco         text,
  contato          text,
  email            text,
  tipo_nf          text,
  origem           text,
  contas_bancarias jsonb,
  chaves_pix       jsonb,
  created_at       timestamptz,
  total_count      bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa   uuid    := public.my_empresa_id();
  v_search    text    := btrim(coalesce(p_search, ''));
  v_like      text;
  v_digits    text    := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
  v_limit     integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset    integer := greatest(coalesce(p_offset, 0), 0);
  v_order_by  text;
  v_dir       text;
BEGIN
  -- Monta o padrão ILIKE escapando os curingas do LIKE (\ % _) para que o texto
  -- digitado seja tratado como literal.
  v_like := '%' ||
            replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') ||
            '%';

  -- Ordenação por lista branca. NUNCA interpola entrada crua: p_sort_field só
  -- pode virar uma das três expressões abaixo. Nome é normalizado (minúsculo e
  -- sem acento) para aproximar o localeCompare pt-BR com sensitivity base.
  v_order_by := CASE p_sort_field
    WHEN 'cpf_cnpj'   THEN 'c.cpf_cnpj'
    WHEN 'created_at' THEN 'c.created_at'
    ELSE 'lower(translate(coalesce(c.nome, '''') || '' '' || coalesce(c.sobrenome, ''''), '
         || '''áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ'', '
         || '''aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC''))'
  END;

  v_dir := CASE WHEN lower(coalesce(p_sort_dir, 'asc')) = 'desc' THEN 'DESC' ELSE 'ASC' END;

  RETURN QUERY EXECUTE format($f$
    SELECT
      c.id, c.nome, c.sobrenome, c.tipo_pessoa, c.cpf_cnpj, c.endereco,
      c.contato, c.email, c.tipo_nf, c.origem, c.contas_bancarias, c.chaves_pix,
      c.created_at,
      count(*) OVER() AS total_count
    FROM public.clientes c
    WHERE c.deleted_at IS NULL
      AND c.empresa_id = $1
      AND (
        $2 = ''
        OR c.nome ILIKE $3 ESCAPE '\'
        OR (coalesce(c.nome, '') || ' ' || coalesce(c.sobrenome, '')) ILIKE $3 ESCAPE '\'
        OR c.email ILIKE $3 ESCAPE '\'
        OR ($4 <> '' AND c.cpf_cnpj ILIKE '%%' || $4 || '%%')
      )
      AND ($5 IS NULL OR c.origem = $5)
      AND (
        $6 IS NULL OR (
          CASE
            WHEN c.tipo_pessoa IN ('PF', 'PJ') THEN c.tipo_pessoa
            WHEN length(regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g')) = 14 THEN 'PJ'
            WHEN length(regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g')) = 11 THEN 'PF'
            ELSE NULL
          END
        ) = $6
      )
      AND (
        $7 IS NULL OR ($7 = true) = EXISTS (
          SELECT 1 FROM public.cliente_portal_accounts pa
          WHERE pa.cliente_id = c.id AND pa.ativo = true
        )
      )
      AND (
        $8 IS NULL OR ($8 = true) = EXISTS (
          SELECT 1 FROM public.projetos pr
          WHERE pr.cliente_id = c.id AND pr.deleted_at IS NULL
        )
      )
    ORDER BY %s %s NULLS LAST, c.id ASC
    LIMIT $9 OFFSET $10
  $f$, v_order_by, v_dir)
  USING v_empresa, v_search, v_like, v_digits,
        p_origem, p_tipo_pessoa, p_tem_portal, p_com_projeto,
        v_limit, v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_clientes_paginado(
  text, text, text, boolean, boolean, text, text, integer, integer
) TO authenticated;

-- Origens distintas para popular o filtro sem baixar todos os clientes.
-- Antes o dropdown de origem era derivado da lista inteira em memória; com a
-- paginação server-side esse conjunto passa a vir de uma consulta enxuta.
CREATE OR REPLACE FUNCTION public.listar_origens_clientes()
RETURNS TABLE (origem text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT c.origem
  FROM public.clientes c
  WHERE c.deleted_at IS NULL
    AND c.empresa_id = public.my_empresa_id()
    AND c.origem IS NOT NULL
    AND btrim(c.origem) <> ''
  ORDER BY c.origem;
$$;

GRANT EXECUTE ON FUNCTION public.listar_origens_clientes() TO authenticated;

COMMIT;
