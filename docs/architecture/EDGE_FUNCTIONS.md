# Catálogo das Edge Functions

<!-- Gerado por scripts/edge-functions-catalog.mjs a partir de supabase/functions/CATALOGO.json.
     Não editar à mão: edite o CATALOGO.json e rode `node scripts/edge-functions-catalog.mjs`. -->

44 funções. **Chamada por**: app (chamada no código do front), cron (pg_cron nas
migrations) ou origem externa declarada no manifesto. **Login**: `verify_jwt` do `config.toml`
(JWT aceita a chave anon; "própria" = a função faz a autorização). **Secrets**: lidos direto
na pasta da função (o que vem de `_shared`, como a chave do Gemini, não aparece).
**Sem chamador conhecido**: nenhuma das origens
acima; candidata a remoção, lembrando que apagar o código não despublica a função no Supabase.

## IA

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `ai-chat` | Copiloto do chat: classifica a intenção e responde com dados do usuário (só leitura, RLS do próprio usuário). | app | JWT |  | sim |
| `ai-cotacao-import` | Lê PDF ou imagem de orçamento de fornecedor e extrai os itens (Gemini, spec 023). | app | JWT |  | não |
| `ai-import-financeiro` | Extrai lançamentos do texto de um extrato ou fatura (spec 017). | app | JWT |  | não |
| `ai-rdo-voz` | Transcreve áudio curto do RDO e preenche os campos de texto (spec 080). | app | JWT |  | não |

## Assinatura do Pilar (Asaas da plataforma)

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `ativar-plano` | Tokeniza o cartão no trial sem cobrar e grava o consentimento datado (SPEC 098). | app | JWT | `ALLOWED_ORIGINS` `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `pilar-checkout-create` | Checkout público do Pilar: cria cliente e cobrança na Asaas da plataforma. | app | própria | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `pilar-checkout-status` | Consulta pública do status de pagamento do checkout. | app | própria | `ALLOWED_ORIGINS` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `pilar-checkout-webhook` | Eventos da Asaas da plataforma: libera signup, renova assinatura, credita tokens, inadimplência. | Asaas da plataforma (webhook) | própria | `ALLOWED_ORIGINS` `ASAAS_PLATFORM_WEBHOOK_TOKEN` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `pilar-subscription-manage` | Troca de plano e cancelamento da assinatura do Pilar pelo admin da empresa. | app | JWT | `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `pilar-token-pack-create` | Compra avulsa de pacote de tokens de IA (SPEC 077/080). | app | JWT | `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `verificar-documento` | Sobe a empresa para o nível Prata ao informar CNPJ ou CPF (SPEC 098). | app | JWT |  | sim |

## Cobrança do cliente da empresa (Asaas da empresa)

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `asaas-config` | Configuração do Asaas da própria empresa (chave cifrada no Vault). A tela que chamava foi removida em 7602833d. | **sem chamador conhecido** | JWT |  | não |
| `asaas-criar-cobranca` | Cria cobrança no Asaas da empresa para uma receita do cliente dela. | **sem chamador conhecido** | JWT |  | não |
| `asaas-webhook` | Recebe eventos do Asaas da empresa e atualiza a receita (recebida, atrasada, estornada). | Asaas da empresa (webhook) | própria | `ASAAS_WEBHOOK_TOKEN` | sim |

## Portal do cliente

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `invite-cliente-portal` | Convida o cliente para o portal (manda o e-mail antes de gravar). | app | JWT | `PUBLIC_SITE_URL` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `portal-aprovar-proposta` | Cliente aprova proposta pelo portal (auth pelo token do portal). | app | própria | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `portal-entrega-download` | URL assinada de 5 minutos para arquivo de entrega do portal. | **sem chamador conhecido** | própria | `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `portal-get-projeto` | Dados do projeto para o portal (auth pelo token do portal). | **sem chamador conhecido** | própria | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `portal-obra-fotos` | URLs assinadas das fotos curadas do diário de obra para o portal (spec 087). | app | JWT | `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `reset-cliente-portal-password` | Redefine a senha do cliente do portal (e-mail antes de mexer na conta). | app | JWT | `PUBLIC_SITE_URL` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `upload-portal-entrega` | Upload autenticado de arquivo de entrega para o portal. | **sem chamador conhecido** | JWT | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |

## Pilar Campo

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `campo-upload-foto` | Upload de foto do Pilar Campo, autorizado pelo token de campo (conta sem usuário Supabase). | app | JWT | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `invite-campo` | Emite credencial de acesso do Pilar Campo para a equipe de obra. | app | JWT | `PUBLIC_SITE_URL` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |

## Membros e acesso

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `delete-user` | Remove membro: admin só da própria empresa e nunca ultra admin; ultra admin de qualquer empresa. | app | JWT |  | sim |
| `invite-user` | Convida, reenvia e cancela convite de membro da empresa. | app | JWT |  | sim |

## Autenticação

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `auth-email-hook` | Hook de e-mail do Supabase Auth: monta convite e recuperação de senha e envia pelo Resend. | Supabase Auth (hook de e-mail) | própria | `AUTH_HOOK_SEND_EMAIL_SECRET` | sim |

## E-mail

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `resend-webhook` | Recebe o status de entrega do Resend e fecha o ciclo do e-mail enviado. | Resend (webhook) | própria | `RESEND_WEBHOOK_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `send-data-deletion-notification` | E-mail de confirmação de exclusão de dados (LGPD), disparado por trigger. | cron | JWT | `APP_URL` `DATA_DELETION_NOTIFY_SECRET` `LGPD_DPO_EMAIL` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `send-invoice-reminder` | Lembrete de cobrança por e-mail para cliente da empresa. | **sem chamador conhecido** | JWT | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `send-manual-client-email` | E-mail manual da empresa para um cliente dela (nunca endereço livre). | app | JWT |  | não |
| `send-proposta-email` | Envia a proposta por e-mail ao cliente. | app | JWT | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |

