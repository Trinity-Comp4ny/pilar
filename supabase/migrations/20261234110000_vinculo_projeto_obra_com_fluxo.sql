-- Vínculo do projeto e da obra com o fluxo que seguem. Sem ele não dá para responder "quais projetos e obras
-- usam este fluxo?", e portanto não dá para oferecer "atualizar os que já existem" quando o fluxo muda.
-- SET NULL: excluir o fluxo não apaga nem altera o projeto ou a obra, só desfaz o vínculo.

ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS fluxo_id uuid REFERENCES public.fluxos_disciplinas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projetos_fluxo ON public.projetos (fluxo_id) WHERE fluxo_id IS NOT NULL;

-- projetos tem SELECT por coluna (valor_contrato só pela projetos_safe): libera a nova, que não é dado sensível.
GRANT SELECT (fluxo_id) ON public.projetos TO authenticated;

ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS fluxo_obra_id uuid REFERENCES public.fluxos_obra(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_obras_fluxo_obra ON public.obras (fluxo_obra_id) WHERE fluxo_obra_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
