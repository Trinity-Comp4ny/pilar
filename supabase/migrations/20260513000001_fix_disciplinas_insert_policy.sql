-- Corrige B-A5-1: INSERT de disciplinas bloqueado por RLS.
--
-- Contexto: disciplinas é catálogo global (sem empresa_id). A policy anterior
-- exigia ultra_admin para qualquer escrita. A UI permite que admins adicionem
-- disciplinas, então separamos os comandos:
--   INSERT → qualquer usuário com feature 'projetos' editor
--   UPDATE/DELETE → ultra_admin apenas (proteção do catálogo compartilhado)

DROP POLICY IF EXISTS "disciplinas_write" ON public.disciplinas;

-- INSERT: admins de qualquer empresa podem adicionar ao catálogo global
CREATE POLICY "disciplinas_insert" ON public.disciplinas
  FOR INSERT
  WITH CHECK ( public.user_has_feature('projetos', 'editor') );

-- UPDATE/DELETE: apenas ultra_admin (não modifica disciplinas existentes sem supervisão)
CREATE POLICY "disciplinas_manage" ON public.disciplinas
  FOR ALL
  USING ( public.current_effective_role() = 'ultra_admin' )
  WITH CHECK ( public.current_effective_role() = 'ultra_admin' );
