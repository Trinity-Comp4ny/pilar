# Política de Privacidade — Pilar

**Última atualização:** 2026-04-24
**Versão:** 1.0

Esta política descreve como o Pilar (operado por **Labrynth AI Ltda**, CNPJ [xxx]) coleta, usa, armazena e compartilha dados pessoais.

Somos um SaaS de gestão para escritórios de arquitetura e engenharia. Atuamos como **operador** dos dados que nossos clientes (controladores) inserem na plataforma.

## 1. Dados coletados

### Do usuário da plataforma (funcionário do cliente)

- Nome, email, telefone
- Cargo e role
- Dados de autenticação (hash da senha, factors MFA)
- Logs de atividade (acesso, ações)

### Dos clientes finais do cliente (inseridos pelo usuário)

- Nome, CPF/CNPJ, email, telefone, endereço
- Dados bancários (para emissão de cobrança)
- Projetos, contratos, financeiro

### Automático

- IP, user agent
- Cookies estritamente necessários (sessão)
- Métricas de uso (anonimizadas)

**Não coletamos:** dados de saúde, origem racial, opinião política, biometria.

## 2. Finalidades

- Prestar o serviço contratado pelo cliente controlador
- Autenticar usuários e proteger contas (MFA, logs de acesso)
- Cumprir obrigações legais (retenção fiscal 5 anos)
- Prevenir fraude e abuso (rate limit, anomaly detection)
- Melhorar a plataforma (agregado, anonimizado)

## 3. Bases legais (LGPD Art. 7 e 11)

- **Execução de contrato** (I): serviço básico da plataforma
- **Obrigação legal** (II): retenção fiscal
- **Legítimo interesse** (IX): segurança, prevenção de fraude, auditoria
- **Consentimento** (I): features opcionais (ex: marketing emails)

## 4. Compartilhamento

Compartilhamos dados apenas com:

- **Supabase** (hospedagem DB, São Paulo) — DPA assinado
- **Vercel** (hospedagem app) — DPA assinado
- **Sentry** (monitoramento de erros, PII scrubbed) — DPA assinado
- **Asaas** (gateway pagamento, quando integração ativa) — DPA assinado
- **Autoridades:** apenas sob ordem judicial

**Nunca vendemos** dados a terceiros.

## 5. Retenção

| Dado              | Retenção                                    | Base                   |
| ----------------- | ------------------------------------------- | ---------------------- |
| Conta ativa       | Enquanto contrato vigente                   | Contrato               |
| Conta desativada  | 30 dias para reativação, depois anonimizada | Execução de contrato   |
| Dados financeiros | 5 anos após encerramento                    | Obrigação legal fiscal |
| Logs de auditoria | 5 anos                                      | Legítimo interesse     |
| Backups           | 7 dias (PITR) + 12 meses (mensal)           | DR                     |

## 6. Direitos do titular

Você pode a qualquer momento solicitar:

- **Acesso** aos seus dados (export JSON)
- **Correção** de dados incorretos
- **Exclusão** (respeitando retenção legal)
- **Portabilidade** (export em formato estruturado)
- **Informação** sobre uso e compartilhamento
- **Revogação** de consentimento

**Como exercer:** email para dpo@labrynth.ai. Respondemos em até **15 dias**.

## 7. Segurança

- TLS 1.3 em trânsito
- Senhas hasheadas com bcrypt
- Multi-fator obrigatório para administradores
- Audit log imutável
- Backup cifrado em múltiplas regiões
- Detalhes técnicos: `../security/SECURITY.md`

## 8. Cookies

Usamos cookies **estritamente necessários** (sessão, CSRF, preferências).
Não usamos cookies de marketing/tracking de terceiros por padrão.

Exceção: se o cliente ativar integração Google Analytics/GTM, cookies de analytics passam a ser coletados — consulte o controlador (seu empregador).

## 9. Transferência internacional

Dados permanecem no Brasil (Supabase região São Paulo). Algumas funcionalidades (edge functions Vercel, Sentry) podem processar temporariamente fora do Brasil — sempre cifrado em trânsito e com DPA que impõe mesma proteção da LGPD.

## 10. Menores de idade

Serviço destinado a empresas (B2B). Não coletamos intencionalmente dados de menores de 18 anos. Se detectarmos, excluímos imediatamente.

## 11. Contato

**DPO:** dpo@labrynth.ai
**ANPD:** https://www.gov.br/anpd/pt-br

## 12. Mudanças nesta política

Mudanças materiais serão notificadas por email com 30 dias de antecedência. Mudanças menores (formatação, links) podem ser aplicadas sem aviso.

Histórico de versões em [docs/PRIVACY_POLICY_CHANGELOG.md].
