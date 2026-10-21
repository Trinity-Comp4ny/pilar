# Catálogo das Edge Functions

<!-- Gerado por scripts/edge-functions-catalog.mjs a partir de supabase/functions/CATALOGO.json.
     Não editar à mão: edite o CATALOGO.json e rode `node scripts/edge-functions-catalog.mjs`. -->

56 funções. **Chamada por**: app (chamada no código do front), cron (pg_cron nas
migrations) ou origem externa declarada no manifesto. **Login**: `verify_jwt` do `config.toml`
(JWT aceita a chave anon; "própria" = a função faz a autorização). **Secrets**: lidos direto
na pasta da função (o que vem de `_shared`, como a chave do Gemini, não aparece).
**Sem chamador conhecido**: nenhuma das origens
acima; candidata a remoção, lembrando que apagar o código não despublica a função no Supabase.

## IA

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `ai-chat` | Copiloto do chat: classifica a intenção e responde com dados do usuário (só leitura, RLS do próprio usuário). | app | JWT | `AI_GATEWAY_API_KEY` `GEMINI_API_KEY` | sim |
| `ai-cotacao-import` | Lê PDF ou imagem de orçamento de fornecedor e extrai os itens (Gemini, spec 023). | app | JWT |  | sim |
| `ai-import-financeiro` | Extrai lançamentos do texto de um extrato ou fatura (spec 017). | app | JWT |  | sim |
| `resumo-semanal` | Resumo semanal do Início: lê os fatos da semana pelo RLS de quem pediu (empresa para quem vê dinheiro, pessoa para os demais), o modelo redige e o código confere os números (SPEC 121). | app | JWT |  | sim |

## Assinatura do Pilar (Asaas da plataforma)

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `ativar-plano` | Tokeniza o cartão no trial sem cobrar e grava o consentimento datado (SPEC 098). | app | JWT | `ALLOWED_ORIGINS` `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `pilar-checkout-create` | Checkout público do Pilar: cria cliente e cobrança na Asaas da plataforma. | app | própria | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `pilar-checkout-status` | Consulta pública do status de pagamento do checkout. | app | própria | `ALLOWED_ORIGINS` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `pilar-checkout-webhook` | Eventos da Asaas da plataforma: libera signup, renova assinatura, credita tokens, inadimplência. | Asaas da plataforma (webhook) | própria | `ALLOWED_ORIGINS` `ASAAS_PLATFORM_WEBHOOK_TOKEN` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `pilar-subscription-manage` | Troca de plano e cancelamento da assinatura do Pilar pelo admin da empresa. | app | JWT | `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `pilar-token-pack-create` | Compra avulsa de pacote de tokens de IA (SPEC 077/080). | app | JWT | `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `verificar-documento` | Sobe a empresa para o nível Prata ao informar CNPJ ou CPF (SPEC 098). | app | JWT |  | sim |

## Cobrança do cliente da empresa (Asaas da empresa)

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `asaas-config` | Configuração do Asaas da própria empresa (chave cifrada no Vault). A tela que chamava foi removida em 7602833d. | **sem chamador conhecido** | JWT |  | sim |
| `asaas-criar-cobranca` | Cria cobrança no Asaas da empresa para uma receita do cliente dela. | **sem chamador conhecido** | JWT |  | sim |
| `asaas-webhook` | Recebe eventos do Asaas da empresa e atualiza a receita (recebida, atrasada, estornada). | Asaas da empresa (webhook) | própria | `ASAAS_WEBHOOK_TOKEN` | sim |

## Portal do cliente

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `invite-cliente-portal` | Convida o cliente para o portal (manda o e-mail antes de gravar). | app | JWT | `PUBLIC_SITE_URL` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `portal-aprovar-proposta` | Cliente aprova proposta pelo portal (auth pelo token do portal). | app | própria | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `portal-entrega-download` | URL assinada de 5 minutos para arquivo de entrega do portal. | **sem chamador conhecido** | própria | `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `portal-get-projeto` | Dados do projeto para o portal (auth pelo token do portal). | **sem chamador conhecido** | própria | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `portal-obra-fotos` | URLs assinadas das fotos curadas do diário e dos registros liberados ao cliente, para o portal (spec 087, SPEC 135). | app | JWT | `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `portal-resumo-semana` | Resumo da semana da obra para o portal do cliente, escrito pela IA só com os registros liberados e guardado até o conjunto mudar (SPEC 135). | app | JWT | `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `reset-cliente-portal-password` | Redefine a senha do cliente do portal (e-mail antes de mexer na conta). | app | JWT | `PUBLIC_SITE_URL` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `upload-portal-entrega` | Upload autenticado de arquivo de entrega para o portal. | **sem chamador conhecido** | JWT | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |

