-- Fim das disciplinas "padrão do sistema" (feedback de 14/10: o usuário não
-- conseguia excluí-las, porque a RLS de DELETE só alcança disciplina da própria
-- empresa, e a lista já nascia cheia de card que ninguém criou).
--
-- `disciplinas` é só picklist: `projeto_disciplinas` guarda o NOME em texto, sem
-- FK, então apagar do catálogo não toca em nenhum projeto existente.
--
-- Mas a semente global não era só enfeite: em produção, Estrutural, Elétrica e
-- Hidráulica estão em mais de 70 disciplinas de projeto cada. Apagar direto
-- tiraria essas opções da lista de quem usa. Por isso, antes de apagar, cada
-- empresa que já usa uma disciplina padrão em algum projeto recebe uma cópia
-- própria (empresa_id preenchido), que ela pode editar ou excluir. Quem não usa
-- fica com a lista vazia. Empresa nova nasce sem nenhuma.

INSERT INTO public.disciplinas (nome, empresa_id)
SELECT DISTINCT ON (p.empresa_id, lower(g.nome)) g.nome, p.empresa_id
FROM public.projeto_disciplinas pd
JOIN public.projetos p ON p.id = pd.projeto_id
JOIN public.disciplinas g ON g.empresa_id IS NULL AND lower(g.nome) = lower(pd.nome)
WHERE p.empresa_id IS NOT NULL
ORDER BY p.empresa_id, lower(g.nome)
ON CONFLICT DO NOTHING;

DELETE FROM public.disciplinas WHERE empresa_id IS NULL;
