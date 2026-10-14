# ADR 0057: Encerrar conta desativando e anonimizando, nunca apagando o usuário

**Data:** 2026-10-13  
**Status:** Accepted

## Contexto

Remover membro (`delete-user`, `ultra-admin-usuarios`) chamava `auth.admin.deleteUser`.
Cerca de 55 colunas de autoria (`created_by`, `updated_by`, `aprovado_por`...) apontam para
`auth.users` sem `ON DELETE`: para quem já criou um cliente, projeto ou lançamento, o banco
recusa (`23503`). Quando passa, o `CASCADE` de outras tabelas leva o aceite dos termos, o
próprio pedido LGPD e as horas lançadas, que são dado da empresa.

- **Apagar e trocar as FKs para `SET NULL`**: some a autoria de todo registro da empresa e
  a prova de aceite e de atendimento. Migration grande em tabelas de negócio.
- **Reatribuir a autoria a quem removeu**: falseia o histórico.
- **Desativar e anonimizar**: funciona com as FKs como estão e guarda o que tem base legal.

## Decisão

Encerrar conta é sempre: bloquear o login no Auth (`ban_duration`) e gravar
`profiles.desativado_em`. Nenhuma Edge Function chama `deleteUser` para encerrar conta
(a exceção é `retencao-pos-trial`, que apaga a empresa inteira antes).

- **Remover membro** só desativa: o nome segue nos registros, porque o dado é da empresa.
- **Exclusão LGPD** (art. 18 VI) desativa e anonimiza: troca nome, e-mail, telefone e foto
  por valores neutros e apaga o dado pessoal da lista `TABELAS_APAGADAS`; mantém
  `TABELAS_MANTIDAS` (prova de aceite, auditoria, cobrança, dado da empresa).
- `get_user_empresa_id()` ignora perfil desativado, então o token ainda válido de uma conta
  encerrada não lê dado: 222 das 260 policies passam por ela.
- Toda consulta que lista equipe, conta vaga ou manda e-mail para admins filtra
  `desativado_em IS NULL`. Busca por id (nome em histórico) não filtra.

Código: `supabase/functions/_shared/encerrar-conta.ts`. Contexto completo na SPEC 116.

## Consequências

- Remover membro volta a funcionar para qualquer pessoa, e a vaga fica livre na hora.
- O e-mail de um membro removido continua preso à conta desativada: convidar de novo é
  recusado até existir reativação (fora da SPEC 116).
- Consulta nova que lista pessoas da empresa precisa lembrar do filtro. O pgTAP
  `encerrar_conta.sql` cobre o RLS; as listas, não.
- Tabela nova com dado pessoal do usuário precisa entrar em `TABELAS_APAGADAS` ou em
  `TABELAS_MANTIDAS`, com motivo.

## Decisões relacionadas

- [SPEC 115](../../specs/115-exportacao-automatica-dos-dados-do-titular.md): exportação
  automática; mesma fronteira entre dado do titular e dado da empresa.
- [SPEC 116](../../specs/116-encerrar-conta-desativar-e-anonimizar.md).
