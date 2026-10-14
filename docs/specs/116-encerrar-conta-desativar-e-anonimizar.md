# SPEC: Encerrar conta (remover membro e exclusão LGPD)

**Data:** 2026-10-13  
**Status:** Em implementação  
**Autor:** Matheus Rezende  
**Módulo:** conta e privacidade (LGPD)

## Problema

1. **Remover membro falha.** Configurações → Empresa e Administração → Usuários chamam
   `delete-user`, que apaga o usuário no Auth. Cerca de 55 colunas (`created_by`,
   `updated_by`, `aprovado_por`...) apontam para `auth.users` sem `ON DELETE`, então quem
   já criou um cliente, projeto ou lançamento não sai: o banco recusa
   (`23503 ... clientes_created_by_fkey`). A mesma chamada existe no ultra admin.
2. **Apagar seria errado de qualquer jeito.** O `CASCADE` levaria junto o que precisa
   ficar: aceite dos termos, o próprio pedido de exclusão e as horas lançadas, que são
   dado da empresa.
3. **Exclusão LGPD é manual.** O pedido (art. 18 VI) avisa o encarregado e para aí. Não
   há fila, prazo visível nem botão para atender.

## Objetivo

Encerrar uma conta sempre do mesmo jeito: bloquear o acesso e tirar o dado pessoal,
mantendo o que tem base legal ou pertence à empresa. Remover membro volta a funcionar,
e o pedido LGPD é atendido em um clique, dentro do prazo.

**Fora de escopo:**

- Reativar membro removido (convidar o mesmo e-mail de novo segue recusado).
- Exclusão sem aprovação humana: segue a decisão da SPEC 115.
- Encerrar a empresa inteira (edge `retencao-pos-trial`, que apaga a empresa antes do usuário).
- Cadastro em Pessoas (`pessoas`): é registro de RH da empresa, controladora dele.

## Requisitos

### Remover membro (admin da empresa ou ultra admin)

1. Bloqueia o login no Auth e grava `profiles.desativado_em`. Nada é apagado.
2. O nome continua onde já aparece (histórico, autor de registro): o dado é da empresa.
3. Membro desativado não entra em lista de equipe, contagem de vagas, responsável nem
   e-mail de aviso; a vaga fica livre na hora.
4. A sessão aberta perde acesso a dado na hora: `get_user_empresa_id()` ignora perfil
   desativado, então o RLS recusa mesmo com o token ainda válido.

### Exclusão LGPD (o titular pede, o ultra admin aprova)

5. Aba **Pedidos LGPD** no ultra admin: pedidos de exclusão com titular, empresa, data,
   prazo de 15 dias (art. 19) e situação. Atrasado aparece primeiro e em destaque.
6. **Aprovar** executa na hora:
   - perfil e Auth: nome vira "Usuário removido", e-mail vira um endereço neutro
     (`removido-<id>@usuarios.pilarsoft.invalid`), telefone e foto saem;
   - apaga: conversas com a IA, notificações, preferências de notificação, códigos de
     reserva e fatores do 2FA, sugestões e feedback enviados (com o print), foto e
     cópias exportadas no storage, limite e solicitações de tokens do usuário;
   - bloqueia o login e grava `desativado_em` (como no requisito 1);
   - manda a confirmação ao e-mail original, guardado antes da troca.
7. **Mantém** (base legal ou dado da empresa): aceite dos termos e de cobrança,
   consentimento de cookies, registro de auditoria, consumo de IA (cobrança), pedidos
   LGPD e todo registro de negócio da empresa.
8. Titular que é o único admin ativo da empresa: aprovar é recusado com o motivo, até
   ele passar o papel a outra pessoa ou a empresa ser encerrada.
9. **Recusar** pede o motivo, grava e avisa o titular por e-mail.
10. Toda decisão fica em `audit_logs` e no próprio pedido (`processed_by`, `processed_at`,
    `notes`).

## Critérios de aceite

- [ ] Remover membro que criou cliente e projeto funciona; o nome dele segue nos registros.
- [ ] Membro removido não aparece na equipe nem conta vaga; o token dele não lê dado (pgTAP).
- [ ] O conjunto de dados apagados e mantidos bate com os requisitos 6 e 7 (teste Deno).
- [ ] Único admin ativo: aprovar é recusado (teste Deno).
- [ ] Em staging, aprovar um pedido real deixa o perfil anonimizado e o login bloqueado.

## Dados e contratos

- Migration: `profiles.desativado_em`; `get_user_empresa_id()` ignora desativado;
  `data_deletion_requests.status` aceita `failed`; RPC `ultra_admin_listar_pedidos_exclusao()`.
- `_shared/encerrar-conta.ts`: `desativarConta` e `anonimizarTitular`, usados por
  `delete-user`, `ultra-admin-usuarios` e a edge nova.
- Edge `excluir-dados-titular` (ultra admin), corpo `{ request_id, acao: "aprovar" | "recusar", motivo? }`.

## Decisões e riscos

- Desativar em vez de apagar: é o único caminho que funciona com as FKs de autoria e o
  que preserva a prova de cumprimento (ver ADR 0057).
- Token aberto do membro removido vale até expirar (até 1 h), mas sem dado: o RLS já
  recusa pelo requisito 4.
