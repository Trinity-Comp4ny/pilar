-- Manutenção programada (SPEC 153): o ultra admin avisa com antecedência, e o app mostra a
-- faixa 24 h antes e durante a janela. Mesmo modelo da status page (spec 055): leitura
-- pública (anon e authenticated, status é da plataforma inteira), escrita só ultra admin.
-- Cancelar é gravar cancelada_em; a linha fica como histórico.

CREATE TABLE IF NOT EXISTS public.status_manutencoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 120),
  mensagem     text CHECK (mensagem IS NULL OR length(mensagem) <= 500),
  inicio       timestamptz NOT NULL,
  fim          timestamptz NOT NULL,
  cancelada_em timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT status_manutencoes_fim_depois_do_inicio CHECK (fim > inicio)
);

COMMENT ON TABLE public.status_manutencoes IS
  'Manutenções programadas da plataforma, mostradas na faixa do app (SPEC 153).';

-- A faixa busca as que ainda não acabaram.
CREATE INDEX IF NOT EXISTS idx_status_manutencoes_fim ON public.status_manutencoes (fim);
CREATE INDEX IF NOT EXISTS idx_status_manutencoes_created_by ON public.status_manutencoes (created_by);

ALTER TABLE public.status_manutencoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Status Manutencoes Select Public" ON public.status_manutencoes;
CREATE POLICY "Status Manutencoes Select Public" ON public.status_manutencoes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Status Manutencoes Insert Ultra Admin" ON public.status_manutencoes;
CREATE POLICY "Status Manutencoes Insert Ultra Admin" ON public.status_manutencoes
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_ultra_admin()));

DROP POLICY IF EXISTS "Status Manutencoes Update Ultra Admin" ON public.status_manutencoes;
CREATE POLICY "Status Manutencoes Update Ultra Admin" ON public.status_manutencoes
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_ultra_admin()))
  WITH CHECK ((SELECT public.is_ultra_admin()));

-- Sem DELETE: cancelar é gravar cancelada_em.
REVOKE INSERT, UPDATE, DELETE ON public.status_manutencoes FROM anon;
