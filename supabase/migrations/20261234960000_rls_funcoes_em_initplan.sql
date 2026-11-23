-- Performance: funções STABLE sem argumento usadas nas políticas RLS (get_user_empresa_id,
-- can_view_financeiro, is_ultra_admin...) rodavam uma vez por LINHA avaliada. Embrulhadas em
-- (SELECT fn()), o Postgres as avalia uma vez por query (initplan), como já é feito com auth.uid().
-- Semântica idêntica: a função não depende da linha. ALTER POLICY mantém roles e comando.
-- Idempotente: política já embrulhada não muda e é pulada.
DO $$
DECLARE
  rx text;
  r record;
  nq text;
  nw text;
  alterar text;
BEGIN
  SELECT string_agg(p.proname, '|') INTO rx
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
  WHERE p.pronargs = 0 AND p.provolatile = 's' AND p.prokind = 'f'
    AND p.prorettype NOT IN ('trigger'::regtype, 'void'::regtype);

  IF rx IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    -- 1) protege o que já está embrulhado; 2) embrulha o resto; 3) restaura o protegido.
    nq := r.qual;
    nw := r.with_check;
    IF nq IS NOT NULL THEN
      nq := regexp_replace(
              regexp_replace(
                regexp_replace(nq, 'SELECT (public\.)?(' || rx || ')\(\)', 'SELECT @@\2@@', 'g'),
                '(public\.)?\m(' || rx || ')\(\)', '(SELECT \2())', 'g'),
              '@@([a-z_0-9]+)@@', '\1()', 'g');
    END IF;
    IF nw IS NOT NULL THEN
      nw := regexp_replace(
              regexp_replace(
                regexp_replace(nw, 'SELECT (public\.)?(' || rx || ')\(\)', 'SELECT @@\2@@', 'g'),
                '(public\.)?\m(' || rx || ')\(\)', '(SELECT \2())', 'g'),
              '@@([a-z_0-9]+)@@', '\1()', 'g');
    END IF;

    IF nq IS NOT DISTINCT FROM r.qual AND nw IS NOT DISTINCT FROM r.with_check THEN
      CONTINUE;
    END IF;

    alterar := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF nq IS NOT NULL THEN
      alterar := alterar || ' USING (' || nq || ')';
    END IF;
    IF nw IS NOT NULL THEN
      alterar := alterar || ' WITH CHECK (' || nw || ')';
    END IF;
    EXECUTE alterar;
  END LOOP;
END
$$;
