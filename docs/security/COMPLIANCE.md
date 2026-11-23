# Compliance — Pilar

Status de conformidade LGPD + roadmap SOC2/ISO.

## LGPD

### Papéis

- **Controlador:** cliente do Pilar (escritório de engenharia), controla dados dos seus próprios clientes finais
- **Operador:** Pilar, operado por MATHEUS PREZIA REZENDE TECH LTDA, CNPJ 63.418.862/0001-59 (ver
  [docs/legal/README.md](../legal/README.md))
- **DPO (encarregado):** Matheus Prezia Rezende, privacidade@pilarsoft.com.br

### Bases legais de tratamento

- Dados de funcionários (`profiles`, `pessoas`): execução de contrato + interesse legítimo
- Dados de clientes finais do cliente (`clientes`, `cliente_portal_accounts`): execução de contrato pelo controlador
- Dados financeiros: obrigação legal (fiscal) — retenção 5 anos
- Logs de auditoria: interesse legítimo (segurança) — retenção 5 anos

### Direitos do titular implementados

- [x] **Acesso/Portabilidade:** self-service em Configurações → Privacidade, `request_data_export`
- [x] **Correção:** edição direta no Perfil
- [x] **Exclusão:** self-service em Configurações → Privacidade, `request_data_deletion`; o ultra admin aprova na aba Pedidos LGPD e a edge `excluir-dados-titular` apaga o dado pessoal e anonimiza a conta (SPEC 116, ADR 0057)
- [x] **Informação:** Política de Privacidade pública
- [x] **Revogação de consentimento:** desativa conta → dados retidos só por obrigação legal

### DPIA (Avaliação de Impacto)

- [x] RIPD publicado em [`../legal/RIPD.md`](../legal/RIPD.md) (v1, 2026-10-13): descrição do
      tratamento, necessidade, riscos e controles, riscos residuais. Revisar a cada operação nova
      no ROPA ou fornecedor novo. Falta revisão de advogado/DPO.

### ROPA (Record of Processing Activities)

✅ Ver [`../ROPA.md`](../ROPA.md) (v1, 2026-09-08, levantado do schema real; falta revisão de
advogado/DPO antes de fiscalização).

### DPA (Data Processing Agreement)

O **Anexo de Tratamento de Dados Pessoais** dos Termos v2.0 publicados em
`apps/marketing/src/pages/Termos.tsx` é o DPA contratual padrão desde 10/11/2026.
O arquivo [`DPA_TEMPLATE.md`](../templates/DPA_TEMPLATE.md) é histórico e não
deve ser oferecido a clientes sem revisão. Identidade da empresa e encarregado
estão publicados; a **revisão jurídica externa e a validação dos DPAs de
fornecedores continuam pendentes**.

### Incidentes e notificação

- Vazamento de dados pessoais → notificar ANPD em **até 3 dias úteis** (LGPD
  Art. 48 + Resolução CD/ANPD nº 15/2024, que regulamenta o prazo; confirmar
  com o DPO/advogado antes de tratar isso como definitivo). Corrigido em
  2026-08-18: este documento dizia 2 dias úteis, `INCIDENT_RESPONSE.md` dizia
  3; os dois precisam bater.
- Ver `../operations/INCIDENT_RESPONSE.md` seção 6

### Transferência internacional

- **Supabase de produção:** região `sa-east-1` (São Paulo, Brasil); isso NÃO
  permite afirmar que todo o serviço/processamento ocorre exclusivamente no Brasil.
- **Supabase de staging:** região `us-west-2` (Estados Unidos), confirmada na
  conexão do projeto em 19/11/2026. Não copiar dados pessoais reais de produção
  sem avaliação, base jurídica e anonimização adequada.
- **Demais fornecedores:** Sentry, PostHog, Resend, modelos de IA e eventual
  gateway podem processar dados fora do Brasil. Minimizá-los e conferir as
  garantias específicas do art. 33 da LGPD e a Resolução ANPD 19/2024.
