# SPEC 119: Renomear e excluir disciplina em todos os projetos

**Data:** 2026-10-14  
**Status:** Em implementação  
**Autor:** Matheus  
**Módulo:** projetos (aba Disciplinas)

## Problema

Feedback de 14/10 (`/projetos/disciplinas`): o usuário excluiu uma disciplina pelo
"Gerenciar disciplinas" e ela continuou na aba Disciplinas. A aba agrupa as disciplinas
dos projetos (`projeto_disciplinas`, que guarda o nome em texto), e excluir do catálogo
nunca mexeu nelas. A aba também não tem como editar ou excluir uma disciplina.

## Objetivo

Disciplina é um nome por empresa: renomear ou excluir vale para o catálogo e para todos os
projetos que a usam, e some ou muda na hora da aba.

**Fora de escopo:** templates de fluxo (`fluxos_disciplinas`), que guardam o nome por conta
própria e não são renomeados; mesclar duas disciplinas.

## Requisitos

1. Cada grupo da aba Disciplinas (cards e tabela) tem um menu com "Renomear" e "Excluir",
   só para quem edita projetos.
2. Renomear troca o nome nas linhas de todos os projetos e no catálogo da empresa. Recusa
   nome que já é de outra disciplina (ignora caixa).
3. Excluir remove as linhas de todos os projetos (com responsáveis, checklist e histórico,
   como a exclusão individual já faz) e a do catálogo. O diálogo informa em quantos
   projetos ela está e que não dá para desfazer.
4. "Gerenciar disciplinas" usa o mesmo caminho para editar e excluir. Substitui o texto
   antigo "Projetos que já usam esta disciplina não serão afetados".
5. O escopo é o dos projetos carregados para o usuário (sem o filtro da tela), nunca uma
   consulta por nome sem escopo: um ultra admin lê todas as empresas pela RLS.

## Critérios de aceite

- [ ] Dado uma disciplina em 2 projetos, quando excluo pela aba, então o diálogo diz "2 projetos" e, ao confirmar, ela some da aba e dos projetos.
- [ ] Dado uma disciplina em projetos, quando excluo pelo "Gerenciar disciplinas", então ela também some da aba.
- [ ] Quando renomeio para o nome de outra disciplina, então aparece "Já existe uma disciplina com este nome" e nada muda.
- [ ] Quando renomeio, então o novo nome aparece na aba, nos projetos e no catálogo.
- [ ] Usuário sem permissão de editar não vê o menu.
