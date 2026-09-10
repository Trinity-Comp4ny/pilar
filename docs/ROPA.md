# ROPA — Registro de Operações de Tratamento de Dados Pessoais

**Status:** v1, levantado a partir do schema real (`src/integrations/supabase/types.ts`) e do
código em produção — 2026-09-08. Não substitui revisão por advogado/DPO antes de auditoria
externa ou fiscalização (ver gap "DPO nomeado oficial" em
[`docs/security/COMPLIANCE.md`](security/COMPLIANCE.md)).

LGPD (Art. 37) e boa prática internacional (equivalente ao Art. 30 GDPR) exigem que o operador
mantenha registro de toda atividade de tratamento de dado pessoal: o quê, pra quê, com quem
compartilha, por quanto tempo guarda. Este documento é esse registro. Atualizar sempre que uma
migration criar categoria de dado nova (ex.: novo módulo que grava dado pessoal) ou um
subprocessador novo entrar (ver [`legal/SUBPROCESSADORES.md`](legal/SUBPROCESSADORES.md)).

## Papéis (ver detalhe em `security/COMPLIANCE.md`)

- **Controlador** dos dados dos clientes finais: o escritório de engenharia/arquitetura que
  contrata o Pilar (`empresas`).
- **Operador**: Pilar. Trata em nome do controlador (dados de clientes finais, RH) e como
  controlador direto pros próprios dados de conta/cobrança do escritório.

## Atividades de tratamento

| #   | Atividade                            | Finalidade                                                           | Titular                                                 | Categoria de dado                                                                          | Tabelas principais                                                                | Base legal                                | Retenção                                                                                   | Subprocessador                     |
| --- | ------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------- |
| 1   | Conta e autenticação                 | Login, controle de acesso, MFA                                       | Usuário (funcionário do escritório)                     | Nome, e-mail, telefone, senha (hash), fator MFA                                            | `profiles`, `mfa_backup_codes`                                                    | Execução de contrato                      | Enquanto ativa + 30d pós-desativação                                                       | Supabase                           |
| 2   | Convite e onboarding de empresa      | Trazer empresa nova pro produto                                      | Admin da empresa                                        | Nome, e-mail, CNPJ da empresa                                                              | `empresas`, `convites`, `empresa_owners_pending`, `pilar_pending_signups`         | Execução de contrato                      | Até aceite ou expiração do convite                                                         | Supabase                           |
| 3   | Gestão de pessoas / RH do escritório | Cadastro de equipe, folha                                            | Funcionário do escritório (cliente do Pilar)            | Nome, CPF, dado de folha/salário                                                           | `pessoas`, `pessoas_safe`, `folha_pagamento`, RPC `get_folha_pessoas_pii`         | Execução de contrato (pelo controlador)   | Enquanto o funcionário estiver ativo no escritório + 5 anos (obrigação trabalhista/fiscal) | Supabase                           |
| 4   | Gestão de clientes finais e leads    | CRM do escritório: proposta, funil comercial                         | Cliente final do escritório                             | Nome, e-mail, telefone, dado de negociação                                                 | `clientes`, `leads`, `leads_safe`, `propostas`                                    | Execução de contrato pelo controlador     | Vigência do relacionamento comercial                                                       | Supabase                           |
| 5   | Portal do cliente final              | Cliente acompanha entrega/aprova escopo sem view completa do sistema | Cliente final do escritório                             | Nome, e-mail, senha (hash), histórico de aprovação                                         | `cliente_portal_accounts`, `portal_entregas`, `portal_download_logs`              | Execução de contrato pelo controlador     | Vigência do projeto + 5 anos (auditoria)                                                   | Supabase                           |
| 6   | Diário de obra / app de campo        | Registro de execução em campo (RDO)                                  | Funcionário/terceiro em campo                           | Nome, foto (efetivo, medição, ocorrência), geolocalização de check-in quando aplicável     | `obra_rdo`, `obra_rdo_efetivo`, `obra_rdo_foto`, `campo_*`                        | Execução de contrato pelo controlador     | Vigência do projeto + 5 anos                                                               | Supabase (storage de foto incluso) |
| 7   | Financeiro do escritório             | Contas a pagar/receber, faturamento                                  | Funcionário, cliente, fornecedor (quando pessoa física) | Nome associado a lançamento, valor, dado bancário quando informado                         | `lancamentos`, `faturas`, `contas`, `receitas`, `despesas`, `fornecedores`        | Obrigação legal (fiscal)                  | 5 anos                                                                                     | Supabase                           |
| 8   | Cobrança da própria Pilar            | Assinatura SaaS e compra de token do cliente do Pilar                | Admin da empresa-cliente (pagador)                      | Nome, e-mail, CNPJ, dado de pagamento (cartão tokenizado, não armazenado cru)              | `pilar_subscriptions`, `pilar_token_pack_purchases`, `asaas_webhook_logs`         | Execução de contrato                      | 5 anos (fiscal)                                                                            | Supabase, Asaas                    |
| 9   | IA no produto (chat, agentes)        | Copiloto, geração de insight                                         | Usuário que interage com o chat                         | Texto livre digitado pelo usuário (pode conter PII incidental), histórico de uso/tokens    | `chat_messages`, `chat_sessions`, `ai_usage_logs`, `ai_token_ledger`              | Execução de contrato / legítimo interesse | Enquanto a conta existir                                                                   | Supabase; Google (Gemini API)      |
| 10  | Auditoria e segurança                | Rastreabilidade, detecção de fraude/abuso, suporte via impersonation | Qualquer usuário                                        | Ação realizada, IP, timestamp, hash-chain                                                  | `audit_logs`, `admin_audit_logs`, `rate_limit_attempts`, `impersonation_sessions` | Legítimo interesse (segurança)            | 5 anos                                                                                     | Supabase                           |
| 11  | Analytics de produto                 | Entender ativação/retenção/adoção (SPEC 098)                         | Usuário logado, com consentimento                       | Rota visitada, evento de produto, `empresa_id`/`role` (PII textual sofre scrub automático) | N/A (PostHog, fora do Postgres)                                                   | Consentimento (cookie de análise)         | Até revogação do consentimento                                                             | PostHog                            |
| 12  | Comunicação transacional             | E-mail de convite, recuperação de senha, notificação                 | Usuário destinatário                                    | Nome, e-mail, conteúdo do e-mail                                                           | `email_envios`, `email_supressoes`, `notificacoes`                                | Execução de contrato                      | 12 meses (log de envio)                                                                    | Resend                             |
| 13  | Exercício de direitos do titular     | Atender pedido de exportação/exclusão (LGPD Art. 18)                 | Titular solicitante                                     | Cópia do próprio dado, ou marcação para exclusão                                           | `data_export_requests`, `data_deletion_requests`                                  | Obrigação legal                           | Até conclusão do pedido + prazo de prova de atendimento                                    | Supabase                           |
| 14  | Monitoramento de erro                | Diagnóstico técnico                                                  | Qualquer usuário (incidental, PII scrubbed)             | Stacktrace, contexto técnico, PII filtrada por `src/lib/monitoring.ts`                     | N/A (Sentry, fora do Postgres)                                                    | Legítimo interesse                        | Conforme retenção padrão Sentry                                                            | Sentry                             |