- **Hosting:** Vercel continua operacional durante a migração gradual para
  Firebase Hosting. Inventariar a região de processamento e atualizar a lista de
  subprocessadores antes do cutover; a troca de hosting não elimina por si só
  as transferências internacionais.
- **Divergência contratual em aberto:** o DPA anexo aos Termos v2 afirma que
  garantias internacionais são adotadas; a política publicada diz que ainda
  estão sendo formalizadas. Não declarar conclusão sem evidência contratual.
  Encaminhar ambos os textos para revisão jurídica antes de alterá-los.

## SOC2 — gaps

| Trust Service        | Status     | Notas                                                 |
| -------------------- | ---------- | ----------------------------------------------------- |
| Security             | 🟡 Parcial | Controles técnicos OK; falta policy formal e training |
| Availability         | 🟡 Parcial | Supabase SLA; falta DR test trimestral documentado    |
| Processing Integrity | 🟢 OK      | audit_logs hash-chained                               |
| Confidentiality      | 🟡 Parcial | pgsodium opt-in; falta NDA com todos contractors      |
| Privacy              | 🟡 Parcial | LGPD sim, GDPR parcial (operamos BR)                  |

**Audit Type II** exigiria ~9-12 meses de evidências operacionais contínuas + auditor externo.

## ISO 27001 — gaps

- [ ] Statement of Applicability (SoA)
- [ ] Risk assessment formal
- [ ] Asset inventory
- [ ] Access control policy
- [ ] Cryptography policy
- [ ] Physical security (N/A — cloud-only, mas documentar dependência Supabase/Vercel)
- [ ] Supplier security review (Supabase, Vercel, Sentry, Asaas)

## Fornecedores críticos

Coluna DPA corrigida em 2026-08-18: a versão anterior marcava Supabase e Asaas
com "✅ (assinar)" ao mesmo tempo (contraditório: ✅ = feito, "assinar" = não
feito). `docs/legal/PRIVACY_POLICY.md` chegou a citar "DPA assinado" pra todos
os vendors com base nesse ✅ ambíguo, o que era impreciso. Sem verificação
recente do estado real de cada um, a coluna abaixo assume pendente por padrão
até alguém confirmar contrato/aceite de cada vendor.

| Vendor                 | Dado processado                  | Certificações           | DPA            |
| ---------------------- | -------------------------------- | ----------------------- | -------------- |
| Supabase               | Todos dados do DB                | SOC2 Type II            | 🟡 a confirmar |
| Vercel                 | Logs + traces                    | SOC2 Type II, ISO 27001 | 🟡 a confirmar |
| Sentry                 | Error stacktraces (PII scrubbed) | SOC2 Type II            | 🟡 a confirmar |
| Asaas                  | Dados de pagamento               | PCI-DSS                 | 🟡 a confirmar |
| Cloudflare (Turnstile) | IP + cookie anti-bot             | SOC2 Type II            | 🟡 a confirmar |

## Roadmap realista

### 2026-Q2

- [x] Encarregado identificado publicamente em /privacidade (verificar formalização documental com assessor jurídico)
- [x] Política de privacidade pública publicada
- [x] ROPA documentado (`../ROPA.md`, 2026-09-08)
- [x] DPA contratual padrão no Anexo dos Termos v2 publicados (revisão jurídica externa pendente)
- [x] Export JSON de dados pessoais (direito de portabilidade) — self-service em Configurações →
      Privacidade (`request_data_export`)

### 2026-Q3

- [ ] Pentest externo (~$10-15k)
- [x] DPIA financeiro + portal (RIPD v1; falta revisão jurídica)
- [ ] NDA com todos contractors
- [ ] Policy docs (Access Control, Cryptography, IR, DR)

### 2026-Q4

- [ ] SOC2 Type I readiness assessment
- [ ] Vendor risk review anual
- [ ] Security awareness training time completo

### 2027

- [ ] SOC2 Type II (se venda enterprise justificar custo de ~$30-50k/ano)
