-- Central de notificações (spec 029): arquivar. O sino tem duas abas —
-- Inbox (arquivada_em IS NULL) e Arquivadas (arquivada_em IS NOT NULL). Arquivar
-- tira do inbox sem apagar. Independente de lido: dá para arquivar sem ler.
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS arquivada_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_notificacoes_dest_arquivada
  ON public.notificacoes (destinatario_id, arquivada_em, created_at DESC);
