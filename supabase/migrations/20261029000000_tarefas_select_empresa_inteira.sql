-- Todo mundo da empresa passa a VER as tarefas de todos (estilo Trello/ClickUp),
-- para filtrar por pessoa ("meu modo") ou olhar o quadro inteiro. Antes, usuário
-- comum só lia tarefa em que era criador ou responsável, e tarefa sem responsável
-- ficava invisível para ele.
-- Só o SELECT muda. UPDATE e DELETE seguem restritos a admin/coordenador, criador
-- e responsável (20260903000000): ver não é poder editar.

DROP POLICY IF EXISTS tarefas_select ON public.tarefas;

CREATE POLICY tarefas_select ON public.tarefas
  FOR SELECT USING (empresa_id = public.get_user_empresa_id());
