-- Conserta o schema drift de portal_entregas (colunas de versão/arquivo foram
-- dropadas em 028_sync_remote_changes.sql, deixando o frontend quebrado) e
-- adiciona o que falta pra "aprovar entrega" virar um termo auditável:
-- ligação real com a disciplina (substitui o campo texto livre que foi
-- dropado) e IP/user-agent de quem aprovou, no mesmo padrão já usado em
-- get_portal_entrega_download_url (025_hardening_enterprise.sql).

ALTER TABLE public.portal_entregas
  ADD COLUMN projeto_disciplina_id uuid REFERENCES public.projeto_disciplinas(id) ON DELETE SET NULL,
  ADD COLUMN aprovado_ip inet,
  ADD COLUMN aprovado_user_agent text;

CREATE INDEX IF NOT EXISTS idx_portal_entregas_disciplina
  ON public.portal_entregas (projeto_disciplina_id);

CREATE OR REPLACE FUNCTION public.portal_aprovar_entrega(p_token TEXT, p_entrega_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session JSON;
  v_cliente_id UUID;
  v_ok BOOLEAN;
  v_ip TEXT;
  v_ua TEXT;
BEGIN
  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente_id := (v_session->>'cliente_id')::uuid;

  BEGIN
    v_ip := current_setting('request.headers', true)::json->>'x-real-ip';
    v_ua := current_setting('request.headers', true)::json->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
    v_ua := NULL;
  END;

  UPDATE portal_entregas e
  SET status = 'aprovado',
      respondido_em = NOW(),
      aprovado_ip = v_ip,
      aprovado_user_agent = v_ua
  FROM projetos p
  WHERE e.id = p_entrega_id
    AND p.id = e.projeto_id
    AND p.cliente_id = v_cliente_id
    AND e.status = 'pendente';

  GET DIAGNOSTICS v_ok = ROW_COUNT;
  IF v_ok = 0 THEN
    RAISE EXCEPTION 'Entregável não encontrado, já respondido, ou fora do seu acesso';
  END IF;
END;
$$;

-- SETOF portal_entregas não deixa trazer coluna de fora da tabela (nome da
-- disciplina); troca pra TABLE explícita com o mesmo conjunto de colunas +
-- o join. Assinatura de chamada (p_token, p_projeto_id) não muda.
DROP FUNCTION IF EXISTS public.portal_listar_entregas(TEXT, UUID);
CREATE OR REPLACE FUNCTION public.portal_listar_entregas(p_token TEXT, p_projeto_id UUID)
RETURNS TABLE (
  id uuid,
  empresa_id uuid,
  projeto_id uuid,
  titulo text,
  descricao text,
  tipo text,
  status text,
  drive_url text,
  projeto_disciplina_id uuid,
  disciplina_nome text,
  resposta_cliente text,
  respondido_em timestamptz,
  aprovado_ip inet,
  aprovado_user_agent text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session JSON;
  v_cliente_id UUID;
BEGIN
  v_session := portal_verify_session_readonly(p_token);
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  v_cliente_id := (v_session->>'cliente_id')::uuid;

  RETURN QUERY
  SELECT
    e.id, e.empresa_id, e.projeto_id, e.titulo, e.descricao, e.tipo, e.status, e.drive_url,
    e.projeto_disciplina_id, pd.nome AS disciplina_nome, e.resposta_cliente, e.respondido_em,
    e.aprovado_ip, e.aprovado_user_agent, e.created_by, e.created_at, e.updated_at
  FROM portal_entregas e
  JOIN projetos p ON p.id = e.projeto_id
  LEFT JOIN projeto_disciplinas pd ON pd.id = e.projeto_disciplina_id
  WHERE e.projeto_id = p_projeto_id
    AND p.cliente_id = v_cliente_id
  ORDER BY e.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_aprovar_entrega(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_aprovar_entrega(TEXT, UUID) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.portal_listar_entregas(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_listar_entregas(TEXT, UUID) TO anon, authenticated, service_role;
