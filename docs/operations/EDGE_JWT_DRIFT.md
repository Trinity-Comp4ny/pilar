# Verificação de `verify_jwt` nas Edge Functions

## Risco identificado

Comparação direta dos projetos Supabase em 19/11/2026:

- Staging: 70 funções presentes no repositório e com flags de autenticação
  iguais às esperadas; 13 funções históricas implantadas sem diretório no
  código atual, **não removidas**.
- Produção: 11 divergências comparadas com o código de staging: nove funções
  presentes com `verify_jwt=false` embora o `config.toml` use o padrão
  `true`, além de duas funções de staging ainda ausentes de produção
  (`proposta-link` e `reuniao-analisar`). Isso é esperado até o release
  correspondente, **não** representa 11 falhas exploráveis comprovadas.
  Produção também mantém 13 funções históricas; o inventário requer revisão.

Exemplos de flags divergentes em produção: `create-company-owner`,
`send-proposta-email`, `pilar-subscription-manage`,
`upload-portal-entrega` e `log-impersonation`.
Algumas possuem autenticação própria dentro do handler. Não alterar/remover
seus endpoints sem validar os fluxos reais.

## Implementação

O script `scripts/check-edge-jwt.mjs` utiliza somente GET em
`https://api.supabase.com/v1/projects/{ref}/functions`, com o token do
GitHub Environment. Enumera diretórios em `supabase/functions` excluindo
`_shared`; para cada função, lê o `verify_jwt` explícito no
`supabase/config.toml`. O padrão de deploy da Supabase é `true`.

Em `.github/workflows/ci.yml`, roda depois do deploy em **staging** e
**production**, com até seis leituras para tolerar propagação da metadata.
Se o valor implantado estiver incorreto, o job falha, impedindo que um
`Staging Ready` ou release da versão seja reportado como seguro.

A existência de funções remotas **não presentes no repo** é avisada no log,
mas não bloqueia imediatamente: sua remoção precisa de auditoria de
referências e chamadas, para evitar interromper fluxos de clientes.

## Validação

- `node --test scripts/check-edge-jwt.test.mjs`: parsing, valores default,
  ausência de função, drift e funções históricas.
- Em staging, verificar logs `JWT correto em N funções`.
- Em produção, verificar que o deploy convergiu todas as funções do release
  para o `config.toml`, sem autorizar uma flag `false` apenas para silenciar
  o check.
- Se o script falhar por HTTP 401/403, conferir se o
  `SUPABASE_ACCESS_TOKEN` tem acesso de leitura a Edge Functions no projeto.
- Em 2026, a CLI `supabase functions deploy` deve aplicar as configurações do
  `config.toml`. Flags manuais no Dashboard não substituem o Git versionado.

## Inventário histórico pendente

Revisar separadamente as 13 funções implantadas em staging que não existem
mais em `supabase/functions`. Verificar referências em `pg_cron`, APIs
externas, clientes e logs antes de desativar. Funções históricas com
`verify_jwt=false` merecem prioridade na análise. Nenhuma é apagada
automaticamente neste PR.

A escolha de **MFA opcional para contas comuns não muda**: esta checagem
trata da autenticação de gateway das Edge Functions, não da configuração
TOTP dos usuários.

Referências: [Supabase Config](https://supabase.com/docs/guides/local-development/cli/config)
e [Management API de Edge Functions](https://supabase.com/docs/reference/api/v1-list-all-functions).
