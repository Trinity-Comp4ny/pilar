-- ============================================================================
-- SPEC 095 / ADR 0039, fase 2: registro de envio e supressão de destinatário.
--
-- Hoje o único rastro de um e-mail é o Sentry quando o envio falha: não há como
-- responder "o cliente recebeu a cobrança?" nem detectar bounce. Duas tabelas
-- resolvem isso, escritas SEMPRE por service role (o módulo `_shared/email/`):
--
--   email_envios     append-only, 1 linha por e-mail, com status de entrega que o
--                    webhook do Resend atualiza depois.
--   email_supressoes endereço que quicou ou reclamou. O client recusa enviar para
--                    quem está aqui, então um endereço morto não queima a
--                    reputação do domínio duas vezes.
--
-- Leitura: admin vê os e-mails da PRÓPRIA empresa; ultra_admin vê tudo.
-- `email_supressoes` é global (não tem empresa_id), então só ultra_admin lê: o
-- admin descobre que um endereço está suprimido pelo status na própria linha de
-- email_envios, sem enxergar endereço de outra empresa.
-- ============================================================================

-- =============================================
-- 1. email_envios
-- =============================================

CREATE TABLE IF NOT EXISTS public.email_envios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nulo é legítimo: recuperação de senha acontece antes de haver empresa.
  empresa_id      uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  classe          text NOT NULL CHECK (classe IN ('plataforma', 'escritorio')),
  -- Identificador do template (auth_recovery, cobranca_lembrete, notificacao_semanal...).
  tipo            text NOT NULL,
  destinatario    text NOT NULL,
  assunto         text NOT NULL,
  -- id do Resend: chega na resposta do envio e é a chave que o webhook usa.
  resend_id       text,
  status          text NOT NULL CHECK (status IN (
                    'enviando', 'enviado', 'falhou', 'entregue', 'atrasado',
                    'bounce', 'reclamacao', 'suprimido', 'dry_run'
                  )),
  erro            text,
  referencia_tipo text,
  referencia_id   uuid,
  idempotency_key text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_email_envios_updated_at
  BEFORE UPDATE ON public.email_envios
  FOR EACH ROW EXECUTE FUNCTION public.tg_pilar_touch_updated_at();

-- O webhook chega pelo resend_id; único (parcial) para o UPDATE ser determinístico.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_envios_resend_id
  ON public.email_envios (resend_id) WHERE resend_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_envios_empresa_data
  ON public.email_envios (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_envios_destinatario
  ON public.email_envios (lower(destinatario), created_at DESC);

REVOKE ALL ON TABLE public.email_envios FROM anon;

COMMENT ON TABLE public.email_envios IS
  'Registro append-only de todo e-mail que sai pelo módulo _shared/email/ (ADR 0039). Escrito só por service role.';

-- =============================================
-- 2. email_supressoes
-- =============================================

CREATE TABLE IF NOT EXISTS public.email_supressoes (
  email      text PRIMARY KEY,
  motivo     text NOT NULL CHECK (motivo IN ('bounce', 'reclamacao', 'manual')),
  detalhe    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.email_supressoes FROM anon;

COMMENT ON TABLE public.email_supressoes IS
  'Endereços que não recebem mais e-mail (bounce duro ou reclamação de spam). Global e sem empresa_id: leitura só de ultra_admin.';

-- =============================================
-- 3. RLS
--    Nenhuma policy de INSERT/UPDATE/DELETE: escrita é exclusiva de service_role,
--    que ignora RLS. Sem policy, `authenticated` não escreve nem por engano.
-- =============================================

ALTER TABLE public.email_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_envios_select" ON public.email_envios;
CREATE POLICY "email_envios_select" ON public.email_envios
  FOR SELECT USING (
    public.is_ultra_admin()
    OR (
      empresa_id IS NOT NULL
      AND empresa_id = public.get_user_empresa_id()
      AND public.has_role('admin')
    )
  );

ALTER TABLE public.email_supressoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_supressoes_select" ON public.email_supressoes;
CREATE POLICY "email_supressoes_select" ON public.email_supressoes
  FOR SELECT USING (public.is_ultra_admin());