**Nota item 9 (confirmado 2026-09-08):** o provedor de LLM é o **Gemini (Google)**, usado pelas 3
IA vivas do produto (`ai-chat`, `ai-cotacao-import`, `ai-import-financeiro` — ver DECISOES.md
2026-08-31). O texto digitado pelo usuário no chat e o conteúdo enviado pra cotação/importação
financeira trafegam pra API do Google. O projeto que gera a `GEMINI_API_KEY` tem billing ativo
(tier pago da Gemini API): o Google não usa esse conteúdo pra treinar modelo. Adicionado como
subprocessador em [`legal/SUBPROCESSADORES.md`](legal/SUBPROCESSADORES.md).

**Achado paralelo (não é ROPA, é higiene de credencial):** staging e produção usam a **mesma**
`GEMINI_API_KEY`. Isso não muda o tratamento de dado pessoal em si (mesmo tier pago nos dois
ambientes), mas mistura o consumo de cota/custo dos dois ambientes numa chave só e, se staging
vazar, o blast radius inclui produção (staging já teve gap de secret antes, ver memória do
projeto de 31/08). Considerar chave separada por ambiente como item de segurança, fora do
escopo deste ROPA.

## Transferência internacional

Banco principal (Supabase) fica em São Paulo, sem transferência internacional. Vercel (edge
functions), Sentry, PostHog e **Google (Gemini API)** podem processar dado fora do Brasil — ver
seção 9 de [`legal/PRIVACY_POLICY.md`](legal/PRIVACY_POLICY.md).

## Como manter isto vivo

- Migration nova que adiciona tabela com dado pessoal → adicionar linha aqui na mesma PR.
- Subprocessador novo (nova integração) → adicionar aqui **e** em
  [`legal/SUBPROCESSADORES.md`](legal/SUBPROCESSADORES.md) antes de ir pra produção.
- Revisão trimestral sugerida: conferir se alguma tabela saiu de uso (ex. módulo dormente) e
  atualizar retenção/finalidade.
