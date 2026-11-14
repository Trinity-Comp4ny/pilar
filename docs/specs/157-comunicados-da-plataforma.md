# SPEC: Comunicados da plataforma

**Data:** 2026-11-10
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** plataforma (ultra-admin, avisos)
**Relacionada:** [SPEC 153](153-faixa-de-incidente-e-manutencao-no-app.md) (faixa de avisos)

## Problema

Comunicado para cliente (preço novo, prazo, regra que muda) hoje sai por WhatsApp, um a um, e
não fica registro do que foi avisado a quem.

## Objetivo

O ultra admin avisa os escritórios dentro do app, para todos ou um público, e sabe que o aviso
foi visto até ser dispensado.

**Fora de escopo:** envio por e-mail e no sino (fase 2), segmentar por usuário específico.

## Requisitos

1. Em `/ultra-admin/comunicados`, criar comunicado com título, mensagem, formato (**faixa** no
   topo do conteúdo ou **modal** que abre uma vez), link opcional (rota do app ou `https://`),
   público (escritório, plano, só administradores; vazio = todos), início e fim opcionais.
2. Faixa usa a mesma faixa da SPEC 153, em azul, depois de incidentes e manutenções.
3. Dispensar (faixa ou "Entendi" no modal) grava no banco: não volta em nenhum dispositivo.
4. Encerrar tira o comunicado de todos na hora; a linha fica como histórico.

Requisitos não-funcionais:

- **RLS:** tabelas só para o ultra admin; o usuário lê pela RPC `comunicados_para_mim` (ativos,
  do público dele, não dispensados) e dispensa por `dispensar_comunicado`.
- **Falha:** erro ao buscar comunicados não esconde incidente.

## Critérios de aceite

- [x] Escritório fora do público não vê o comunicado; administrador vê o "só administradores".
- [x] Comunicado dispensado não volta; encerrado e futuro não aparecem.
- [x] Link só aceita rota do app ou `https://`.
- [ ] pgTAP: usuário comum não cria, não lê a tabela; público e dispensa respeitados.

## Dados e contratos

`plataforma_comunicados` (`titulo`, `mensagem`, `formato`, `link_url`, `link_rotulo`,
`plano_slug`, `empresa_id`, `so_admins`, `inicio`, `fim`, `encerrado_em`) e
`plataforma_comunicados_dispensas` (`comunicado_id`, `user_id`).
