-- SPEC 059 / ADR 0032: consentimento de cookies deixa de ser estado de
-- navegador e passa a ser preferência da conta.
--
-- Append-only, mesmo padrão de terms_acceptances (SPEC 049): cada mudança de
-- opinião é uma linha nova e a mais recente vence. O histórico é o que permite
-- demonstrar consentimento e revogação (LGPD Art. 8º, §1º), então nada de
-- UPDATE/DELETE para authenticated.
--
-- Sem empresa_id de propósito: a decisão sobre ser rastreado é do titular, não
-- da empresa. Usuário que troca de empresa leva a própria preferência.

CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analytics BOOLEAN NOT NULL,
  -- 'carryover': decisão tomada na landing (cookie de .pilarsoft.com.br) que
  -- vira o registro inicial da conta no primeiro login.
  -- 'settings': toggle em Configurações → Privacidade.
  source TEXT NOT NULL CHECK (source IN ('carryover', 'settings')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Leitura sempre é "a mais recente deste usuário": índice já na ordem do ORDER BY.
CREATE INDEX IF NOT EXISTS cookie_consents_user_recent_idx
  ON public.cookie_consents(user_id, created_at DESC);

ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cookie Consents Insert Own" ON public.cookie_consents;
CREATE POLICY "Cookie Consents Insert Own" ON public.cookie_consents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Cookie Consents Select Own" ON public.cookie_consents;
CREATE POLICY "Cookie Consents Select Own" ON public.cookie_consents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Sem policy de UPDATE/DELETE: registro imutável. Revogar é inserir uma linha
-- nova com analytics = false, não apagar a anterior.

REVOKE ALL ON public.cookie_consents FROM anon;
GRANT SELECT, INSERT ON public.cookie_consents TO authenticated;
