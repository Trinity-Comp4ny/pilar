-- Remove as duas notificações in-app com engajamento real medido: 0% de leitura
-- em produção (achado consultando dado real, projeto vepnsonbnsimqcsfcagm via MCP).
--
-- 'projeto_status_alterado' (47 notificações desde 20/08, 0 lidas): dispara a cada
-- arrasto no Kanban de projeto, inclusive ajuste/correção trivial de status, levando
-- pra /projetos/{id} — a mesma tela onde quem recebeu provavelmente já vê a mudança
-- organicamente. Sem ação nenhuma associada.
--
-- 'disciplina_atribuida' (25 notificações desde 20/08, 0 lidas): puramente
-- informativo ("você foi marcado"), sem decisão pendente.
--
-- Contraste: pagamento_atrasado (financeiro, exige ação) tem 60% de leitura no
-- mesmo período. As duas notificações removidas aqui só geram ruído — treinam o
-- usuário a ignorar o sino, o que prejudica tipos que de fato importam (ex.
-- orcamento_excedido, spec 067/081).
--
-- Remoção completa (não é meio-termo): a RPC e o trigger só existiam pra gerar
-- essas duas notificações, então ficariam código morto se só parasse de chamar do
-- front. 'proxima_etapa_liberada' (rpc_notificar_proxima_etapa) NÃO é tocada aqui —
-- não foi medida, fica fora do escopo desta limpeza.

DROP TRIGGER IF EXISTS trg_notificar_disciplina_atribuida ON public.projeto_disciplina_responsaveis;
DROP FUNCTION IF EXISTS public.tg_notificar_disciplina_atribuida();
DROP FUNCTION IF EXISTS public.rpc_notificar_projeto_status(uuid, text);
