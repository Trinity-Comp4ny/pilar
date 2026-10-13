# SPEC: Exportação automática dos dados do titular

**Data:** 2026-10-13  
**Status:** Em implementação  
**Autor:** Matheus Rezende  
**Módulo:** privacidade (LGPD)

## Problema

"Exportar meus dados" (Configurações → Privacidade, LGPD art. 18 II e V) grava o pedido
e, desde 13/10, avisa o encarregado. A cópia em si é montada à mão. Prazo de 15 dias
(art. 19) dependendo de alguém lembrar, num produto com cada vez mais usuários.

## Objetivo

O usuário pede e recebe o link da cópia por e-mail em minutos, sem ninguém da equipe.
O encarregado só entra quando a geração automática falha.

**Fora de escopo:**

- Registros de negócio e de RH (projetos, clientes, financeiro, cadastro em Pessoas).
  A controladora desses dados é a empresa cliente; quem exporta é o admin dela.
- Exclusão automática (art. 18 VI). Segue com aprovação humana: apagar conta tem
  retenção legal e efeito sobre a empresa.

## Requisitos

1. Ao gravar o pedido, o trigger chama a edge `exportar-dados-titular`.
2. A cópia é um JSON com: perfil, preferências de notificação, consentimentos (cookies,
   termos, cobrança), notificações recebidas, conversas com a IA, feedback enviado,
   horas lançadas, uso de IA (tokens), trilha das próprias ações (ação, tabela e data,
   sem o conteúdo alterado) e os próprios pedidos LGPD.
3. Nada de segredo ou dado de terceiro: sem códigos de MFA, sem `diff` ou `metadata`
   de auditoria, sem caminho de print.
4. O arquivo vai para o bucket privado `lgpd-exportacoes`; o usuário recebe por e-mail
   um link assinado válido por 7 dias. Exportações anteriores do mesmo usuário saem do
   bucket na geração seguinte.
5. O pedido vai a `completed` (com `expires_at`) ou a `failed`; na falha, o encarregado
   recebe o aviso para atender à mão.

## Critérios de aceite

- [x] O JSON tem todas as seções do requisito 2 e nenhum campo proibido (`exportacao.test.ts`).
- [x] Seção vazia aparece como lista vazia, não some.
- [ ] Em staging, pedir a exportação entrega o e-mail com link que baixa o JSON.

## Dados e contratos

- Edge `exportar-dados-titular`, autenticada como o aviso de exclusão (`x-pilar-secret`
  ou service role), corpo `{ request_id }`.
- Migration: bucket `lgpd-exportacoes` (privado, sem policy: só service role) e o
  trigger `notify_data_export_request` passa a chamar a edge nova.

## Decisões e riscos

- Link assinado de 7 dias em vez de anexo: o arquivo pode crescer (conversas com IA).
- Volume: limites por seção (ex.: últimas 5.000 ações), anotados no próprio JSON.
