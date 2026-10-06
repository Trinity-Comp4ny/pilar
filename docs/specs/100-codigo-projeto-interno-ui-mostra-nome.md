# SPEC: Código do projeto é interno, a interface mostra o nome

**Data:** 2026-10-06
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** Projetos, Financeiro, Portal Cliente

<!-- Origem: relato da Liz (cliente) em 29/09: "PRJ-0023 está saindo em alguns projetos, sempre usamos o 409". -->

## Problema

Todo projeto criado pelo formulário recebe `codigo_projeto = PRJ-00NN`, gerado pelo
servidor. O código é uma chave interna (unique por empresa), mas a interface o
mostrava como identificação do projeto, em cerca de 25 pontos:

- cabeçalho do projeto: `PRJ-0023` grande, nome pequeno embaixo;
- financeiro: o seletor de projeto do lançamento listava só o código, a coluna
  "Projeto" da lista também. Quem lança escolhe o projeto pelo código, que não
  reconhece, e o lançamento vai para o projeto errado;
- dashboard (próximos vencimentos e lista de projetos), calendário, mapa, busca
  global, relatórios, portal do cliente, chat.

O usuário nomeia os projetos do jeito dele ("409 - Neiva") e nunca digitou o
código. O sistema mostrava outro identificador no lugar.

## Objetivo

O usuário só vê o nome do projeto. O código continua gerado automaticamente e
existe só como chave interna.

**Fora de escopo:** mudar a geração do código, renomear ou remover a coluna
`codigo_projeto`, unificar as 3 cópias do gerador (create_projeto_completo,
rpc_converter_proposta_projeto, criar_projeto_agente), colunas legadas
`projeto_codigo` em RPCs do portal.

## Requisitos

1. Nenhuma tela mostra `codigo_projeto` ao usuário (projetos, financeiro,
   dashboard, calendário, mapa, busca, relatórios, portal, chat).
2. Seletores e filtros de projeto no financeiro listam o nome.
3. A view `lancamentos` expõe `projeto_nome`. Busca e ordenação por projeto
   em `get_lancamentos_pagina` usam o nome.
4. A adição rápida do kanban não pede código; usa o id devolvido pela criação.
5. Nenhum campo de código em formulário (o do chat de criação de projeto sai).

## Critérios de aceite

- [x] pgTAP: `lancamentos.projeto_nome` traz o nome; busca por nome acha o
      lançamento; busca por `PRJ-0023` não acha.
- [x] Typecheck e vitest verdes (884 testes).
- [ ] Conferido na tela, com a empresa afetada: cabeçalho do projeto, lista do
      financeiro, seletor do lançamento.
