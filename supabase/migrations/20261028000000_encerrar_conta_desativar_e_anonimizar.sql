-- SPEC 116: encerrar conta sem apagar o usuário.
--
-- Apagar em auth.users falha para quem criou qualquer registro (~55 colunas de autoria
-- sem ON DELETE) e, quando passa, o CASCADE leva o aceite dos termos e o próprio pedido
-- LGPD. Encerrar passa a ser: bloquear no Auth (edge) + marcar o perfil desativado aqui.

-- 1. Perfil desativado: some de equipe, vagas e avisos; o nome segue nos registros.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS desativado_em timestamptz;

COMMENT ON COLUMN public.profiles.desativado_em IS
  'SPEC 116: conta encerrada (membro removido ou exclusão LGPD). Login bloqueado no Auth; não conta vaga nem aparece em listas.';

-- 2. Token ainda válido de conta desativada não lê dado: 222 das 260 policies passam
--    por aqui, então devolver NULL recusa tudo sem esperar o token expirar.
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid() AND desativado_em IS NULL LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_empresa_id_text()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT empresa_id::text FROM public.profiles WHERE id = auth.uid() AND desativado_em IS NULL LIMIT 1;
$$;

-- 3. Pedido de exclusão que falhou ao executar fica registrado como tal.
ALTER TABLE public.data_deletion_requests DROP CONSTRAINT IF EXISTS data_deletion_requests_status_check;
ALTER TABLE public.data_deletion_requests ADD CONSTRAINT data_deletion_requests_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'failed'));

-- 4. Fila do ultra admin: pedidos com prazo (LGPD art. 19, 15 dias) e o bloqueio de
--    único admin já calculado. Abertos primeiro, do mais antigo para o mais novo.
CREATE OR REPLACE FUNCTION public.ultra_admin_listar_pedidos_exclusao()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  titular_nome text,
  titular_email text,
  empresa_id uuid,
  empresa_nome text,
  motivo text,
  status text,
  requested_at timestamptz,
  prazo_em timestamptz,
  processed_at timestamptz,
  notes text,
  unico_admin boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_ultra_admin() THEN
    RAISE EXCEPTION 'Só ultra_admin pode listar pedidos de exclusão' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    p.nome,
    p.email,
    r.empresa_id,
    e.nome,
    r.motivo,
    r.status,
    r.requested_at,
    r.requested_at + interval '15 days',
    r.processed_at,
    r.notes,
    COALESCE(
      p.role::text IN ('admin', 'owner')
      AND p.desativado_em IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles o
        WHERE o.empresa_id = p.empresa_id
          AND o.id <> p.id
          AND o.role::text IN ('admin', 'owner')
          AND o.desativado_em IS NULL
      ),
      false
    )
  FROM public.data_deletion_requests r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN public.empresas e ON e.id = r.empresa_id
  ORDER BY (r.status IN ('pending', 'in_progress', 'failed')) DESC, r.requested_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.ultra_admin_listar_pedidos_exclusao() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ultra_admin_listar_pedidos_exclusao() TO authenticated;

COMMENT ON FUNCTION public.ultra_admin_listar_pedidos_exclusao() IS
  'SPEC 116: fila de pedidos de exclusão LGPD para o ultra admin, com prazo de 15 dias e bloqueio de único admin. Só ultra_admin executa.';