## Pilar Campo

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `campo-registro-arquivos` | URLs assinadas das fotos e do áudio dos PRÓPRIOS registros de obra, para a conta de campo (token). SPEC 135. | app | JWT | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `campo-registro-criar` | Registro de obra do Pilar Campo (áudio, foto, texto), autorizado pelo token de campo: guarda e responde na hora, a IA organiza em segundo plano. SPEC 135. | app | JWT | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `campo-upload-foto` | Upload de foto do Pilar Campo, autorizado pelo token de campo (conta sem usuário Supabase). | app | JWT | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `invite-campo` | Emite credencial de acesso do Pilar Campo para a equipe de obra. | app | JWT | `PUBLIC_SITE_URL` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `registro-criar` | Registro de obra gravado pelo escritório (áudio, foto, texto), autorizado pelo JWT do usuário: guarda e responde na hora, a IA organiza em segundo plano. SPEC 135. | app | JWT | `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `registro-reprocessar` | Tentar de novo a organização de um registro de obra que falhou; vale para o escritório (JWT) e para o campo (token). SPEC 135. | app | JWT | `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |

## Membros e acesso

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `delete-user` | Remove membro (bloqueia o login e desativa, sem apagar: SPEC 116): admin só da própria empresa e nunca ultra admin; ultra admin de qualquer empresa. | app | JWT |  | sim |
| `invite-user` | Convida, reenvia e cancela convite de membro da empresa. | app | JWT |  | sim |

## Autenticação

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `auth-email-hook` | Hook de e-mail do Supabase Auth: monta convite e recuperação de senha e envia pelo Resend. | Supabase Auth (hook de e-mail) | própria | `AUTH_HOOK_SEND_EMAIL_SECRET` | sim |

