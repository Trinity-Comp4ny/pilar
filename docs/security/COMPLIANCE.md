# Compliance — Pilar

Status de conformidade LGPD + roadmap SOC2/ISO.

## LGPD

### Papéis

- **Controlador:** cliente do Pilar (escritório de engenharia), controla dados dos seus próprios clientes finais
- **Operador:** Pilar (razão social e CNPJ próprios em regularização, ver
  [docs/legal/README.md](../legal/README.md))
- **DPO:** privacidade@pilarsoft.com.br

### Bases legais de tratamento

- Dados de funcionários (`profiles`, `pessoas`): execução de contrato + interesse legítimo
- Dados de clientes finais do cliente (`clientes`, `cliente_portal_accounts`): execução de contrato pelo controlador
- Dados financeiros: obrigação legal (fiscal) — retenção 5 anos
- Logs de auditoria: interesse legítimo (segurança) — retenção 5 anos

### Direitos do titular implementados

- [x] **Acesso:** user exporta próprios dados via Perfil → Exportar (TODO: implementar export JSON)
- [x] **Correção:** edição direta no Perfil
- [ ] **Exclusão:** cliente solicita, admin deleta via `/admin` (TODO: UI + audit log)
- [ ] **Portabilidade:** export JSON (TODO)
- [x] **Informação:** Política de Privacidade pública
- [x] **Revogação de consentimento:** desativa conta → dados retidos só por obrigação legal

### DPIA (Avaliação de Impacto)

- [ ] A fazer: DPIA formal pra módulo financeiro + portal cliente
- Template sugerido: [ANPD Guia Orientativo](https://www.gov.br/anpd/pt-br)

### ROPA (Record of Processing Activities)

Ver `docs/ROPA.md` (TODO criar)

### DPA (Data Processing Agreement)

Template em `docs/templates/DPA_TEMPLATE.md` (TODO)

### Incidentes e notificação

- Vazamento de dados pessoais → notificar ANPD em **até 3 dias úteis** (LGPD
  Art. 48 + Resolução CD/ANPD nº 15/2024, que regulamenta o prazo; confirmar
  com o DPO/advogado antes de tratar isso como definitivo). Corrigido em
  2026-08-18: este documento dizia 2 dias úteis, `INCIDENT_RESPONSE.md` dizia
  3; os dois precisam bater.
- Ver `../operations/INCIDENT_RESPONSE.md` seção 6

### Transferência internacional

- Supabase hospedado em São Paulo (região sa-east-1 equivalente) — **sem transferência internacional**
- Vercel: edge functions podem rodar fora do Brasil — revisar com DPO
- Sentry: dados PII scrubbed antes de enviar — ver `src/lib/monitoring.ts`

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

- [ ] DPO nomeado oficial
- [ ] Política de privacidade pública publicada
- [ ] ROPA documentado
- [ ] Template DPA pra assinar com clientes
- [ ] Export JSON de dados pessoais (direito de portabilidade)

### 2026-Q3

- [ ] Pentest externo (~$10-15k)
- [ ] DPIA financeiro + portal
- [ ] NDA com todos contractors
- [ ] Policy docs (Access Control, Cryptography, IR, DR)

### 2026-Q4

- [ ] SOC2 Type I readiness assessment
- [ ] Vendor risk review anual
- [ ] Security awareness training time completo

### 2027

- [ ] SOC2 Type II (se venda enterprise justificar custo de ~$30-50k/ano)
