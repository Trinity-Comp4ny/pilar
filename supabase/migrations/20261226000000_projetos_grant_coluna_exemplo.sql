-- projetos.exemplo (20260921000000, SPEC 098) nasceu depois do GRANT por coluna de
-- 20260879000000 (SPEC 073, ADR 0034), que revogou o SELECT da tabela e reconcedeu coluna a
-- coluna. A coluna nova ficou fora da lista: para `authenticated`, qualquer leitura que a cite
-- volta 403. O checklist de primeiros passos conta projetos com `exemplo = false` (SPEC 149) e
-- falhava para todo usuário, com o toast "Ocorreu um erro" no Início (achado da auditoria de
-- telas, 12/11).
--
-- `exemplo` só diz se o projeto é o de demonstração criado no cadastro: não é dado financeiro
-- nem sensível. Mesma concessão das demais colunas não mascaradas.

GRANT SELECT (exemplo) ON public.projetos TO authenticated, anon;