## E-mail

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `exportar-dados-titular` | Atende o pedido de exportação de dados (LGPD art. 18): monta a cópia, guarda em bucket privado e manda link de 7 dias (SPEC 115). | cron, trigger notify_data_export_request (pg_net) | própria | `DATA_DELETION_NOTIFY_SECRET` `LGPD_DPO_EMAIL` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `resend-webhook` | Recebe o status de entrega do Resend e fecha o ciclo do e-mail enviado. | Resend (webhook) | própria | `RESEND_WEBHOOK_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `send-data-deletion-notification` | E-mail de confirmação de exclusão de dados (LGPD), disparado por trigger. | cron | JWT | `APP_URL` `DATA_DELETION_NOTIFY_SECRET` `LGPD_DPO_EMAIL` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `send-invoice-reminder` | Lembrete de cobrança por e-mail para cliente da empresa. | **sem chamador conhecido** | JWT | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `send-manual-client-email` | E-mail manual da empresa para um cliente dela (nunca endereço livre). | app | JWT |  | sim |
| `send-proposta-email` | Envia a proposta por e-mail ao cliente. | app | JWT | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |

## Jobs agendados (pg_cron)

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `aviso-ultra-admin-email` | Disparada pelo trigger de notificacoes (pg_net): manda por e-mail, na hora, cada aviso de plataforma do ultra admin (feedback, novo cadastro, ativar plano bloqueado). SPEC 113. | cron | própria | `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `guardiao-margem-cron` | Cron diário: prepara rascunho de aditivo, sustentado pelas despesas do projeto, quando ele estoura o orçamento (specs 081 e 107). | cron | própria | `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `notificacoes-email-cron` | Cron: manda por e-mail o que está na central de notificações e ninguém leu. | cron | própria | `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `reconciliar-assinaturas` | Cron diário: compara cada assinatura do Pilar com o Asaas e avisa o ultra admin das divergências (SPEC 114). | cron | própria | `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `registro-audio-limpar` | Cron: apaga o áudio do registro de obra após 12 meses, de conta de campo excluída e arquivos órfãos (ADR 0062). | cron | própria | `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `retencao-pos-trial` | Cron: avisos e exclusão de empresa depois do trial vencido (SPEC 098 Fase 3). | cron | própria | `ALLOWED_ORIGINS` `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `reverificar-documentos-pendentes` | Cron: reverifica CNPJ ou CPF pendentes do trial (SPEC 098). | cron | própria | `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `trial-expiry-cron` | Cron: expira trials, converte quem tem cartão e manda os avisos. | cron | própria | `ALLOWED_ORIGINS` `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |

## Plataforma (ultra admin)

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `create-company-owner` | Convite de dono de empresa nova (bootstrap manual com chave de super admin). | manual (curl com chave de super admin) | JWT | `ALLOWED_ORIGINS` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` `SUPER_ADMIN_KEY` | sim |
| `excluir-dados-titular` | Ultra admin aprova ou recusa pedido de exclusão (LGPD art. 18 VI): aprovar apaga o dado pessoal, anonimiza e bloqueia a conta (SPEC 116). | app, aba Pedidos LGPD do ultra admin | JWT |  | sim |
| `log-impersonation` | Abre e encerra sessão de impersonation do ultra admin, com registro no servidor. | app | JWT |  | sim |
| `ops-agente-run` | Executa um agente de operação da Pilar (Receita, Clientes, Chefe de gabinete): fatos do banco, texto do modelo aterrado em código, ações pendentes no Ultra e resumo do dia por e-mail (SPEC 126). | app, cron | própria | `APP_URL` `CRON_SECRET` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `ops-export-funil` | Devolve à plataforma de marketing (post-automation) cadastros, ativados e pagantes por dia e UTM, sem dado pessoal, autenticada por token próprio (SPEC 128). | **sem chamador conhecido** | própria | `OPS_EXPORT_TOKEN` `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` | sim |
| `ultra-admin-empresas` | Gestão de empresas pelo ultra admin. | app | JWT |  | sim |
| `ultra-admin-usuarios` | Gestão de usuários pelo ultra admin. | app | JWT |  | sim |

## Utilitários

| Função | O que faz | Chamada por | Login | Secrets | Teste |
| --- | --- | --- | --- | --- | --- |
| `geocode-address` | Geocodifica endereço pelo Nominatim (mapa). | app | JWT |  | sim |
| `health` | Saúde do backend (banco, Asaas, Resend); usado pelo smoke de deploy e pelo monitor de produção. | monitor de produção e smoke de deploy | própria | `HEALTH_CHECK_ASAAS` `HEALTH_CHECK_RESEND` `RELEASE_SHA` `SENTRY_RELEASE` `VERCEL_GIT_COMMIT_SHA` | sim |
| `lookup-cep` | Busca CEP sem login (checkout), BrasilAPI com fallback de provedor. | app | JWT |  | sim |
| `turnstile-verify` | Verifica no servidor o token do Cloudflare Turnstile. | **sem chamador conhecido** | própria | `SUPABASE_SERVICE_ROLE_KEY` `SUPABASE_URL` `TURNSTILE_SECRET_KEY` | sim |

## Sem chamador conhecido

- `asaas-config`
- `asaas-criar-cobranca`
- `portal-entrega-download`
- `portal-get-projeto`
- `upload-portal-entrega`
- `send-invoice-reminder`
- `ops-export-funil`
- `turnstile-verify`