## Jobs agendados (pg_cron)

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `guardiao-margem-cron` | Cron diário: prepara rascunho de aditivo quando o projeto estoura o orçamento (spec 081). | cron | própria | `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `notificacoes-email-cron` | Cron: manda por e-mail o que está na central de notificações e ninguém leu. | cron | própria | `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `retencao-pos-trial` | Cron: avisos e exclusão de empresa depois do trial vencido (SPEC 098 Fase 3). | cron | própria | `ALLOWED_ORIGINS` `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `reverificar-documentos-pendentes` | Cron: reverifica CNPJ ou CPF pendentes do trial (SPEC 098). | cron | própria | `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | não |
| `trial-expiry-cron` | Cron: expira trials, converte quem tem cartão e manda os avisos. | cron | própria | `ALLOWED_ORIGINS` `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |

## Plataforma (ultra admin)

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `create-company-owner` | Convite de dono de empresa nova (bootstrap manual com chave de super admin). | manual (curl com chave de super admin) | JWT | `ALLOWED_ORIGINS` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` `SUPER_ADMIN_KEY` | sim |
| `log-impersonation` | Abre e encerra sessão de impersonation do ultra admin, com registro no servidor. | app | JWT |  | não |
| `ultra-admin-empresas` | Gestão de empresas pelo ultra admin. | app | JWT |  | não |
| `ultra-admin-usuarios` | Gestão de usuários pelo ultra admin. | app | JWT |  | não |

## Utilitários

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `geocode-address` | Geocodifica endereço pelo Nominatim (mapa). | app | JWT |  | não |
| `health` | Saúde do backend (banco, Asaas, Resend); usado pelo smoke de deploy e pelo monitor de produção. | monitor de produção e smoke de deploy | própria | `HEALTH_CHECK_ASAAS` `HEALTH_CHECK_RESEND` `RELEASE_SHA` `SENTRY_RELEASE` `VERCEL_GIT_COMMIT_SHA` | sim |
| `lookup-cep` | Busca CEP sem login (checkout), BrasilAPI com fallback de provedor. | app | JWT |  | sim |
| `turnstile-verify` | Verifica no servidor o token do Cloudflare Turnstile. | **sem chamador conhecido** | própria | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` `TURNSTILE_SECRET_KEY` | não |

## Sem chamador conhecido

- `asaas-config`
- `asaas-criar-cobranca`
- `portal-entrega-download`
- `portal-get-projeto`
- `upload-portal-entrega`
- `send-invoice-reminder`
- `turnstile-verify`
