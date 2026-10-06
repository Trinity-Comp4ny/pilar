# ADR 0044: Recuperação de conta Auth sem profile exige convite e email confirmado

**Data:** 2026-10-06
**Status:** Accepted (plano aprovado; implementação neste PR)

## Contexto

Excluir um profile sem excluir a conta Auth deixa um usuário que consegue fazer
login, mas não pertence a uma empresa. A RLS devolve listas vazias e a lista de
membros não mostra essa conta. Um convite comum também falha porque o email já
existe no Auth. A exclusão de usuários deve continuar passando por `delete-user`.

Os fluxos atuais de cadastro, Google e convite criam o profile na transação de
criação de `auth.users`; o onboarding completa um profile existente.

## Decisão

Criação e reenvio de convite enviam um link de acesso à conta existente quando o
email não tem profile. O convite permanece pendente até a pessoa autenticar.
A rota privada bloqueia a entrada no Layout sem profile e chama
`aceitar_convite_pendente()` depois da consulta inicial de profile e do desafio MFA.

A RPC não recebe email, empresa ou cargo do client. Usa `auth.uid()`, bloqueia a
linha de `auth.users` e lê seu email confirmado diretamente no banco. Escolhe o
convite válido mais recente por email, com desempate por ID. Empresa e cargo vêm
exclusivamente desse convite; `owner` e `ultra_admin` são recusados. Criação de
profile e consumo de convite são atômicos, preservando os triggers existentes.
Um profile já existente nunca é transferido nem alterado por essa RPC.

Esta é uma exceção deliberada ao gate usual `empresa_id = get_user_empresa_id()`:
a conta órfã ainda não tem empresa. A fronteira equivalente é a identidade da
própria conta, o email confirmado e um convite existente para esse email. A função
usa `SECURITY DEFINER`, `search_path` vazio e execução apenas para `authenticated`.
Nenhum dado de tenant ou role é lido de metadata editável pelo usuário.

## Consequências

- Sem convite válido, a conta recebe orientação para pedir um convite ao administrador.
- Erro ao carregar profile tem retry e monitoramento; não dispara adoção de convite.
- Falha no envio do link preserva o convite para reenvio; não cria profile.
- Recuperação exige onboarding e atualização da sessão/profile antes de entrar no app.
- Duas chamadas simultâneas são serializadas pela conta Auth e consomem um convite.
- Triggers podem impedir a recuperação, por exemplo em empresa em modo leitura;
  nesse caso o convite permanece intacto.
- A escolha automática do convite mais recente após login é o comportamento aprovado
  para esta correção. Não existe transferência automática de contas com profile.

## Verificação

`supabase/tests/aceitar_convite_pendente.sql` testa a RPC como `authenticated`,
incluindo email diferente, não confirmado, cargos proibidos e rollback por trigger.
`scripts/test-orphan-invite-concurrency.py` verifica concorrência no banco local.
Os testes de sessão e rota cobrem loading, MFA, retry e isolamento entre empresas.
