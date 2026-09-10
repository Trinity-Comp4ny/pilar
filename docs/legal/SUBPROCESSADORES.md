# Subprocessadores — Pilar

Lista pública dos terceiros que processam dado pessoal em nome do Pilar. Referenciada pela
[Política de Privacidade](./PRIVACY_POLICY.md), seção 4, e pelo [ROPA](../ROPA.md).

**Como funciona:** quando um cliente contrata o Pilar, os dados que ele insere no sistema
(próprios, de funcionários, de clientes finais) passam por estes fornecedores para o produto
funcionar. Nenhum deles recebe acesso além do estritamente necessário pra função descrita.

| Subprocessador             | Função                                                                                                         | Dado que processa                                                                            | Localização                                  | Status do DPA  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------- |
| **Supabase**               | Banco de dados, autenticação, storage de arquivo/foto                                                          | Todo dado do produto (é o banco principal)                                                   | São Paulo, Brasil                            | 🟡 a confirmar |
| **Vercel**                 | Hospedagem do app, do site e das edge functions                                                                | Logs de acesso, payload em trânsito nas functions                                            | Global (edge), pode processar fora do Brasil | 🟡 a confirmar |
| **Resend**                 | Envio de e-mail transacional (convite, recuperação de senha, notificação)                                      | Nome, e-mail, conteúdo do e-mail enviado                                                     | EUA                                          | 🟡 a confirmar |
| **Sentry**                 | Monitoramento de erro                                                                                          | Stacktrace e contexto técnico; PII filtrada antes do envio (`src/lib/monitoring.ts`)         | EUA/UE conforme configuração                 | 🟡 a confirmar |
| **PostHog**                | Analytics de produto, só com consentimento do usuário                                                          | Rota visitada, evento de produto; PII sofre scrub automático (`src/lib/analytics.ts`)        | EUA                                          | 🟡 a confirmar |
| **Asaas**                  | Gateway de pagamento (assinatura do Pilar e compra de pacote de token)                                         | Dado de pagamento (cartão tokenizado, não armazenado cru), CPF/CNPJ do pagador               | Brasil                                       | 🟡 a confirmar |
| **Cloudflare (Turnstile)** | Anti-abuso no cadastro (captcha)                                                                               | IP, cookie anti-bot                                                                          | Global                                       | 🟡 a confirmar |
| **Google (Gemini API)**    | Modelo de IA por trás do chat/copiloto (`ai-chat`) e das automações `ai-cotacao-import`/`ai-import-financeiro` | Texto digitado pelo usuário no chat, conteúdo de cotação/documento financeiro enviado pra IA | EUA/global conforme região da API            | 🟡 a confirmar |

**Nunca vendemos dado a terceiro**, e nenhum subprocessador acima usa o dado do cliente pra
treinar modelo próprio ou qualquer finalidade fora da função listada. Para o Google
especificamente, confirmado em 2026-09-08: o projeto que gera a `GEMINI_API_KEY` tem faturamento
(billing) ativo, o que coloca o uso no tier pago da Gemini API — sob os termos desse tier, o
Google **não** usa o conteúdo enviado (prompt/resposta) pra treinar modelo, tratando só como log
de abuso com retenção curta.

## Mudança de subprocessador

Cliente com contrato ativo (DPA assinado) tem direito a ser avisado antes de um subprocessador
novo entrar em operação, com janela pra objeção — ver cláusula correspondente em
[`../templates/DPA_TEMPLATE.md`](../templates/DPA_TEMPLATE.md). Até o Pilar ter cliente
pagante com DPA assinado, esta lista é atualizada por transparência, sem processo formal de
notificação ainda ligado.

**Status dos DPAs:** rastreado de forma completa em
[`../security/COMPLIANCE.md`](../security/COMPLIANCE.md) (tabela "Fornecedores críticos"), pra
não haver dois lugares divergentes sobre o mesmo fato.
