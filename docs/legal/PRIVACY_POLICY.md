# Política de Privacidade: Pilar

**Status:** 🚧 RASCUNHO, NÃO PUBLICAR. Ver `docs/legal/README.md` para o porquê e a
condição de saída (CNPJ próprio da Pilar).

**Última atualização:** 2026-08-18
**Versão:** 2.0 (rascunho, substitui a v1.0 assinada por Labrynth AI Ltda)

Esta política descreve como o **Pilar** (operado por **[RAZÃO SOCIAL DA PILAR, A
PREENCHER], CNPJ [A PREENCHER]**, com sede em **[ENDEREÇO, A PREENCHER]**) coleta,
usa, armazena e compartilha dados pessoais.

Somos um SaaS de gestão para escritórios de engenharia multidisciplinar
(civil/estrutural/MEP). Atuamos como **operador** dos dados que nossos clientes
(controladores) inserem na plataforma, e como **controlador** dos dados cadastrais
de quem usa o produto e do site.

> A versão publicada em `/privacidade` já usa a marca Pilar, mas ainda qualifica
> razão social e CNPJ como "em regularização" em vez de um número fictício. Este
> documento é o texto completo que a substitui no dia em que a Pilar existir como
> pessoa jurídica separada, com os campos `[A PREENCHER]` preenchidos de verdade.
> Ver decisão em `docs/legal/README.md`.

## 1. Dados coletados

### Do usuário da plataforma (funcionário do cliente)

- Nome, email, telefone
- Cargo e role
- Dados de autenticação (hash da senha, fatores MFA)
- Logs de atividade (acesso, ações)

### Dos clientes finais do cliente (inseridos pelo usuário)

- Nome, CPF/CNPJ, email, telefone, endereço
- Dados bancários (para emissão de cobrança)
- Projetos, contratos, financeiro

### Automático

- IP, user agent
- Cookies estritamente necessários (sessão), sempre ativos
- Cookies de análise (PostHog), **só com consentimento explícito**, ver seção 8

**Não coletamos:** dados de saúde, origem racial, opinião política, biometria.

## 2. Finalidades

- Prestar o serviço contratado pelo cliente controlador
- Autenticar usuários e proteger contas (MFA, logs de acesso)
- Cumprir obrigações legais (retenção fiscal 5 anos)
- Prevenir fraude e abuso (rate limit, anomaly detection)
- Melhorar a plataforma (agregado, anonimizado, e só com consentimento para
  cookies de análise)

## 3. Bases legais (LGPD Art. 7 e 11)

- **Execução de contrato** (Art. 7, V): serviço básico da plataforma
- **Obrigação legal** (Art. 7, II): retenção fiscal
- **Legítimo interesse** (Art. 7, IX): segurança, prevenção de fraude, auditoria
- **Consentimento** (Art. 7, I): cookies de análise, comunicações de marketing

## 4. Compartilhamento

Compartilhamos dados apenas com:

- **Supabase** (hospedagem do banco de dados, São Paulo): DPA a confirmar
- **Vercel** (hospedagem do app e do site): DPA a confirmar
- **Sentry** (monitoramento de erros, PII filtrada antes de sair): DPA a confirmar
- **PostHog** (análise de uso, só com consentimento do usuário): DPA a confirmar
- **Asaas** (gateway de pagamento, quando a integração está ativa): DPA a confirmar
- **Autoridades:** apenas sob ordem judicial

Status real de cada DPA (assinado, aceito via termos do próprio vendor, ou
ainda pendente) fica rastreado em `docs/security/COMPLIANCE.md`, não repetido
aqui para não haver dois lugares que podem ficar desalinhados de novo.

**Nunca vendemos** dados a terceiros.

## 5. Retenção

| Dado              | Retenção                                    | Base                   |
| ----------------- | ------------------------------------------- | ---------------------- |
| Conta ativa       | Enquanto o contrato estiver vigente         | Contrato               |
| Conta desativada  | 30 dias para reativação, depois anonimizada | Execução de contrato   |
| Dados financeiros | 5 anos após o encerramento                  | Obrigação legal fiscal |
| Logs de auditoria | 5 anos                                      | Legítimo interesse     |
| Backups           | 7 dias (PITR) + 12 meses (mensal)           | Continuidade/DR        |
| Cookie de análise | Até a revogação do consentimento            | Consentimento          |

## 6. Direitos do titular (LGPD Art. 18)

Você pode a qualquer momento solicitar:

- **Confirmação** da existência de tratamento
- **Acesso** aos seus dados (export estruturado)
- **Correção** de dados incompletos ou desatualizados
- **Anonimização, bloqueio ou eliminação** de dados desnecessários ou excessivos
- **Portabilidade** para outro fornecedor
- **Eliminação** dos dados tratados com base no consentimento
- **Informação** sobre com quem seus dados foram compartilhados
- **Informação** sobre a possibilidade de não fornecer consentimento e as
  consequências de recusar
- **Revogação** do consentimento, a qualquer momento

**Como exercer:** email para **privacidade@pilarsoft.com.br**, ou diretamente pela
página `/privacidade` (exportação e exclusão self-service). Respondemos em até
**15 dias**.

## 7. Segurança

- TLS 1.3 em trânsito
- Senhas com hash bcrypt
- Multifator obrigatório para administradores
- Log de auditoria imutável
- Backup cifrado em múltiplas regiões
- Detalhes técnicos: `../security/SECURITY.md`

## 8. Cookies

Cookies **estritamente necessários** (sessão, autenticação) são sempre ativos:
sem eles o produto não funciona.

Cookies de **análise** (PostHog: `capture_pageview`, `capture_pageleave`,
identificador anônimo) só são ativados depois que você aceita explicitamente no
banner de consentimento. Enquanto não houver decisão, ou se você recusar, nenhum
dado é enviado ao PostHog. Você pode mudar de ideia a qualquer momento:

- No produto, em `/privacidade`, botão "Alterar preferências de cookies".
- No site, no rodapé, link "Preferências de cookies".

Detalhes de cada cookie/tecnologia usada: ver Política de Cookies
(`COOKIE_POLICY.md`).

## 9. Transferência internacional

Dados permanecem no Brasil (Supabase, região São Paulo). Algumas funcionalidades
(edge functions na Vercel, Sentry, PostHog) podem processar dados temporariamente
fora do Brasil, sempre cifrado em trânsito e sob contrato que impõe proteção
equivalente à LGPD.

## 10. Menores de idade

Serviço destinado a empresas (B2B). Não coletamos intencionalmente dados de
menores de 18 anos. Se identificarmos, excluímos imediatamente.

## 11. Contato

**DPO:** privacidade@pilarsoft.com.br
**ANPD:** https://www.gov.br/anpd/pt-br

## 12. Mudanças nesta política

Mudanças materiais são notificadas por email com 30 dias de antecedência.
Mudanças menores (formatação, links) podem ser aplicadas sem aviso prévio.
